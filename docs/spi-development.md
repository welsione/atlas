# Atlas 核心功能 SPI 开发规范

Atlas 平台除插件体系外，**核心功能**（应用空间、数据集、监控、安全、平台信息）也全部通过
**SPI（Service Provider Interface，服务提供者接口）** 向插件开放，让插件对系统的集成能力更强。

本规范定义这些 SPI 的契约：插件如何**订阅平台生命周期事件**、如何通过**能力门面**调用核心服务、
如何**声明式接入**监控 / 安全 / 级联清理 / 日志保留。

配套文档：[插件开发规范](./plugin-development.md)（插件本身的加载 / UI / 端点 / 数据集机制）。

---

## 1. SPI 总览

Atlas 的核心功能 SPI 分三层，全部向后兼容、只追加：

```text
┌────────────────────────────────────────────────────────────────────┐
│ 插件（plugins/<type>/src/index.ts 导出 AtlasPlugin）                │
│                                                                    │
│  ① 能力门面（读/写核心服务）   ② 事件订阅（被动响应）   ③ 声明式接入   │
│     env.apps()                env.events().on(...)    schema.sql    │
│     env.monitor()                                         补表      │
│     env.security()                                    cleanupTables()│
│     env.platform()                                     级联清理      │
│                                                       logTables()   │
│                                                          日志保留    │
│                                                       publicUrls()  │
│                                                          公开端点    │
│                                                       resourceName()│
│                                                          监控资源名   │
└────────────────────────────────────────────────────────────────────┘
        │               │                     │
        ▼               ▼                     ▼
┌────────────────────────────────────────────────────────────────────┐
│ 平台核心（packages/core/src）                                        │
│  · SpiModule（@Global）：PlatformEventEmitter / ExtensionRegistry /  │
│    门面（App/Monitor/Security/Platform Facade）/ SchemaBootstrap    │
│  · 核心服务按需 emit 事件；硬编码点改为经 ExtensionRegistry 聚合      │
└────────────────────────────────────────────────────────────────────┘
```

- **能力门面**：插件主动调用核心服务（读应用、读监控、管 IP、查平台信息）。
- **事件订阅**：插件被动响应平台生命周期变更（应用/数据集/插件创建、更新、删除）。
- **声明式接入**：插件声明能力，平台在合适时机自动执行（建表、级联清理、日志清理、公开放行、监控命名）。

所有 SPI 类型定义在共享类型包 `packages/types/src/index.ts`，插件与平台共用，开发期获得完整类型提示。

---

## 2. 事件订阅（EventBus）

平台基于 `@nestjs/event-emitter`（成熟库 EventEmitter2）提供类型化事件总线。
核心服务在生命周期变更时 `emit`，插件经 `env.events()` 订阅。

### 2.1 事件类型表

| 事件 | 载荷 | 触发时机 |
|------|------|---------|
| `app.created` | `App` | 创建应用 |
| `app.updated` | `App` | 更新应用（凭证轮换等） |
| `app.activated` | `App` | 激活应用 |
| `app.revoked` | `App` | 吊销应用 |
| `app.deleted` | `{ appId }` | 删除应用（级联清理后） |
| `app.secret.rotated` | `{ appId }` | 应用凭证轮换 |
| `dataset.created` | `Dataset` | 创建数据集 |
| `dataset.updated` | `Dataset` | 更新数据集（含版本/密级变更） |
| `dataset.published` | `Dataset` | 数据集内容发布（版本+1） |
| `dataset.deleted` | `{ appId, datasetId }` | 删除数据集 |
| `plugin.loaded` | `{ pluginType }` | 插件注册 |
| `plugin.unloaded` | `{ pluginType }` | 插件卸载 |
| `plugin.enabled` | `{ appId, pluginType, instanceId }` | 启用插件实例 |
| `plugin.disabled` | `{ appId, pluginType, instanceId }` | 停用插件实例 |
| `plugin.deleted` | `{ appId, pluginType }` | 删除插件实例 |

### 2.2 订阅 API

```ts
// 在插件 init(env) 或端点 handler 内
env.events().on('app.created', (app) => {
  env.info(`新应用创建：${app.name}（${app.appId}）`)
})

// 返回退订函数
const off = env.events().on('plugin.deleted', () => { /* ... */ })
off() // 手动退订

env.events().off('app.created', handler) // 或按 handler 退订
```

### 2.3 订阅生命周期

- **init 订阅自动清理**：在 `init(env)` 中 `env.events().on(...)` 的订阅，由平台在实例销毁（`deleteInstance`）
  或插件卸载时**自动退订**，插件无需手动清理。
- **临时 env 订阅**：在端点 handler 里拿到的 `env` 是临时构建的，其订阅由插件在 `destroy()` 中自行管理
  （或直接使用返回的退订函数）。
- **异步监听器**：`emit` 为 fire-and-forget，异步监听器不阻塞发射方，单个监听器异常隔离不影响其他。

### 2.4 示例：删除应用时清理外部系统

```ts
async init(env) {
  env.events().on('app.deleted', async ({ appId }) => {
    // 同步清理本插件在该应用的外部资源（如第三方账号）
    await env.store().remove(`integration-${appId}`)
  })
}
```

---

## 3. 能力门面（PluginEnvironment）

`PluginEnvironment` 在原有 `store/files/crypto/datasets/ops/config/instance` 基础上，新增 4 个门面：

| 门面 | 方法 | 说明 |
|------|------|------|
| `apps()` | `PluginApps` | 应用空间读取/创建：`list/get/create` |
| `monitor()` | `PluginMonitor` | 数据面监控聚合读取 + 自定义指标注册 |
| `security()` | `PluginSecurity` | 公开前缀注册 / IP 规则管理 |
| `platform()` | `PluginPlatform` | 平台版本、安全子集配置、元信息 |
| `events()` | `PluginEvents` | 平台生命周期事件订阅（见 §2） |

### 3.1 apps() — 应用门面

```ts
interface PluginApps {
  list(): App[]
  get(id: number | string): App
  create(name: string, description?: string, pluginTypes?: string[]): CreateAppResult
}
```

```ts
const apps = env.apps()
const list = apps.list()                       // 全部应用
const app = apps.get(list[0].id)
const created = apps.create('新空间', 'desc')   // 返回 { app, secret }
```

### 3.2 monitor() — 监控门面

```ts
type PluginMonitorRange = '24h' | '7d' | 'all'

interface PluginMetricDef {
  key: string
  collect(env: PluginEnvironment): unknown | Promise<unknown>   // 采集回调
  kind?: 'number' | 'string' | 'json'                           // 序列化格式
}

interface PluginMonitor {
  overview(range?): Record<string, number>
  endpoints(range?): Array<Record<string, unknown>>
  topResources(range?, limit?): Array<Record<string, unknown>>
  topIps(range?, limit?): Array<Record<string, unknown>>
  topApps(range?, limit?): Array<Record<string, unknown>>
  series(range?): Array<Record<string, unknown>>
  recent(limit?): Array<Record<string, unknown>>
  registerMetric(def: PluginMetricDef): void
}
```

```ts
const mon = env.monitor()
const overview = mon.overview('24h')          // 当前应用数据面调用聚合
mon.registerMetric({ key: 'my_plugin_errors', collect: () => 42, kind: 'number' })
```

> `monitor()` 绑定调用方实例的 appId；`registerMetric` 注册的自定义指标由平台按采集周期汇聚。

### 3.3 security() — 安全门面

```ts
interface PluginSecurity {
  publicUrl(prefix: string): void   // 注册公开 URL 前缀（SecurityMiddleware 放行）
  blockIp(ip: string): void
  unblockIp(ip: string): void
  isBlocked(ip: string): boolean
}
```

```ts
const sec = env.security()
sec.publicUrl('/api/health/')         // 该前缀不再要求管理认证
sec.blockIp('203.0.113.7')
sec.unblockIp('203.0.113.7')
```

### 3.4 platform() — 平台门面

```ts
interface PluginPlatform {
  version: string
  config(): Record<string, unknown>                 // 安全子集配置（不含任何密钥）
  meta(): { platform: string; version: string; authEnabled: boolean; pluginsDir: string }
}
```

```ts
const meta = env.platform().meta()
env.info(`运行于 ${meta.platform} v${meta.version}，认证${meta.authEnabled ? '开启' : '关闭'}`)
```

---

## 4. 声明式扩展点（AtlasPlugin 追加钩子）

下为 `AtlasPlugin` 新增的可选钩子（原有 `datasetSource/datasets/endpoints/init/destroy` 不变；建表不再走钩子，改由目录 `schema.sql` 文件自动发现）：

```ts
interface AtlasPlugin {
  // ...原有
  /** 应用删除时级联清理插件表（AppRepository.deleteCascade 事务内执行）。 */
  cleanupTables?: () => PluginCleanupTable[]

  /** 全局日志保留表（LogCleanupService 每小时清理）。 */
  logTables?: () => Array<{ table: string; column: string }>

  /** 注册公开 URL 前缀（SecurityMiddleware 放行）。 */
  publicUrls?: () => string[]

  /** 监控聚合的插件资源类型显示名解析。 */
  resourceName?: () => PluginResourceNameResolver[]
}

interface PluginCleanupTable {
  table: string
  column?: string   // 应用外键列，默认 'app_id'
}

interface PluginResourceNameResolver {
  resourceType: string
  nameOf(resourceId: number): string | null   // 同步
}
```

### 4.1 schema.sql 文件 — 启动建表（框架级约束）

插件自有表统一放在插件目录的 **`schema.sql`** 文件（框架自动发现、插件零代码）。
平台在插件加载完成后（`onApplicationBootstrap` / `reloadAll`）自动执行。**必须幂等**
（`CREATE TABLE IF NOT EXISTS …`），按 `;` 切分逐语句执行，单条失败仅记录 warning，不影响平台与其他插件。

```sql
-- plugins/my-plugin/schema.sql
CREATE TABLE IF NOT EXISTS my_plugin_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  name TEXT NOT NULL
);
```

> 约定：建表 SQL **一律放 schema.sql**，禁止内联在 `src/index.ts` 里（`AtlasPlugin.schemaDdl` 钩子已移除）。

### 4.2 cleanupTables() — 应用删除级联清理

应用被删除时，平台在 `deleteCascade` 的**同一事务**内先执行插件声明的清理：
`DELETE FROM <table> WHERE <column> = appId`。用于清理插件自己的表，防止孤儿数据。

```ts
cleanupTables: () => [{ table: 'my_plugin_item', column: 'app_id' }]
```

> ⚠️ 不得声明平台内置表（datasets / secrets / plugin_store 等），内置表已由平台处理。

### 4.3 logTables() — 日志保留清理

平台 `LogCleanupService` 每小时清理各日志表过期行（默认保留 30 天）。插件自己的日志表可声明加入清理：

```ts
logTables: () => [{ table: 'my_plugin_log', column: 'created_at' }]
```

### 4.4 publicUrls() — 公开端点放行

插件自有 HTTP 端点若需对外公开（不要求管理认证），声明前缀即可被 `SecurityMiddleware` 放行：

```ts
publicUrls: () => ['/api/health/']
```

> 默认公开前缀（`/api/files /api/auth /api/v1 /_pluginui`）始终有效；插件前缀与内置前缀合并。

### 4.5 resourceName() — 监控资源命名

平台监控聚合（`top-resources` / `recent`）目前内置 `DATASET` / `MODEL_FILE` 两种资源类型。
插件自己写入 `api_access_logs` 的资源类型（如通过自定义数据面端点）可声明显示名解析器，让资源名出现在监控：

```ts
resourceName: () => [
  { resourceType: 'CUSTOM_RES', nameOf: (id) => `资源#${id}` },
]
```

---

## 5. 监控扩展

- **读取聚合**：`env.monitor().overview()/endpoints()/topResources()/...` 读取当前应用的数据面调用聚合。
- **自定义指标**：`env.monitor().registerMetric({ key, collect, kind })` 注册指标采集，由平台汇聚。
- **资源命名**：`resourceName()` 让插件资源类型进入 `top-resources` / `recent` 聚合时显示可读名称。

## 6. 安全扩展

- `env.security().publicUrl(prefix)` 与 `publicUrls()` 声明式钩子，均把前缀加入 `SecurityMiddleware` 放行集合。
- `env.security().blockIp()/unblockIp()/isBlocked()` 管理 IP 黑名单（`ip_rules` 表）。

## 7. 级联清理扩展

应用删除时，`AppRepository.deleteCascade` 在事务内依次执行：

1. 插件 `cleanupTables()` 声明的清理（先于内置表，避免外键冲突）。
2. 内置数据集、授权、日志、凭证、应用本身清理。

插件声明自己的表即可获得与应用生命周期一致的清理保证。

## 8. 安全 / 兼容性要求

- **不得声明内置表/前缀/资源类型**：`cleanupTables()`/`logTables()`/`publicUrls()`/`resourceName()`
  只应声明插件自己的资源，涂抹内置资源会导致平台行为异常。
- **订阅须考虑销毁**：`init` 中订阅由平台自动清理；临时 env 订阅需插件自行管理。
- **敏感字段**：经门面读取的配置为平台安全子集（**不含 encKey 等任何密钥**）。
- **幂等**：`schema.sql` 中建表必须幂等（`CREATE TABLE IF NOT EXISTS`）；`cleanupTables()` 应容忍表不存在（SQLite DELETE 对不存在表会报错，
  建议用 `CREATE TABLE IF NOT EXISTS` + 仅在 schema.sql 中建表）。
- **向后兼容**：所有新增 SPI 均为可选（`?.()`），未声明的插件不受影响。

## 9. 开发流程与验证

```bash
# 1. 在插件 init 订阅事件 + 调门面
async init(env) {
  env.events().on('app.created', () => env.info('有应用创建'))
  env.info(`平台 v${env.platform().meta().version}`)
}

# 2. 声明式接入（可选：schema.sql 文件 + 清理声明）
#    插件目录放 schema.sql（框架自动建表），cleanupTables 声明应用删除级联清理
cleanupTables: () => [{ table: 'my_t', column: 'app_id' }],

# 3. 验证
#    等待约 10s 热加载；创建应用 → 观察插件日志出现 '有应用创建'
#    删除应用 → 确认 my_t 中该 app 行被清理
#    平台监控 → 若写自定义资源类型，确认 top-resources 显示 resourceName
```

## 10. FAQ

- **为什么门面方法没有 appId 参数？** `monitor()` 已绑定调用方实例的 appId；`apps()/security()/platform()`
  为全局能力，无需 appId。
- **事件是同步还是异步？** `emit` 同步 fire-and-forget：同步监听器立即执行，异步监听器不阻塞发射方。
- **插件能签发数据面令牌吗？** 不能。数据面令牌（`AppTokenService`）属高敏感平台内部能力，不向插件开放；
  数据面交互请使用数据集 token（`env.datasets()`）或文件托管（`env.files().publish()`）。
- **自定义监控指标如何被采集？** `registerMetric` 注册的 `collect` 由平台按采集周期调用并汇聚；
  当前平台已内置接口监控聚合，自定义指标为增量扩展。
- **改插件声明后热更新生效吗？** 生效。`ExtensionRegistry` 每次实时遍历当前已注册插件，
  `publicUrls/logTables/cleanupTables/resourceName` 在热更新后自动反映最新声明；`schema.sql` 变更触发目录热替换，重载后重新建表。
