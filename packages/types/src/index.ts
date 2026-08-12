/**
 * @atlas/types —— 平台共享类型：DTO（后端/前端共用） + 插件 SPI 契约（开发期类型提示）。
 */

// ---------- API 响应包装 ----------
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// ---------- 应用空间 ----------
export type AppStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED'

export interface App {
  id: number
  appId: string
  name: string
  description: string
  status: AppStatus
  tokenTtlSeconds: number
  createdAt: string
  updatedAt: string
}

export interface CreateAppResult {
  app: App
  secret: string
}

export interface TokenResult {
  token: string
  expiresIn: number
}

// ---------- 插件 ----------
export type DataScope = 'APP_LOCAL' | 'GLOBAL_SHARED'

export interface PluginDef {
  id: number
  pluginType: string
  name: string
  description: string
  defaultDataScope: DataScope
  scopeOverrideAllowed: boolean
  /** 插件图标：data: URI / http(s) URL / 相对路径（icons/xxx.svg，经平台图标服务）。 */
  icon: string
  artifact: string
  artifactHash: string
  version: string
  loaded: boolean
  builtin: boolean
  createdAt: string
  updatedAt: string
}

export interface PluginInstance {
  id: number
  appId: number
  pluginType: string
  dataScope: DataScope
  configJson: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface PluginOverviewRow {
  plugin: PluginDef
  instance: PluginInstance | null
  runtimeLoaded: boolean
}

// ---------- 数据集 ----------
export type DatasetSensitivity = 'PUBLIC' | 'INTERNAL' | 'SECRET'

export interface DatasetAsset {
  path: string
  /** 字节大小（手动上传时持久化；插件懒加载资产可能未知）。 */
  size?: number
  mime: string
}

export interface Dataset {
  id: number
  appId: number
  pluginType: string
  datasetKey: string
  name: string
  description: string
  sensitivity: DatasetSensitivity
  token: string
  version: number
  contentHash: string
  contentJson: string
  assets: DatasetAsset[]
  dekWrapped: string
  refreshMode: 'MANUAL' | 'SCHEDULED'
  refreshIntervalSeconds: number | null
  lastRefreshedAt: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface DatasetCreateRequest {
  pluginType?: string
  datasetKey?: string
  name: string
  description?: string
  sensitivity?: DatasetSensitivity
  contentJson?: string
  refreshMode?: string
  refreshIntervalSeconds?: number | null
}

export interface Secret {
  id: number
  datasetId: number
  keyName: string
  secretVersion: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface DatasetMeta {
  token: string
  name: string
  sensitivity: string
  version: number
  contentHash: string
  assetCount: number
  updatedAt: string
  appId: number
}

// ---------- 模型文件 ----------
export interface ModelFileEntry {
  path: string
  sizeBytes: number
  checksum: string
}

export interface ModelFile {
  id: number
  appId: number
  name: string
  category: string
  description: string
  kind: 'FILE' | 'DIRECTORY'
  storageRoot: string
  token: string
  version: number
  contentHash: string
  downloadCount: number
  files: ModelFileEntry[]
  totalSize: number
  fileCount: number
  createdAt: string
  updatedAt: string
}

export interface DownloadLogEntry {
  ip: string
  userAgent: string
  downloadedAt: string
}

// ---------- 运维台 ----------
export interface OpsLogRow {
  id: number
  appId: number
  pluginType: string
  level: string
  message: string
  detailJson: string
  createdAt: string
}

export interface OpsLogPage {
  total: number
  page: number
  size: number
  rows: OpsLogRow[]
}

export interface OpsOverview {
  levels: Record<string, number>
  byPlugin: Array<{ pluginType: string; count: number; errors: number }>
  hourly: Array<{ bucket: string; count: number; errors: number }>
}

// =====================================================================
// 插件 SPI 契约（开发期类型提示；运行时由 manifest 声明 + 平台校验）
// =====================================================================

export interface PluginEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** ep/ 之后的路径，支持 {param} 占位。 */
  path: string
  summary: string
  handle(env: PluginEnvironment, pathParams: Record<string, string>, body: unknown): Promise<unknown> | unknown
}

export interface PluginStore {
  /** entityId 默认 ''，entityKey 为记录标识。 */
  get<T = unknown>(entityKey: string, entityId?: string): Promise<T | null>
  put(entityKey: string, value: unknown, entityId?: string): Promise<void>
  remove(entityKey: string, entityId?: string): Promise<void>
  list<T = unknown>(entityId?: string): Promise<T[]>
}

/** 插件文件存储（实例隔离存储根，路径防穿越）。 */
export interface PluginFiles {
  /** 写文件；relPath 为插件内相对路径，返回规范化后的相对路径。 */
  write(relPath: string, data: Buffer | string): Promise<string>
  read(relPath: string): Promise<Buffer | null>
  remove(relPath: string): Promise<void>
  list(): Promise<string[]>
  /** 公开托管：平台生成防穷举 token 并服务 /api/files/{token}/download|meta（304/限流/审计）。 */
  publish(relPath: string, name?: string): Promise<{ token: string; relPath: string }>
  /** 撤销公开托管。 */
  unpublish(token: string): Promise<void>
}

/** 插件密钥加密（平台密钥按插件派生的 AES-256-GCM）。 */
export interface PluginCrypto {
  encrypt(plain: string): string
  decrypt(ciphertext: string): string
}

export type DatasetPublisherSensitivity = 'PUBLIC' | 'INTERNAL' | 'SECRET'

export interface DatasetPublisher {
  /** 发布/更新数据集（内容哈希驱动版本）；返回是否发生版本变更。 */
  publish(datasetKey: string, name: string, sensitivity: DatasetPublisherSensitivity, contentJson: string): Promise<boolean>
  refresh(datasetKey: string): Promise<boolean>
  upsertSecret(datasetKey: string, keyName: string, value: string): Promise<void>
  deactivateSecret(datasetKey: string, keyName: string): Promise<void>
}

export interface DatasetSource {
  /** 渲染数据集内容（JSON 字符串）；返回 null 表示跳过本次刷新。 */
  render(env: PluginEnvironment): string | null | Promise<string | null>
}

/** 插件声明的数据集注册项：core 在实例启用时自动创建/同步，消费复用数据集接口与密级管理。 */
export interface PluginDatasetRegistration {
  /** datasetKey，插件内唯一。 */
  key: string
  name: string
  /** 默认敏感度（管理面可改）。 */
  sensitivity?: DatasetPublisherSensitivity
  refreshMode?: 'MANUAL' | 'SCHEDULED'
  refreshIntervalSeconds?: number | null
  /** 渲染数据集内容（JSON 字符串）；返回 null 表示跳过本次刷新。 */
  render(env: PluginEnvironment): string | null | Promise<string | null>
  /** 可选：随发布同步的敏感凭证（仅 SECRET 级数据集生效），keyName → 明文值。 */
  secrets?: (env: PluginEnvironment) => Record<string, string> | Promise<Record<string, string>>
  /** 可选：文件资产清单（path/mime；字节由 assetSource 懒加载，core 不落盘）。 */
  assets?: (env: PluginEnvironment) => Array<{ path: string; mime: string }> | Promise<Array<{ path: string; mime: string }>>
  /** 可选：按 path 取资产字节（懒加载）。返回 null 表示资产不可用。 */
  assetSource?: (env: PluginEnvironment, path: string) => Buffer | Uint8Array | null | Promise<Buffer | Uint8Array | null>
}

export interface Ops {
  log(level: string, message: string, detail?: Record<string, unknown>): Promise<void>
  info(message: string): Promise<void>
  warn(message: string): Promise<void>
  error(message: string): Promise<void>
}

export interface PluginInstanceContext {
  appId: number
  instanceId: number
  dataScope: DataScope
}

// =====================================================================
// 平台生命周期事件（SPI）：core 服务在生命周期变更时 emit，插件经 env.events() 订阅。
// =====================================================================

export type PlatformEventName =
  | 'app.created'
  | 'app.updated'
  | 'app.activated'
  | 'app.revoked'
  | 'app.deleted'
  | 'app.secret.rotated'
  | 'dataset.created'
  | 'dataset.updated'
  | 'dataset.published'
  | 'dataset.deleted'
  | 'plugin.loaded'
  | 'plugin.unloaded'
  | 'plugin.enabled'
  | 'plugin.disabled'
  | 'plugin.deleted'

export interface PlatformEventMap {
  'app.created': App
  'app.updated': App
  'app.activated': App
  'app.revoked': App
  'app.deleted': { appId: number }
  'app.secret.rotated': { appId: number }
  'dataset.created': Dataset
  'dataset.updated': Dataset
  'dataset.published': Dataset
  'dataset.deleted': { appId: number; datasetId: number }
  'plugin.loaded': { pluginType: string }
  'plugin.unloaded': { pluginType: string }
  'plugin.enabled': { appId: number; pluginType: string; instanceId: number }
  'plugin.disabled': { appId: number; pluginType: string; instanceId: number }
  'plugin.deleted': { appId: number; pluginType: string }
}

export type PlatformEventPayload<N extends PlatformEventName> = PlatformEventMap[N]

/** 插件订阅平台生命周期事件（env.events()）。订阅随实例销毁/插件卸载自动清理。 */
export interface PluginEvents {
  on<N extends PlatformEventName>(
    name: N,
    handler: (payload: PlatformEventPayload<N>) => void | Promise<void>,
  ): () => void
  off<N extends PlatformEventName>(
    name: N,
    handler: (payload: PlatformEventPayload<N>) => void | Promise<void>,
  ): void
}

// =====================================================================
// 平台能力门面（SPI）：插件经 env.apps()/env.monitor()/env.security()/env.platform() 访问核心功能。
// =====================================================================

/** 应用门面（env.apps()）：读取/创建应用空间。 */
export interface PluginApps {
  list(): App[]
  get(id: number | string): App
  create(name: string, description?: string, pluginTypes?: string[]): CreateAppResult
}

export type PluginMonitorRange = '24h' | '7d' | 'all'

/** 自定义监控指标采集（env.monitor().registerMetric()）。 */
export interface PluginMetricDef {
  key: string
  /** 采集回调：返回当前值（数字/字符串/对象）；由平台按采集周期调用并汇聚。 */
  collect(env: PluginEnvironment): unknown | Promise<unknown>
  /** 序列化格式（默认 'number'）。 */
  kind?: 'number' | 'string' | 'json'
}

/** 监控门面（env.monitor()）：读取平台数据面聚合 + 注册自定义指标。 */
export interface PluginMonitor {
  overview(range?: PluginMonitorRange): Record<string, number>
  endpoints(range?: PluginMonitorRange): Array<Record<string, unknown>>
  topResources(range?: PluginMonitorRange, limit?: number): Array<Record<string, unknown>>
  topIps(range?: PluginMonitorRange, limit?: number): Array<Record<string, unknown>>
  topApps(range?: PluginMonitorRange, limit?: number): Array<Record<string, unknown>>
  series(range?: PluginMonitorRange): Array<Record<string, unknown>>
  recent(limit?: number): Array<Record<string, unknown>>
  /** 注册自定义指标采集（如 machine-monitor 想进平台监控）。 */
  registerMetric(def: PluginMetricDef): void
}

/** 安全门面（env.security()）：注册公开前缀 / 管理 IP 规则。 */
export interface PluginSecurity {
  /** 注册公开 URL 前缀（SecurityMiddleware 放行），如 '/api/health/'. */
  publicUrl(prefix: string): void
  blockIp(ip: string): void
  unblockIp(ip: string): void
  isBlocked(ip: string): boolean
}

/** 平台门面（env.platform()）：平台版本、安全子集配置、元信息。 */
export interface PluginPlatform {
  version: string
  /** 平台安全子集配置（不含密钥）。 */
  config(): Record<string, unknown>
  meta(): { platform: string; version: string; authEnabled: boolean; pluginsDir: string }
}

export interface PluginEnvironment {
  store(): PluginStore
  /** 文件存储（插件文件类数据，实例隔离）。 */
  files(): PluginFiles
  /** 密钥加密（API Key 等敏感字段）。 */
  crypto(): PluginCrypto
  datasets(): DatasetPublisher
  datasetSource(): DatasetSource | null
  info(message: string): void
  warn(message: string): void
  error(message: string): void
  config(): Record<string, unknown>
  updateConfig(config: Record<string, unknown>): Promise<void>
  instance(): PluginInstanceContext
  ops(): Ops
  /** 订阅平台生命周期事件（SPI）。 */
  events(): PluginEvents
  /** 应用门面（SPI）：读取/创建应用空间。 */
  apps(): PluginApps
  /** 监控门面（SPI）：读取数据面聚合 + 注册自定义指标。 */
  monitor(): PluginMonitor
  /** 安全门面（SPI）：注册公开前缀 / 管理 IP 规则。 */
  security(): PluginSecurity
  /** 平台门面（SPI）：平台版本、配置、元信息。 */
  platform(): PluginPlatform
  /** 消费其他插件暴露的能力（双向 SPI）；不可用返回 null。targetAppId 缺省为当前实例 appId。 */
  spi<T = unknown>(pluginType: string, namespace: string, targetAppId?: number): T | null
}

export interface AtlasPlugin {
  /** 全局唯一，内置类型为保留字。 */
  type: string
  name: string
  describe: string
  defaultDataScope: DataScope
  /** 仅允许覆盖：SHARED → LOCAL。 */
  scopeOverrideAllowed?: boolean
  /** 幂等建表 DDL（平台启动按注册顺序执行）。 */
  schemaDdl?: () => string[]
  datasetSource?: () => DatasetSource
  /** 数据集注册：实例启用时 core 自动创建/同步，复用数据集接口与密级管理。 */
  datasets?: () => PluginDatasetRegistration[]
  endpoints?: () => PluginEndpoint[]
  init?: (env: PluginEnvironment) => void | Promise<void>
  destroy?: () => void | Promise<void>
  /** 应用删除时级联清理插件表（AppRepository.deleteCascade 事务内执行）。 */
  cleanupTables?: () => PluginCleanupTable[]
  /** 全局日志保留表（LogCleanupService 定时清理）。 */
  logTables?: () => Array<{ table: string; column: string }>
  /** 注册公开 URL 前缀（SecurityMiddleware 放行）。 */
  publicUrls?: () => string[]
  /** 监控聚合的插件资源类型显示名解析。 */
  resourceName?: () => PluginResourceNameResolver[]
  /** 暴露能力给其他插件/内核（双向 SPI）：namespace → 能力工厂。 */
  provides?: () => Record<string, PluginSpiExport>
  /** 依赖声明：provide 启动时对这些插件做拓扑排序（先启用被依赖方）；环检测拒绝。 */
  dependsOn?: () => PluginSpiDependency[]
}

/** 插件应用删除级联清理表项。 */
export interface PluginCleanupTable {
  table: string
  /** 应用外键列，默认 'app_id'。 */
  column?: string
}

/** 监控聚合的插件资源类型显示名解析器。 */
export interface PluginResourceNameResolver {
  resourceType: string
  /** 按资源 id 解析显示名（同步；用于监控聚合显示）。 */
  nameOf(resourceId: number): string | null
}

// =====================================================================
// 插件双向 SPI（SPI）：插件暴露能力（provides）供其他插件/内核经 env.spi() 消费。
// =====================================================================

/** 插件暴露的能力工厂：create(env) 返回该命名空间的能力对象（类型见 @atlas/types/spi/*）。 */
export interface PluginSpiExport {
  describe: string
  create(env: PluginEnvironment): unknown
}

/** 插件依赖声明：dependsOn 数组项。 */
export interface PluginSpiDependency {
  pluginType: string
  /** 可选：仅依赖该插件的某个命名空间（更精确）。 */
  spi?: string
}

// ---------- 插件 UI（前端 slot 契约，与后端共享） ----------
export type PluginSlotName = 'app-space' | 'console' | 'system-menu'

export interface PluginUiSlot {
  slot: PluginSlotName
  tab?: string
  title?: string
  entry: string
}

export interface PluginUiManifest {
  pluginType: string
  name: string
  icon?: string
  version?: string
  slots: PluginUiSlot[]
}

// 插件「一等能力」SPI 接口（model-gateway 等），亦可从 @atlas/types/spi/model-gateway 单独导入。
export * from './spi/model-gateway.js'
