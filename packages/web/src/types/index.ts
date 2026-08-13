export type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

/** 通用分页结构：后端列表统一返回（page 从 1 起，size 默认 10 上限 100）。 */
export type Page<T> = {
  rows: T[]
  total: number
  page: number
  size: number
}

// ---------- 应用空间 ----------
export type App = {
  id: number
  appId: string
  name: string
  description: string
  status: 'ACTIVE' | 'PAUSED' | 'REVOKED'
  tokenTtlSeconds: number
  createdAt: string
  updatedAt: string
}

export type CreateAppResult = {
  app: App
  secret: string
}

// ---------- 插件 ----------
export type PluginDef = {
  id: number
  pluginType: string
  name: string
  description: string
  defaultDataScope: 'APP_LOCAL' | 'GLOBAL_SHARED'
  scopeOverrideAllowed: boolean
  artifact: string
  artifactHash: string
  version: string
  loaded: boolean
  builtin: boolean
  createdAt: string
  updatedAt: string
}

export type PluginInstance = {
  id: number
  appId: number
  pluginType: string
  dataScope: 'APP_LOCAL' | 'GLOBAL_SHARED'
  configJson: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type PluginOverviewRow = {
  plugin: PluginDef
  instance: PluginInstance | null
  runtimeLoaded: boolean
}

// ---------- 数据集 ----------
export type DatasetSensitivity = 'PUBLIC' | 'INTERNAL' | 'SECRET'

export type DatasetAsset = {
  path: string
  size: number
  mime: string
}

export type Dataset = {
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

export type DatasetCreateRequest = {
  pluginType?: string
  datasetKey?: string
  name: string
  description?: string
  sensitivity?: DatasetSensitivity
  contentJson?: string
  refreshMode?: string
  refreshIntervalSeconds?: number | null
}

export type Secret = {
  id: number
  datasetId: number
  keyName: string
  secretVersion: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type DatasetMeta = {
  token: string
  name: string
  sensitivity: string
  version: number
  contentHash: string
  assetCount: number
  updatedAt: string
  appId: number
}
