export type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

export type ProviderModel = {
  modelId: string
  contextTokens: number | null
}

export type Provider = {
  id: number
  name: string
  providerType: string
  apiKey: string
  baseUrl: string
  icon: string
  iconColor: string
  models: ProviderModel[]
  defaultModel: string
  maxTokens: number | null
  timeoutSeconds: number
  extraConfig: string
  enabled: boolean
  isDefault: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ProviderRequest = {
  name: string
  providerType: string
  apiKey?: string
  baseUrl: string
  icon?: string
  iconColor?: string
  models?: ProviderModel[]
  defaultModel?: string
  maxTokens?: number | null
  timeoutSeconds?: number
  extraConfig?: string
  enabled?: boolean
  isDefault?: boolean
  sortOrder?: number
}

export type ConnectionTestResult = {
  success: boolean
  message: string
  latencyMs: number | null
}

export type PromptVariable = {
  name: string
  description: string
  required: boolean
}

export type Prompt = {
  id: number
  name: string
  category: string
  description: string
  content: string
  variables: PromptVariable[]
  version: number
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type PromptRequest = {
  name: string
  category?: string
  description?: string
  content: string
  variables?: PromptVariable[]
  enabled?: boolean
  sortOrder?: number
}

export type RenderResult = {
  content: string
  missingVariables: Record<string, string>
}

export type PluginOverview = {
  providerAdapters: string[]
  promptProcessors: string[]
  externalJars: string[]
}

export type ModelFileEntry = {
  path: string
  sizeBytes: number
  checksum: string
}

export type ModelFile = {
  id: number
  name: string
  category: string
  description: string
  kind: 'FILE' | 'DIRECTORY'
  storageRoot: string
  files: ModelFileEntry[]
  totalSize: number
  fileCount: number
  createdAt: string
  updatedAt: string
}
