import { get, post, put } from './http'
import type { Page } from '../types'

export type MonitorRange = '24h' | '7d' | 'all'

export type MonitorOverview = {
  total: number
  totalBytes: number
  notModified: number
  failures: number
  activeApps: number
  activeIps: number
}

export type MonitorRow = Record<string, string | number>

export type MonitorInterfaceRow = {
  pluginType: string
  pluginName: string
  method: string
  path: string
  summary: string
  enabled: boolean
  count: number
  failures: number
  bytes: number
  lastAccess: string
}

/** 接口监控 API（框架内置能力，非插件）。列表均后端分页（page 从 1 起，默认 10 条/页）。 */
export const monitorApi = {
  overview: (appId: number, range: MonitorRange) =>
    get<MonitorOverview>(`/api/apps/${appId}/monitor/overview?range=${range}`),
  endpoints: (appId: number, range: MonitorRange, page = 1, size = 10) =>
    get<Page<MonitorRow>>(`/api/apps/${appId}/monitor/endpoints?range=${range}&page=${page}&size=${size}`),
  interfaces: (appId: number, page = 1, size = 10) =>
    get<Page<MonitorInterfaceRow>>(`/api/apps/${appId}/monitor/interfaces?page=${page}&size=${size}`),
  setInterfaceEnabled: (appId: number, pluginType: string, method: string, path: string, enabled: boolean) =>
    put(`/api/apps/${appId}/monitor/interfaces/${pluginType}/${method}`, { path, enabled }),
  resetInterfaceRule: (appId: number, pluginType: string, method: string, path: string) =>
    post(`/api/apps/${appId}/monitor/interfaces/${pluginType}/${method}/reset`, { path }),
  topResources: (appId: number, range: MonitorRange, page = 1, size = 10) =>
    get<Page<MonitorRow>>(`/api/apps/${appId}/monitor/top-resources?range=${range}&page=${page}&size=${size}`),
  topIps: (appId: number, range: MonitorRange, page = 1, size = 10) =>
    get<Page<MonitorRow>>(`/api/apps/${appId}/monitor/top-ips?range=${range}&page=${page}&size=${size}`),
  topApps: (appId: number, range: MonitorRange, page = 1, size = 10) =>
    get<Page<MonitorRow>>(`/api/apps/${appId}/monitor/top-apps?range=${range}&page=${page}&size=${size}`),
  recent: (appId: number, page = 1, size = 10) =>
    get<Page<MonitorRow>>(`/api/apps/${appId}/monitor/recent?page=${page}&size=${size}`),
  series: (appId: number, range: MonitorRange) =>
    get<MonitorRow[]>(`/api/apps/${appId}/monitor/series?range=${range}`),
}
