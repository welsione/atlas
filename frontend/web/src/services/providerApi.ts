import { get, post, put, del } from './http'
import type { Provider, ProviderRequest, ConnectionTestResult } from '../types'

export const providerApi = {
  list: () => get<Provider[]>('/api/providers'),
  types: () => get<string[]>('/api/providers/types'),
  create: (req: ProviderRequest) => post<Provider>('/api/providers', req),
  update: (id: number, req: ProviderRequest) => put<Provider>(`/api/providers/${id}`, req),
  remove: (id: number) => del<void>(`/api/providers/${id}`),
  test: (id: number) => post<ConnectionTestResult>(`/api/providers/${id}/test`),
  testConfig: (req: ProviderRequest) => post<ConnectionTestResult>('/api/providers/test', req),
  setDefault: (id: number) => put<Provider>(`/api/providers/${id}/default`),
  updateEnabled: (id: number, enabled: boolean) =>
    put<Provider>(`/api/providers/${id}/enabled`, { enabled }),
}
