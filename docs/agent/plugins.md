# 插件开发编码规范（plugins/*）

适用范围：`plugins/**` 的插件开发者。本规范聚焦**编码约定与红线**；契约细节（字段、API 签名、slot 模型）见 [docs/plugin-development.md](../plugin-development.md)，本规范不重复。

> 核心原则：**插件是被动态 import 隔离的运行时单元，状态必须显式声明、生命周期必须对称、对外信任边界必须自守**。

---

## 1. 目录与声明规范

- 目录结构、manifest 字段、`schema.sql` 约定见 `plugin-development.md` §2/§3，此处不赘述。
- **命名**：`type` / `pluginType` / SPI `namespace` 一律 kebab-case、全局唯一；`manifest.pluginType` 与 `src/index.ts` 的 `AtlasPlugin.type` **必须严格一致**（不一致加载器直接跳过）。
- **建表只走目录 `schema.sql`**：禁止在 `src/index.ts` 内联 DDL；DDL 必须幂等（`IF NOT EXISTS`）。

## 2. 后端插件编码约定

### 2.1 数据存储三选一（按数据形态）

| 数据形态 | 用 | 说明 |
|----------|-----|------|
| 结构化配置/列表 | `env.store()` | JSON 序列化，作用域由 dataScope 决定 |
| 二进制/大文件 | `env.files()` | 实例隔离存储根，路径防穿越 |
| API Key / Secret | `env.crypto()` | 平台派生 AES-256-GCM，**禁止明文落库** |

- 敏感字段（API Key、Secret、Token）**一律** `env.crypto().encrypt()` 落库；`env.crypto()` 派生自平台 `ATLAS_ENC_KEY`，生产未配置时平台已拒绝启动（闸门）。

### 2.2 端点（endpoints）约定

- **每个 endpoint 必须校验入参**：`body` 与 `pathParams` 的空值、非法 id、越界（limit/范围）都要显式校验，失败 `throw new Error(...)`。
- **返回值即 `data`**，平台统一包 `{code,message,data}`；不要自行拼装响应对象。
- **错误抛 `Error`** 即可：管理面返回可读原因，数据面平台自动脱敏——**不要在 message 里拼 SQL/密钥/绝对路径**。
- 小文件下载用 `$binary`（base64 字符串或 `Buffer`）；**大文件（>几 MB）用 `env.files().publish()`** 走平台 `/api/files/{token}/download`（自带 304/限流/审计/防穷举），不要用 `$binary` 硬扛大文件、更不要自建公开下载端点。

```ts
// ✅ 校验 + 抛错
handle: async (env, params, body) => {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) throw new Error('非法 id')
  const row = list.find((p) => p.id === id)
  if (!row) throw new Error(`不存在: ${id}`)
  ...
}

// ❌ 直接信任入参
handle: async (env, params) => { return list[Number(params.id)] }
```

### 2.3 审计

- 关键增删改操作必须 `env.ops().info/log`（或 `env.info/warn/error`）写审计，方便运维台跨应用定位。
- 分级：普通成功 `info`、删除/危险操作 `warn`、失败 `error`。

## 3. 生命周期红线（P0）

> 这些是插件开发者必须理解并遵守的契约，违反会在热更新/多实例下产生难排查的状态错乱。

- **P-01 `init(env)` 是 per-instance，必须幂等**：同一插件在多个应用（或多次启用）都会调用 `init`，里面只能做「读→判断→补种子」这类幂等初始化，**不得假设全局只跑一次**。
- **P-02 `destroy()` 是插件级，只能清理插件级资源**：`destroy()` 无 `env`、无实例上下文，**禁止**在 `destroy` 里对「某个实例」的数据/订阅做假设。实例级清理应通过 `env.events()` 返回的退订函数（随实例 dispose 自动清理）。
- **P-03 不要在模块顶层持有可变状态**：插件热替换时旧模块闭包不会被释放，模块顶层的可变变量会在新旧版本间串扰。需要跨请求共享的状态存 `env.store()`（DB），不要存模块变量。
- **P-04 不要缓存 `env.spi()` 的返回值到模块顶层**：提供方可能被卸载/热重载，缓存的能力对象会失效。在 `init` 或 endpoint handler 内**每次解析**（平台内部有缓存，代价可忽略）。
- **P-05 `init` 里订阅事件用 `env.events().on`**：返回的退订函数由平台在实例销毁时自动调用；**不要**在模块顶层用裸 `eventBus.on` 订阅。
- **P-06 插件内相对资源用 `import.meta.url`**：加载器用 `?v={hash}` cache-busting，`import.meta.url` 会带 query，取相对路径必须 `.split('?')[0]`（参考 providers 的 `loadBuiltinReference`）。

```ts
// ✅ 幂等 init
async init(env) {
  const list = await env.store().get<Provider[]>('providers')
  if (!list || list.length === 0) {
    await env.store().put('providers', seed)
  } else {
    await migrate(env, list)
  }
}

// ❌ 模块顶层可变状态（热替换串扰）
let cache: Provider[] = []
```

## 4. 双向 SPI 约定

- **能力接口放 `packages/types/src/spi/`**：提供方 `create(env)` 返回类型与消费方 `env.spi<T>()` 类型参数共享同一接口；运行时无跨插件 import，仅编译期共享。
- **`provides()` 的能力工厂必须带 `version`**（`PluginSpiExport.version`），破坏性变更时提升；消费方用 `env.spi(..., { minVersion })` 约束。
- **提供方必须校验入参**：SPI 是插件间信任边界，`chat/listProviders` 等能力对象内的入参校验与 endpoint 同等对待。
- **敏感数据由提供方用 `env.crypto()` 保管**，能力接口只暴露「调用」不暴露「明文密钥」（`model-gateway` 即此模式）。
- **消费方把 `env.spi()` 返回值视为可能为 `null`**：提供方未启用/不可用/版本不满足都会返回 `null`，必须判空后再用。
- namespace 命名 kebab-case、全局唯一；`dependsOn` 尽量精确到 `spi` 字段（`{ pluginType, spi }`），只声明插件级依赖时用 `{ pluginType }`。

## 5. 数据集约定

- **推荐 `datasets()` 声明注册**，而非运行时 `env.datasets().publish()`：声明式让平台在实例启用/启动补同步时自动创建、管理面内容锁定、密级管理统一。
- **`secrets` 仅对 `SECRET` 级数据集生效**：平台自动录入新增、停用已移除 key；把敏感度降级为非 SECRET 时 secrets 接口自动失效——**密钥类数据必须走 `secrets`，不要塞进 `render` 的内容 JSON**。
- **数据变更后 `void env.datasets().refresh(key)`** 即时同步（fire-and-forget，失败不阻塞主流程）。
- 资产字节用 `assetSource` 懒加载（core 不落盘），清单变化自动 bump 版本；大资产优先读 `env.files()` / 插件目录，不要在 `assetSource` 里做重计算。

## 6. 前端 UI 插件约定

- **`main.js` 必须 `export default { mount(el, ctx) { ...; return () => unmount } }`**：返回清理函数是硬性要求，否则插件卸载/切 Tab 会内存泄漏。
- **`ctx = { appId, pluginType, mode, refresh }`**：`mode`（`console`/`app-space`/`system-menu`）决定渲染形态；`refresh()` 触发父容器刷新。
- **`system-menu` 无 `appId`**：系统级（`GLOBAL_SHARED`）插件的面板拿不到 appId，需自行取任一已启用实例作数据通道（machine-monitor 模式）。
- **不打包运行时依赖**：`vue`/`element-plus`/`@element-plus/icons-vue`/`@atlas/runtime` 在 `vite.config.mjs` 的 `EXTERNAL` 集合里，产物只含业务代码；API 调用统一 `import { get, post, put, del } from '@atlas/runtime'`。
- **构建产物 `ui/` 一并提交**：`ui/` 是分发源（含 `entry.<hash>.js` + `manifest.json`），改完 `ui-src` 必须 `npm run ui:build` 后提交 `ui/`。

## 7. 反模式清单（Code Review 拦截项）

| ❌ 反模式 | ✅ 正确做法 |
|-----------|-------------|
| `src/index.ts` 内联 DDL | 目录 `schema.sql`（幂等 `IF NOT EXISTS`） |
| 明文 API Key 落 store | `env.crypto().encrypt()` |
| 自建公开下载端点 | `env.files().publish()` |
| 模块顶层缓存 `env.spi()` 结果 | handler/init 内每次解析 |
| 模块顶层可变状态 | 状态存 `env.store()` |
| `init` 非幂等（假设只跑一次） | 幂等初始化 |
| endpoint 不校验入参 | 显式校验 body/pathParams |
| 错误 message 拼密钥/SQL/路径 | 抛语义化 `Error` |
| mount 不返回 unmount | 返回清理函数 |
| 打包 vue/element-plus 进插件产物 | external + `@atlas/runtime` |
| 只改 `ui-src` 不提交 `ui/` | `ui:build` 后提交 `ui/` |

## 8. 测试与验证清单

- **后端插件**：推荐为纯逻辑（渲染、迁移、路径匹配、SVG 消毒）写单测；至少手动验证三类场景——首次启用（种子）、重复启用（幂等）、热重载（改代码后 10s 生效且状态不串）。
- **前端插件**：`npm run ui:build` 后确认 `ui/manifest.json` 的 entry 哈希更新、`slots[].entry` 同步；刷新页面验证 Tab/卡片出现。
- **安全自查**：密钥是否加密、路径是否只用 `env.files()` 返回值、公开下载是否走 `publish`、入参是否校验、审计是否落 `ops()`。

## 9. 参考实现

| 插件 | 可学习点 |
|------|----------|
| `providers` | 幂等 `init` + 迁移、`crypto` 加密、SECRET 数据集 + `secrets`、双向 SPI 提供方（`provides` + `version`）、`import.meta.url.split('?')[0]` |
| `prompts` | APP_LOCAL 作用域、CRUD 端点 + ops 审计、版本历史 |
| `model-files` | `files()` + `publish` 公开托管、`logTables()` 声明日志表、资产懒加载 |
| `machine-monitor` | system-menu 全局面板、滚动历史、`datasetSource` 定时采样、跨平台尽力而为采集 |
| `template` | 最小骨架（加载器跳过，复制起步用） |
