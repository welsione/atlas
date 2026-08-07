import type { AibasePlugin, DataScope } from '@atlas/types'

/** 插件运行时注册项。 */
export interface LoadedPlugin {
  plugin: AibasePlugin
  /** 来源标识：builtin / 外部目录名。 */
  artifact: string
  artifactHash: string
  version: string
  builtin: boolean
  /** 外部插件的入口模块（动态 import 结果），用于卸载后引用。 */
  module?: unknown
}

/** 插件目录 manifest（内置/外部同构）。 */
export interface PluginManifest {
  pluginType: string
  name: string
  description: string
  version: string
  defaultDataScope: DataScope
  scopeOverrideAllowed?: boolean
  /** 入口文件（默认 index）。 */
  entry?: string
}
