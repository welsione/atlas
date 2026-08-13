import { get, post, put, del } from './http'
import type { Page, PluginDef, PluginOverviewRow, PluginInstance } from '../types'

export type DefRow = { plugin: PluginDef; runtimeLoaded: boolean; runtimeArtifact: string }

export const pluginApi = {
  overview: (appId: number, page = 1, size = 10) =>
    get<Page<PluginOverviewRow>>(`/api/apps/${appId}/plugins?page=${page}&size=${size}`),
  enable: (appId: number, pluginType: string, dataScope?: string) =>
    post<PluginInstance>(`/api/apps/${appId}/plugins/${pluginType}/enable`, dataScope ? { dataScope } : {}),
  disable: (appId: number, pluginType: string) => post<PluginInstance>(`/api/apps/${appId}/plugins/${pluginType}/disable`),
  removeInstance: (appId: number, pluginType: string) => del<void>(`/api/apps/${appId}/plugins/${pluginType}`),
  updateConfig: (appId: number, pluginType: string, config: Record<string, unknown>) =>
    post<void>(`/api/apps/${appId}/plugins/${pluginType}/config`, config),
  listDefs: (page = 1, size = 10) => get<Page<DefRow>>(`/api/plugins?page=${page}&size=${size}`),
  unload: (pluginType: string) => post<void>(`/api/plugins/${pluginType}/unload`),
}
