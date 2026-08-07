import { get, post, put, del } from './http'
import type { PluginOverviewRow, PluginInstance } from '../types'

export const pluginApi = {
  overview: (appId: number) => get<PluginOverviewRow[]>(`/api/apps/${appId}/plugins`),
  enable: (appId: number, pluginType: string, dataScope?: string) =>
    post<PluginInstance>(`/api/apps/${appId}/plugins/${pluginType}/enable`, dataScope ? { dataScope } : {}),
  disable: (appId: number, pluginType: string) => post<PluginInstance>(`/api/apps/${appId}/plugins/${pluginType}/disable`),
  removeInstance: (appId: number, pluginType: string) => del<void>(`/api/apps/${appId}/plugins/${pluginType}`),
  updateConfig: (appId: number, pluginType: string, config: Record<string, unknown>) =>
    post<void>(`/api/apps/${appId}/plugins/${pluginType}/config`, config),
  listDefs: () => get<Array<{ plugin: import('../types').PluginDef; runtimeLoaded: boolean; runtimeArtifact: string }>>('/api/plugins'),
  unload: (pluginType: string) => post<void>(`/api/plugins/${pluginType}/unload`),
}
