import { get, post, put, del } from './http'
import type { App, CreateAppResult } from '../types'

export const appApi = {
  list: () => get<App[]>('/api/apps'),
  create: (name: string, description: string, pluginTypes?: string[]) =>
    post<CreateAppResult>('/api/apps', { name, description, pluginTypes }),
  rotate: (id: number) => post<{ secret: string }>(`/api/apps/${id}/rotate`),
  revoke: (id: number) => post<App>(`/api/apps/${id}/revoke`),
  activate: (id: number) => post<App>(`/api/apps/${id}/activate`),
  remove: (id: number) => del<void>(`/api/apps/${id}`),
}
