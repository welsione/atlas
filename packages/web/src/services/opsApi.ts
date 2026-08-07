import { get } from './http'

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

export const opsApi = {
  logs: (params: { appId?: number; pluginType?: string; level?: string; page?: number; size?: number }) =>
    get<OpsLogPage>('/api/ops/logs', params),
  overview: () => get<OpsOverview>('/api/ops/overview'),
}
