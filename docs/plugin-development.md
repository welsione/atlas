# Atlas 插件开发规范

Atlas 是一个全 TypeScript 的 AI 服务基础平台，核心能力全部通过**目录插件（directory plugin）**扩展：
监控框架为平台内置，而数据接入、工具能力、前端面板均由插件提供。

本规范定义插件从声明、实现到发布、热更新的全部契约。官方插件源码即最佳示例：
`plugins/{template,providers,prompts,model-files}`。

> 插件如何接入**平台核心功能**（订阅生命周期事件、调用应用/监控/安全/平台门面、声明式建表/级联清理/日志保留/公开放行/监控命名），
> 参见 [核心功能 SPI 开发规范](./spi-development.md)。

---

## 1. 插件模型总览

```text
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
  （`ATLAS_PLUGINS_DIR` 环境变量可覆盖目录；`template` 目录被加载器跳过）。
- 插件可只做后端（端点/数据集），也可附带前端面板（UI slot）。

## 2. 目录结构规范

```text
plugins/<type>/
├── manifest.json          # 插件声明（必填，含 icon）
├── icons/                 # 插件图标目录（可选，SVG/PNG，manifest.icon 相对路径指向这里）
├── schema.sql             # 插件自有表建表 SQL（可选；框架自动建表，须幂等 CREATE TABLE IF NOT EXISTS）
├── src/
│   └── index.ts           # AtlasPlugin 实现（必填，Node 22 直接运行）
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

**建表约定**：插件自有表放目录根 `schema.sql`（框架在插件加载完成后自动按 `;` 切分执行，
单条失败隔离）。**禁止在 `src/index.ts` 内联 DDL**（`schemaDdl` 钩子已移除）。

开发新插件：`cp -R plugins/template plugins/my-plugin`，然后逐项替换。

## 3. manifest.json 规范（后端）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `pluginType` | string | ✅ | 插件类型，全局唯一；与 `src/index.ts` 的 `AtlasPlugin.type` 必须一致，不一致则加载跳过 |
| `name` | string | ✅ | 插件显示名 |
| `description` | string | ✅ | 一句话说明 |
| `version` | string | ✅ | 语义化版本，如 `1.0.0` |
| `defaultDataScope` | `APP_LOCAL` \| `GLOBAL_SHARED` | ✅ | 默认数据作用域（见 §9） |
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

## 4. AtlasPlugin SPI 契约

```ts
import type { AtlasPlugin, PluginEnvironment } from '@atlas/types'

const plugin: AtlasPlugin = {
  type: 'my-plugin',            // 必填，全局唯一，与 manifest.pluginType 一致
  name: '我的插件',
  describe: '插件说明',
  defaultDataScope: 'APP_LOCAL',
  scopeOverrideAllowed: true,   // 可选：是否允许实例级覆盖作用域（仅 SHARED → LOCAL）

  /** 可选：应用删除时级联清理插件表（配合 schema.sql 建表） */
  cleanupTables: () => [{ table: 'my_plugin_item', column: 'app_id' }],

  /** 可选：数据集内容渲染源（见 §8） */
  datasetSource: () => ({
    render: async (env) => JSON.stringify(payload),
  }),

  /** 可选：声明式数据集注册（见 §8，推荐） */
  datasets: () => [
    {
      key: 'my-data',
      name: '我的数据集',
      sensitivity: 'INTERNAL',
      render: async (env) => JSON.stringify(payload),
    },
  ],

  /** 可选：REST 端点（见 §7） */
  endpoints: () => [
    { method: 'GET', path: 'list', summary: '列表', handle: async (env) => [...] },
  ],

  /** 可选：实例启用时初始化（种子数据、资源准备） */
  async init(env: PluginEnvironment) {
    const rows = await env.store().get('items')
    if (!rows) { await env.store().put('items', []) }
  },

  /** 可选：暴露能力给其他插件/内核（双向 SPI，见 §6） */
  provides: () => ({
    'my-cap': {
      describe: '能力说明',
      create: (env: PluginEnvironment) => ({ /* 能力对象 */ }),
    },
  }),

  /** 可选：依赖声明（拓扑排序启用，见 §6.3） */
  dependsOn: () => [{ pluginType: 'providers', spi: 'model-gateway' }],

  /** 可选：实例销毁/平台停止时清理 */
  destroy: async () => {},
}
export default plugin
```

### 生命周期

1. **平台启动**：加载器扫描 `plugins/` 目录 → 校验 manifest（字段齐全、entry 存在、
   导出 `AtlasPlugin`、type 与 manifest 一致）→ 注册到插件注册表 → 执行插件目录 `schema.sql` 建表。
2. **实例启用**（某应用启用该插件）：`cleanupTables()` 关联的插件表已由 `schema.sql` 建好；
   `init(env)` 以该实例上下文调用（种子数据、默认配置）。
3. **运行期**：`endpoints()` 的 handler 按请求分发调用；`datasetSource()` 按调度刷新。
4. **实例销毁/停用**：`destroy()` 调用。

## 5. PluginEnvironment API 参考

`init` / endpoint handler / `datasetSource.render` 收到同一形态的 `env`：

| 成员 | 类型 | 说明 |
|------|------|------|
| `store()` | `PluginStore` | 通用键值存储（作用域见 §9）。`get/put/remove(entityKey, entityId?)` + `list(entityId?)`；`entityId` 默认 `''` |
| `files()` | `PluginFiles` | 插件文件存储（实例隔离存储根、路径防穿越）。`write/read/remove/list` + `publish/unpublish` 公开托管 |
| `crypto()` | `PluginCrypto` | 平台密钥按插件派生的 AES-256-GCM：`encrypt(plain)/decrypt(ciphertext)`。API Key 等敏感字段必须用它加密落库 |
| `datasets()` | `DatasetPublisher` | 数据集发布：`publish(key,name,sensitivity,json)`（内容哈希驱动版本）、`refresh(key)`（重渲染 + 同步资产/凭证）、`upsertSecret/deactivateSecret` |
| `datasetSource()` | `DatasetSource \| null` | 兼容渲染源（见 §8）；声明了 `datasets()` 时刷新优先用注册项 |
| `ops()` | `Ops` | 操作审计日志：`log(level,msg,detail?)` / `info` / `warn` / `error` |
| `info/warn/error(message)` | void | 插件运行日志（应用维度） |
| `config()` | `Record<string,unknown>` | 实例配置 |
| `updateConfig(config)` | Promise | 更新实例配置 |
| `instance()` | `PluginInstanceContext` | `{ appId, instanceId, dataScope }` |
| `spi()` | `T \| null` | 双向 SPI 解析：`spi<T>(pluginType, namespace, targetAppId?)`（见 §6） |

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

## 6. 插件双向 SPI（provides / dependsOn / env.spi()）

§5 的单向 SPI 是插件调用**平台核心能力**；双向 SPI 让**插件之间**互通能力：
**提供方**用 `provides()` 暴露能力命名空间，**消费方**用 `env.spi()` 解析调用，
`dependsOn()` 声明依赖使平台按拓扑顺序启用（被依赖方先启用，环检测拒绝）。

### 6.1 提供方：provides()

`AtlasPlugin.provides()` 返回 `namespace → 能力工厂` 映射，工厂 `create(env)` 返回能力对象：

```ts
import type { ModelGatewaySpi } from '@atlas/types/spi/model-gateway'

provides: () => ({
  'model-gateway': {
    describe: 'OpenAI 兼容供应商对话网关（密钥由 providers 保管，消费方无需感知）',
    version: '1.0.0', // 可选：能力契约版本（破坏性变更时提升，消费方可经 minVersion 约束）
    create: (env: PluginEnvironment): ModelGatewaySpi => ({
      async listProviders() { /* 经 env.store() 读取供应商配置 */ },
      async chat(req) { /* 调用 OpenAI 兼容 /chat/completions，Key 用 env.crypto() 解密 */ },
    }),
  },
}),
```

- **能力接口放 `packages/types/src/spi/`**（如 `model-gateway.ts`）：提供方 `create(env)` 的返回类型与消费方 `env.spi<T>()` 的类型参数共享同一接口。运行时无跨插件 import（插件是动态 import 隔离的），仅编译期共享类型。
- 接口需附文档注释：语义、入参出参约束、密钥处理约定。

### 6.2 消费方：env.spi()

```ts
const gw = env.spi<ModelGatewaySpi>('providers', 'model-gateway')
if (!gw) { /* 提供方未启用或能力不可用 */ }
const list = await gw.listProviders()
const res = await gw.chat({
  providerId: list[0].id, model: 'deepseek-chat',
  messages: [{ role: 'user', content: '你好' }],
})
```

`env.spi<T>(pluginType, namespace, targetAppId?) => T | null`：

- 缺省以当前实例 `appId` 作为消费方上下文；`targetAppId` 可显式指定消费方作用域。
- **作用域匹配**：本 app 本地覆盖实例优先（`APP_LOCAL`），其次全局共享实例（`GLOBAL_SHARED`，
  任意 app 可解析）；`APP_LOCAL` 实例仅同 app 可解析。
- 返回 `null` 的情形：提供方未启用、命名空间不存在、能力构建抛错（平台已隔离，不冒泡）。
- **惰性求值 + 缓存**：首次解析才构建提供方 env 并 `create()` 能力对象，此后同实例复用；未消费的能力不产生开销。

### 6.3 依赖声明：dependsOn()

```ts
dependsOn: () => [
  { pluginType: 'providers', spi: 'model-gateway' }, // 精确到命名空间
  // 或仅声明插件级依赖：{ pluginType: 'prompts' }
],
```

- 启用实例时平台按 `dependsOn` 做**拓扑排序**（被依赖方先启用），保证 `init(env)` 里 `env.spi()` 已可解析。
- **环检测**：A↔B 互相依赖（直接或传递）时平台拒绝启用并记日志，不静默失败。
- 依赖仅影响启用顺序；`env.spi()` 解析在运行期随时进行，热更新后自动重建。

### 6.4 生命周期与热更新

| 时机 | 平台行为 |
|------|----------|
| 实例启用（enable） | 注册该实例 `provides()`（`GLOBAL_SHARED` 多应用启用时引用计数） |
| 实例删除（delete） | 注销该实例 SPI（引用计数归零才真正移除） |
| 插件卸载（unload） | 注销该插件全部作用域 SPI |
| 插件热替换（reload） | 旧版卸载清除 → 新版加载后对已启用实例重建 SPI |

> 消费方**不要**在模块顶层缓存 `env.spi()` 的结果（插件可能被卸载重载）；在 `init` 或端点 handler 内解析最稳妥。

### 6.5 安全与约定

- SPI 是插件间信任边界：提供方必须校验入参；消费方把 SPI 返回值视为平台能力同等可信。
- 敏感数据（API Key 等）由提供方用 `env.crypto()` 加密保管，能力接口不暴露明文
  （`model-gateway` 即此模式：只暴露调用，密钥不落消费方）。
- 命名空间建议 `kebab-case` 且全局唯一（与插件类型同一命名空间规则）。
- 官方参考：提供方 `plugins/providers/src/index.ts`（`provides()` 暴露 model-gateway）、
  消费方示例见 §6.2。

## 7. 端点（endpoints）规范

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

### 对外开放（数据面暴露）

`endpoints()` 声明的端点**默认仅管理面可用**（插件面板交互，数据面不对消费应用暴露）。若要对外提供数据面接口，给端点加 `public: true`：

```ts
// 对外配置接口：属主应用可经数据面读取
{
  method: 'GET', path: 'config', summary: '对外配置',
  public: true, sensitivity: 'INTERNAL',
  handle: async (env) => ({ ... }),
},
```

- `public?: boolean`：是否对外开放（数据面可访问）。默认 `false` = 仅管理面。
- `sensitivity?: 'PUBLIC' | 'INTERNAL' | 'SECRET'`：仅 `public` 生效，默认 `PUBLIC`。`INTERNAL`/`SECRET` 数据面仅属主应用可读。
- 数据面（对外开放）消费入口（**破坏性变更，消费方需同步**）：

  ```text
  GET /api/v1/app/{appId}/plugins/{pluginType}/{apiToken}/ep/{method}/{path}
  ```

  其中 `{apiToken}` 为平台按插件公开端点生成的防穷举 token（实例启用时派生，停用/卸载自动注销）。非 `public`、未启用或 token 不匹配一律 404（防探测）。
- 对外公开的接口会进入**接口管理页（对外接口目录）**，可启停、查看调用统计；插件面板内部交互接口不在该目录、不受启停规则约束。

- `handle(env, pathParams, body)`：`pathParams` 为 `{param}` 解析结果（字符串）；
  `body` 为请求体（JSON 对象或数组，未传为 `undefined`）。

### 返回包装

- handler 的**返回值**即接口 `data`，平台统一包装为 `{ code: 0, message: 'ok', data }`。
- handler **抛错**（`throw new Error(...)`）→ 平台统一包装为失败响应 `{ code: 1, message }`，HTTP 400/500 语义由平台处理。

### multipart 上传与二进制下载

- 请求为 `multipart/form-data` 时，`body = { fields: {...}, files: [{ originalname, buffer }] }`。
- handler 返回 `{ $binary: <base64 字符串 | Buffer>, $mime: 'application/pdf', $filename: 'a.pdf' }`
  时，平台直接以二进制流响应（下载）。**小文件**可返回 base64 字符串；**大文件**直接返回
  `Buffer`（如 `env.files().read()` 的结果），避免 base64 全量往返的内存与 CPU 翻倍。

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
    return { $binary: buf, $mime: 'application/octet-stream', $filename: p.name }
  },
},
```

## 8. 数据集（插件注册数据源）

插件可向平台**声明注册数据集**：平台在实例启用（创建/恢复）与启动补同步时自动创建数据集，
消费方通过平台统一的数据集接口（`/api/v1/datasets/{token}/...`）+ 密级管理（PUBLIC/INTERNAL/SECRET、
授权白名单、审计、信封加密）访问——插件无需再暴露自己的对外接口。

### 声明注册（推荐）

`AtlasPlugin.datasets()` 返回注册项数组：

```ts
datasets: () => [
  {
    key: 'providers-config',                 // datasetKey，插件内唯一
    name: '供应商配置',
    sensitivity: 'SECRET',                   // 默认敏感度；管理面可覆盖（密级管理）
    refreshMode: 'MANUAL',                   // 或 'SCHEDULED'（配 refreshIntervalSeconds）
    render: async (env) => JSON.stringify({...}),      // 内容 JSON 字符串；null 跳过
    secrets: async (env) => ({ 'keyName': plaintext }), // 可选：SECRET 级敏感凭证（自动对齐，删除项自动停用）
    assets: async (env) => [{ path: 'icons/x.svg', mime: 'image/svg+xml' }], // 可选：资产清单
    assetSource: async (env, path) => Buffer | null,    // 可选：按 path 懒加载资产字节（core 不落盘）
  },
]
```

- **内容**：内容哈希驱动版本——`render` 结果未变不 bump 版本（消费方 304 缓存不失效）。
- **敏感凭证**：`secrets` 仅对 SECRET 级数据集生效；平台自动录入新增、停用已移除的 key，
  消费方经 `/api/v1/datasets/{token}/secrets` 取用（Bearer + 白名单 + 逐次审计）。
  管理面把敏感度降为非 SECRET 时 secrets 接口自动失效（Key 不泄露）。
- **资产**：`assets` 清单写入数据集（meta.assetCount 可见），字节由 `assetSource` 懒加载，
  与内容共享同一密级/授权/审计/限流；资产清单变化自动 bump 版本。
  示例参考：providers（内置图标读插件目录、自定义图标从 store 解码）、
  model-files（`env.files().read()` 直读实例文件存储，零复制）。
- **管理面保护**：插件注册数据集在管理面**内容锁定**——不可删除、不可编辑内容/名称/描述，
  仅可调整敏感度；授权白名单与审计查看保留。数据归属插件，同步永远以插件声明为准。

### 数据变更即时同步

数据变更后调用 `env.datasets().refresh(key)`，平台重新 `render` → 按需发布内容
（哈希变则版本+1）→ 同步资产清单 → 对齐敏感凭证：

```ts
await env.store().put('providers', list)      // 修改业务数据
void env.datasets().refresh('providers-config') // 同步数据集（fire-and-forget）
```

`refreshMode: 'SCHEDULED'` 时平台按 `refreshIntervalSeconds` 定时执行同一流程。

### 运行时发布（兼容路径）

`env.datasets()` 提供按需发布 API（`publish/refresh/upsertSecret/deactivateSecret`），
内容哈希驱动、返回是否版本变更；`datasetSource().render(env)` 为单渲染源兼容入口
（刷新路径优先使用 `datasets()` 注册项，无注册项时回退 `datasetSource`）。

> 参考实现：`plugins/providers/src/index.ts`（SECRET 配置 + secrets + 图标资产）、
> `plugins/model-files/src/index.ts`（元数据 + 全文件资产懒加载）。

## 9. 数据作用域（DataScope）

| 作用域 | store/files 语义 |
|--------|------------------|
| `APP_LOCAL` | 每应用一份：存储以 `appId` 维度隔离 |
| `GLOBAL_SHARED` | 全局一份：所有应用共享（`instance_id=0`），如供应商配置 |

- `defaultDataScope` 决定默认行为；`scopeOverrideAllowed: true` 时实例允许
  覆盖为更小作用域（仅 `SHARED → LOCAL` 方向）。
- `env.instance()` 返回当前上下文的 `{ appId, instanceId, dataScope }`，
  需要区分实例时（如多实例各自配置）用 `store(entityKey, String(instanceId))`。

## 10. 前端 UI 面板规范

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

```text
面板组件 → import { get, post, put, del } from '@atlas/runtime'
        → GET/POST/PUT/DELETE /api/apps/{appId}/plugins/{type}/ep/...
面板 API 地址自动携带管理 token（AUTH_TOKEN_KEY 由平台注入）。
```

## 11. 加载与热更新规则

- **扫描目录**：默认 `plugins/`（含 `packages/` 的仓库根）；`ATLAS_PLUGINS_DIR` 覆盖。
- **跳过规则**：目录名 `template` 恒跳过（模板不算插件）。
- **校验失败**（manifest 缺字段 / entry 不存在 / 未导出 AtlasPlugin /
  type 与 manifest 不一致）：记录 warning 跳过，不影响平台与其他插件。
- **热更新**：watcher 轮询目录哈希（dirHash），检测到变化约 **10s** 内重载；
  加载用 cache-busting URL（`?v={dirHash}`）绕过 Node 模块缓存。
  > 因此插件内 `import.meta.url` **会带 query**，取相对路径必须先 `.split('?')[0]`
  > （参考 providers 的 `loadBuiltinReference`），否则 `fileURLToPath` 会抛错。
- **开发期**：改后端源码 → 等待 10s 热重载（或重启服务）；
  改前端面板 → `npm run ui:build` 后同样热更新（哈希 entry 变体）。
- 加载失败**隔离**：单个插件崩溃不影响平台运行。

## 12. 安全规范（必读）

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

## 13. 开发流程（从模板起步）

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

## 14. 官方插件速览（示例参考）

| 插件 | type | 作用域 | 可学习点 |
|------|------|--------|----------|
| providers | 供应商管理 | GLOBAL_SHARED | 种子数据 init、crypto 加密、CRUD 端点、UI 面板（ep+store 全链路）、**双向 SPI 提供方**（`provides()` 暴露 model-gateway，带 version，见 §6） |
| prompts | 提示词管理 | APP_LOCAL | 渲染端点、版本历史、APP_LOCAL 作用域、增删改 ops 审计 |
| model-files | 模型文件 | APP_LOCAL | files() 存储 + publish 公开托管 + 元数据表、**logTables() 声明插件日志表** |
| machine-monitor | 机器监控 | GLOBAL_SHARED | 系统级插件（system-menu 侧边菜单 + console 卡片）、Node 内置模块指标采集、滚动历史、datasetSource 定时采样 |
| template | 模板 | - | 最小骨架（加载器恒跳过） |

## 15. FAQ

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
