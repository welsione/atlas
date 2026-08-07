import { get } from './http'

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

/** 接口监控 API（框架内置能力，非插件）。 */
export const monitorApi = {
  overview: (appId: number, range: MonitorRange) =>
    get<MonitorOverview>(`/api/apps/${appId}/monitor/overview?range=${range}`),
  endpoints: (appId: number, range: MonitorRange) =>
    get<MonitorRow[]>(`/api/apps/${appId}/monitor/endpoints?range=${range}`),
  topResources: (appId: number, range: MonitorRange, limit = 10) =>
    get<MonitorRow[]>(`/api/apps/${appId}/monitor/top-resources?range=${range}&limit=${limit}`),
  topIps: (appId: number, range: MonitorRange, limit = 10) =>
    get<MonitorRow[]>(`/api/apps/${appId}/monitor/top-ips?range=${range}&limit=${limit}`),
  topApps: (appId: number, range: MonitorRange, limit = 10) =>
    get<MonitorRow[]>(`/api/apps/${appId}/monitor/top-apps?range=${range}&limit=${limit}`),
  recent: (appId: number, limit = 50) =>
    get<MonitorRow[]>(`/api/apps/${appId}/monitor/recent?limit=${limit}`),
  series: (appId: number, range: MonitorRange) =>
    get<MonitorRow[]>(`/api/apps/${appId}/monitor/series?range=${range}`),
}
