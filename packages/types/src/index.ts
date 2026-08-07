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
  size: number
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
}

export interface AibasePlugin {
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
  endpoints?: () => PluginEndpoint[]
  init?: (env: PluginEnvironment) => void | Promise<void>
  destroy?: () => void | Promise<void>
}

// ---------- 插件 UI（前端 slot 契约，与后端共享） ----------
export type PluginSlotName = 'app-space' | 'console'

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
