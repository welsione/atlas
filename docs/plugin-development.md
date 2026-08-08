# Atlas 插件开发规范

Atlas 是一个全 TypeScript 的 AI 服务基础平台，核心能力全部通过**目录插件（directory plugin）**扩展：
监控框架为平台内置，而数据接入、工具能力、前端面板均由插件提供。

本规范定义插件从声明、实现到发布、热更新的全部契约。官方插件源码即最佳示例：
`plugins/{template,providers,prompts,model-files}`。

---

## 1. 插件模型总览

```
┌─────────────────────────────────────────────────────────────┐
│ Atlas 平台 (packages/core)                                   │
│  · 插件加载器（目录扫描 + 热更新，约 10s 轮询）                 │
│  · 端点分发 /api/apps/{appId}/plugins/{type}/ep/{path}        │
│  · 文件托管 /api/files/{token}/download|meta（防穷举/304/限流） │
│  · 数据集调度（MANUAL / SCHEDULED 刷新）                       │
│  · UI 托管 /_pluginui/{type}/{entry}                          │
│  · 密钥派生（按插件派生的 AES-256-GCM）                        │
└─────────────────────────────────────────────────────────────┘
        ▲ store() / files() / crypto() / datasets() / ops()
        │  endpoints() / datasetSource() / init() / destroy()
┌─────────────────────────────────────────────────────────────┐
│ 插件目录（plugins/<type>/）                                   │
│  manifest.json   声明（type/name/description/version/scope） │
│  src/index.ts    实现（Node 22 原生运行 TS，type-stripping）   │
│  ui/             前端面板构建产物（可选，build 自动生成）       │
│  ui-src/         前端面板源码（可选，npm run ui:build）        │
└─────────────────────────────────────────────────────────────┘
```

- 一个插件 = 一个目录；插件类型（`type` / `pluginType`）全局唯一。
- 后端无内置插件概念：平台从仓库根 `plugins/` 目录加载全部目录插件
  （`AIBASE_PLUGINS_DIR` 环境变量可覆盖目录；`template` 目录被加载器跳过）。
- 插件可只做后端（端点/数据集），也可附带前端面板（UI slot）。

## 2. 目录结构规范

```
plugins/<type>/
├── manifest.json          # 插件声明（必填，含 icon）
├── icons/                 # 插件图标目录（可选，SVG/PNG，manifest.icon 相对路径指向这里）
├── src/
│   └── index.ts           # AibasePlugin 实现（必填，Node 22 直接运行）
├── ui/                    # 前端面板构建产物（可选；npm run ui:build 自动生成）
│   ├── manifest.json      #   UI manifest（entry 含内容哈希）
│   └── entry.<hash>.js
└── ui-src/                # 前端面板源码（可选）
    ├── package.json       #   devDeps: vue/element-plus/vite/@vitejs/plugin-vue
    ├── build.mjs          #   vite 构建 → 哈希 entry → ../ui/
    ├── vite.config.mjs
    └── src/
        ├── main.js        #   导出 mount(el, ctx) 契约
        ├── App.vue        #   面板实现（props.appId）
        └── manifest.json  #   UI slot 声明
```

开发新插件：`cp -R plugins/template plugins/my-plugin`，然后逐项替换。

## 3. manifest.json 规范（后端）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `pluginType` | string | ✅ | 插件类型，全局唯一；与 `src/index.ts` 的 `AibasePlugin.type` 必须一致，不一致则加载跳过 |
| `name` | string | ✅ | 插件显示名 |
| `description` | string | ✅ | 一句话说明 |
| `version` | string | ✅ | 语义化版本，如 `1.0.0` |
| `defaultDataScope` | `APP_LOCAL` \| `GLOBAL_SHARED` | ✅ | 默认数据作用域（见 §8） |
| `icon` | string | - | 插件图标（见 §3.1），缺省无图标 |
| `entry` | string | ✅ | 后端入口相对路径，固定 `src/index.ts` |

```json
{
  "pluginType": "providers",
  "name": "供应商管理",
  "description": "AI 供应商管理（全局共享）",
  "version": "1.0.0",
  "defaultDataScope": "GLOBAL_SHARED",
  "icon": "icons/providers.svg",
  "entry": "src/index.ts"
}
```

### 3.1 插件图标（icon）

`icon` 字段支持三种形态，平台自动识别：

| 形态 | 示例 | 说明 |
|------|------|------|
| 相对路径 | `icons/providers.svg` | 文件存于插件目录 `icons/` 下；平台经 `/_pluginui/{type}/icons/{file}` 服务（SVG/PNG，缓存 immutable，防穿越） |
| data URI | `data:image/svg+xml;base64,...` | 内嵌图标，无需文件 |
| http(s) URL | `https://example.com/icon.svg` | 外部图标直用 |

展示位置（同一图标全平台一致）：

- **应用空间 Tab**（app-space slot）：Tab 标签前显示插件图标
- **插件实例表格**（应用空间 → 插件实例）：行首显示插件图标
- **插件注册表**（系统级）：行首显示插件图标
- **控制台卡片**（console slot）：卡片头部显示图标 + 标题

官方插件图标文件规范：`plugins/<type>/icons/<type>.svg`（建议 100×100 viewBox、白底圆角、单色系低多边形风格，与平台品牌一致）。

## 4. AibasePlugin SPI 契约

```ts
import type { AibasePlugin, PluginEnvironment } from '@atlas/types'

const plugin: AibasePlugin = {
  type: 'my-plugin',            // 必填，全局唯一，与 manifest.pluginType 一致
  name: '我的插件',
  describe: '插件说明',
  defaultDataScope: 'APP_LOCAL',
  scopeOverrideAllowed: true,   // 可选：是否允许实例级覆盖作用域（仅 SHARED → LOCAL）

  /** 可选：幂等建表 DDL，平台启动按注册顺序执行 */
  schemaDdl: () => [
    `CREATE TABLE IF NOT EXISTS my_plugin_item (...)`,
  ],

  /** 可选：数据集内容渲染源（见 §7） */
  datasetSource: () => ({
    render: async (env) => JSON.stringify(payload),
  }),

  /** 可选：REST 端点（见 §6） */
  endpoints: () => [
    { method: 'GET', path: 'list', summary: '列表', handle: async (env) => [...] },
  ],

  /** 可选：实例启用时初始化（种子数据、资源准备） */
  async init(env: PluginEnvironment) {
    const rows = await env.store().get('items')
    if (!rows) { await env.store().put('items', []) }
  },

  /** 可选：实例销毁/平台停止时清理 */
  destroy: async () => {},
}
export default plugin
```

### 生命周期
1. **平台启动**：加载器扫描 `plugins/` 目录 → 校验 manifest（字段齐全、entry 存在、
   导出 `AibasePlugin`、type 与 manifest 一致）→ 注册到插件注册表。
2. **实例启用**（某应用启用该插件）：`schemaDdl()` 已由平台执行过建表；
   `init(env)` 以该实例上下文调用（种子数据、默认配置）。
3. **运行期**：`endpoints()` 的 handler 按请求分发调用；`datasetSource()` 按调度刷新。
4. **实例销毁/停用**：`destroy()` 调用。

## 5. PluginEnvironment API 参考

`init` / endpoint handler / `datasetSource.render` 收到同一形态的 `env`：

| 成员 | 类型 | 说明 |
|------|------|------|
| `store()` | `PluginStore` | 通用键值存储（作用域见 §8）。`get/put/remove(entityKey, entityId?)` + `list(entityId?)`；`entityId` 默认 `''` |
| `files()` | `PluginFiles` | 插件文件存储（实例隔离存储根、路径防穿越）。`write/read/remove/list` + `publish/unpublish` 公开托管 |
| `crypto()` | `PluginCrypto` | 平台密钥按插件派生的 AES-256-GCM：`encrypt(plain)/decrypt(ciphertext)`。API Key 等敏感字段必须用它加密落库 |
| `datasets()` | `DatasetPublisher` | 数据集发布：`publish(key,name,sensitivity,json)`（内容哈希驱动版本）、`refresh(key)`、`upsertSecret/deactivateSecret` |
| `datasetSource()` | `DatasetSource \| null` | 当前实例声明的渲染源；`render(env)` 返回 JSON 字符串或 `null`（跳过本次刷新） |
| `ops()` | `Ops` | 操作审计日志：`log(level,msg,detail?)` / `info` / `warn` / `error` |
| `info/warn/error(message)` | void | 插件运行日志（应用维度） |
| `config()` | `Record<string,unknown>` | 实例配置 |
| `updateConfig(config)` | Promise | 更新实例配置 |
| `instance()` | `PluginInstanceContext` | `{ appId, instanceId, dataScope }` |

```ts
// store 用法（通用存储，JSON 序列化）
await env.store().put('items', rows)
const rows = await env.store().get<Item[]>('items')
await env.store().remove('items')

// files 用法（模型文件等二进制/大文件 + 公开托管）
const rel = await env.files().write('weights/q4.bin', buffer)
const buf = await env.files().read(rel)
const { token, relPath } = await env.files().publish(rel, 'q4.bin') // → /api/files/{token}/download
await env.files().unpublish(token)

// crypto 用法（敏感字段）
const cipher = env.crypto().encrypt(apiKey)
const plain = env.crypto().decrypt(cipher)
```

## 6. 端点（endpoints）规范

### 路由与调用地址
- `path` 为 `/ep/` 之后的相对路径，支持 `{param}` 占位，如 `update/{id}`。
- 外部访问地址：`/api/apps/{appId}/plugins/{pluginType}/ep/{path}`。
- 前端面板调用：
  ```js
  import { get, post, put, del } from '@atlas/runtime'
  const base = () => `/api/apps/${appId}/plugins/my-plugin/ep`
  const rows = await get(base() + '/list')
  await put(base() + `/update/${id}`, { name })
  ```
- `handle(env, pathParams, body)`：`pathParams` 为 `{param}` 解析结果（字符串）；
  `body` 为请求体（JSON 对象或数组，未传为 `undefined`）。

### 返回包装
- handler 的**返回值**即接口 `data`，平台统一包装为 `{ code: 0, message: 'ok', data }`。
- handler **抛错**（`throw new Error(...)`）→ 平台统一包装为失败响应 `{ code: 1, message }`，HTTP 400/500 语义由平台处理。

### multipart 上传与二进制下载
- 请求为 `multipart/form-data` 时，`body = { fields: {...}, files: [{ originalname, buffer }] }`。
- handler 返回 `{ $binary: <base64>, $mime: 'application/pdf', $filename: 'a.pdf' }`
  时，平台直接以二进制流响应（下载）。

```ts
{
  method: 'POST', path: 'upload', summary: '上传文件',
  handle: async (env, _p, body) => {
    const { files } = body as { files: Array<{ originalname: string; buffer: Buffer }> }
    const f = files[0]
    const rel = await env.files().write(f.originalname, f.buffer)
    return { rel }
  },
},
{
  method: 'GET', path: 'download/{name}', summary: '下载',
  handle: async (env, p) => {
    const buf = await env.files().read(p.name)
    if (!buf) throw new Error(`文件不存在: ${p.name}`)
    return { $binary: buf.toString('base64'), $mime: 'application/octet-stream', $filename: p.name }
  },
},
```

## 7. 数据集（datasetSource + datasets）

插件可向平台发布"数据集"（供网关/外部订阅方消费的 JSON + 密钥）：

- `datasetSource().render(env)`：返回数据集内容 JSON 字符串；返回 `null` 跳过本次刷新。
- `env.datasets().publish(key, name, sensitivity, contentJson)`：
  发布/更新数据集，**内容哈希驱动版本**——内容未变不升版本，返回是否发生版本变更。
- `env.datasets().upsertSecret(key, keyName, value)` / `deactivateSecret(...)`：
  数据集内嵌密钥管理。
- 刷新模式 `MANUAL`（手动触发）或 `SCHEDULED`（`refreshIntervalSeconds` 定时），
  由平台调度器执行（dataset.scheduler.ts），插件只需声明渲染源与发布。

> 平台内置的监控（monitor）聚合端点、数据集面板为框架能力（registerCoreUi 静态注册），
> 不属于插件范畴；插件负责各自的业务数据源。

## 8. 数据作用域（DataScope）

| 作用域 | store/files 语义 |
|--------|------------------|
| `APP_LOCAL` | 每应用一份：存储以 `appId` 维度隔离 |
| `GLOBAL_SHARED` | 全局一份：所有应用共享（`instance_id=0`），如供应商配置 |

- `defaultDataScope` 决定默认行为；`scopeOverrideAllowed: true` 时实例允许
  覆盖为更小作用域（仅 `SHARED → LOCAL` 方向）。
- `env.instance()` 返回当前上下文的 `{ appId, instanceId, dataScope }`，
  需要区分实例时（如多实例各自配置）用 `store(entityKey, String(instanceId))`。

## 9. 前端 UI 面板规范

### slot 模型
UI manifest 声明面板挂载点，平台在三类位置渲染：

| slot | 位置 | 声明字段 |
|------|------|----------|
| `app-space` | 应用空间 Tab（如「供应商」「数据集」） | `tab` |
| `console` | 控制台卡片（仪表盘快捷入口） | `title` |
| `system-menu` | 系统级侧边栏菜单（全局插件面板，无应用上下文） | `title` |

- `system-menu` 面向系统级（`GLOBAL_SHARED`）插件：菜单项渲染在主侧边栏，
  面板页**不携带 `appId`**（`ctx.appId` 为 `undefined`）。端点路由需要应用 ID，
  全局共享实例的数据与具体应用无关，面板可用任意已启用实例作数据通道
  （参考 machine-monitor 插件：`GET /api/apps` 取第一个应用拼接端点地址）。

### ui-src 约定
```js
// src/main.js —— 必须 default 导出 mount 契约
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import App from './App.vue'

export default {
  mount(el, ctx) {
    const app = createApp(App, { appId: ctx.appId })
    app.use(ElementPlus)
    app.mount(el)
    return () => app.unmount()   // 卸载清理
  },
}
```
- `ctx = { appId, pluginType, mode, refresh }`：`refresh()` 可触发父容器刷新；
  `mode` 为挂载场景（`console` / `app-space` / `system-menu`），面板可按场景
  差异化渲染（如卡片模式出概要、菜单模式出详情）；
  系统级插件（`system-menu`）无 `appId`，需自行处理数据通道（见 slot 模型）。
- 面板组件用 `defineProps({ appId: Number, mode: String })` 接收挂载上下文。
- 平台已把 `vue`、`element-plus`、`@element-plus/icons-vue`、`@atlas/runtime`
  作为**共享运行时**（external），面板构建产物**不得打包**这些库，
  直接 `import { get, post, put, del } from '@atlas/runtime'` 即可。

### src/manifest.json 与构建
```json
{
  "pluginType": "my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "slots": [
    { "slot": "app-space", "tab": "我的面板", "entry": "" },
    { "slot": "console", "title": "我的插件", "entry": "" },
    { "slot": "system-menu", "title": "我的插件", "entry": "" }
  ]
}
```
`npm run ui:build`（node build.mjs）执行 vite 构建并对 entry 做内容哈希
（`entry.<sha256:8>.js`），自动生成 `ui/manifest.json` 与 `ui/entry.*.js`。
平台经 `GET /api/plugins/ui` 汇总全部 manifest，按 `/_pluginui/{type}/{entry}`
动态加载（`import(/* @vite-ignore */ ...)`，哈希文件名保证缓存更新）。

### UI 调用链汇总
```
面板组件 → import { get, post, put, del } from '@atlas/runtime'
        → GET/POST/PUT/DELETE /api/apps/{appId}/plugins/{type}/ep/...
面板 API 地址自动携带管理 token（AUTH_TOKEN_KEY 由平台注入）。
```

## 10. 加载与热更新规则

- **扫描目录**：默认 `plugins/`（含 `packages/` 的仓库根）；`AIBASE_PLUGINS_DIR` 覆盖。
- **跳过规则**：目录名 `template` 恒跳过（模板不算插件）。
- **校验失败**（manifest 缺字段 / entry 不存在 / 未导出 AibasePlugin /
  type 与 manifest 不一致）：记录 warning 跳过，不影响平台与其他插件。
- **热更新**：watcher 轮询目录哈希（dirHash），检测到变化约 **10s** 内重载；
  加载用 cache-busting URL（`?v={dirHash}`）绕过 Node 模块缓存。
- **开发期**：改后端源码 → 等待 10s 热重载（或重启服务）；
  改前端面板 → `npm run ui:build` 后同样热更新（哈希 entry 变体）。
- 加载失败**隔离**：单个插件崩溃不影响平台运行。

## 11. 安全规范（必读）

| 事项 | 要求 |
|------|------|
| 敏感字段 | API Key / Secret 一律 `env.crypto().encrypt()` 落库，禁止明文持久化 |
| 文件路径 | 只用 `env.files()` 的 `relPath` 返回值；平台已做防穿越 |
| 图标资源 | 图标文件放 `icons/` 目录，经平台 `/_pluginui/{type}/icons/` 服务（防穿越校验），不要放任意目录 |
| 公开托管 | 需对外提供文件时用 `publish()`（平台生成防穷举 token，含 304 缓存、限流、审计），**不要**自建公开下载端点 |
| 审计 | 关键操作（增删改）调用 `env.ops().info/log` 写入操作审计 |
| 输入校验 | endpoint 必须校验 body 与 pathParams（空值、非法 id 等），校验失败 `throw new Error(...)` |
| 数据集敏感度 | `publish` 时必须声明 `PUBLIC / INTERNAL / SECRET`，密钥类数据用 `upsertSecret` 单独管理 |
| 类型唯一性 | 插件 type 全局唯一；重复类型加载会被跳过 |

## 12. 开发流程（从模板起步）

```bash
# 1. 复制模板
cp -R plugins/template plugins/my-plugin

# 2. 改声明
vim plugins/my-plugin/manifest.json   # pluginType/name/description/version/defaultDataScope

# 3. 实现后端
vim plugins/my-plugin/src/index.ts    # type 与 manifest.pluginType 一致

# 4. （可选）前端面板
cp -R plugins/providers/ui-src plugins/my-plugin/ui-src
#    改 package.json 名字、src/manifest.json slots、main.js、App.vue
cd plugins/my-plugin/ui-src && npm install && npm run ui:build   # → ../ui/

# 5. 验证
#    后端：等待约 10s 热加载（日志出现插件注册信息），
#    或重启服务后访问「应用空间 → 插件」检查 runtimeLoaded
#    接口：curl http://127.0.0.1:18081/api/apps/{appId}/plugins/my-plugin/ep/...

# 6. 提交
#    git add plugins/my-plugin && git commit（ui/ 构建产物一并提交，
#    仓库内插件目录即分发源）
```

## 13. 官方插件速览（示例参考）

| 插件 | type | 作用域 | 可学习点 |
|------|------|--------|----------|
| providers | 供应商管理 | GLOBAL_SHARED | 种子数据 init、crypto 加密、CRUD 端点、UI 面板（ep+store 全链路） |
| prompts | 提示词管理 | APP_LOCAL | 渲染端点、版本历史、APP_LOCAL 作用域 |
| model-files | 模型文件 | APP_LOCAL | files() 存储 + publish 公开托管 + 元数据表 |
| machine-monitor | 机器监控 | GLOBAL_SHARED | 系统级插件（system-menu 侧边菜单 + console 卡片）、Node 内置模块指标采集、滚动历史、datasetSource 定时采样 |
| template | 模板 | - | 最小骨架（加载器恒跳过） |

## 14. FAQ

- **入口为什么是 `.ts`？** 平台要求 Node ≥ 22，原生 type-stripping 直接运行 TS，
  无需编译步骤；但类型检查需 `npm run typecheck`（tsconfig 覆盖 plugins）。
- **UI 构建后没生效？** 确认 `ui/manifest.json` 的 entry 哈希已更新且
  `slots[].entry` 同步（build.mjs 自动处理）；前端刷新页面（manifest 是启动时拉取一次）。
- **热更新没触发？** watcher 约 10s 轮询；若增删了目录请确认 `template` 命名未被误用。
- **端点 404？** 检查插件实例已启用（应用空间 → 插件 → 启用），
  URL 形态为 `/api/apps/{appId}/plugins/{type}/ep/{path}`。
- **系统级插件（system-menu）端点怎么调？** 端点路由必须有应用 ID；全局共享
  （GLOBAL_SHARED）插件的数据与具体应用无关，UI 取任意一个已启用实例即可
  （`GET /api/apps` → `apps[0].id` 拼接 `/api/apps/{id}/plugins/{type}/ep/...`）。
- **数据隔离不对？** 检查 manifest.defaultDataScope 与实例 dataScope 是否一致。
