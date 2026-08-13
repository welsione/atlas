import { get, post, put, del } from './http'
import type { Dataset, DatasetCreateRequest, Secret, DatasetMeta, Page } from '../types'

export const datasetApi = {
  list: (appId: number, page = 1, size = 10) => get<Page<Dataset>>(`/api/apps/${appId}/datasets?page=${page}&size=${size}`),
  create: (appId: number, req: DatasetCreateRequest) => post<Dataset>(`/api/apps/${appId}/datasets`, req),
  remove: (appId: number, id: number) => del<void>(`/api/apps/${appId}/datasets/${id}`),
  update: (appId: number, id: number, req: Partial<DatasetCreateRequest>) => put<Dataset>(`/api/apps/${appId}/datasets/${id}`, req),
  upsertSecret: (appId: number, id: number, keyName: string, value: string) =>
    post<Secret>(`/api/apps/${appId}/datasets/${id}/secrets`, { keyName, value }),
  grant: (appId: number, datasetId: number, targetAppId: number) =>
    post<void>(`/api/apps/${appId}/datasets/${datasetId}/grants`, { appId: targetAppId }),
  revokeGrant: (appId: number, datasetId: number, targetAppId: number) =>
    del<void>(`/api/apps/${appId}/datasets/${datasetId}/grants/${targetAppId}`),
  audit: (appId: number, id: number) =>
    get<{ downloadLogs: unknown[]; secretAccessLogs: unknown[]; secretHistory: unknown[] }>(
      `/api/apps/${appId}/datasets/${id}/audit`,
    ),
  refresh: (appId: number, id: number) => post<{ changed: boolean }>(`/api/apps/${appId}/datasets/${id}/refresh`),
  uploadAsset: (appId: number, id: number, path: string, base64: string, mime: string) =>
    post<Dataset>(`/api/apps/${appId}/datasets/${id}/assets`, { path, mime, base64 }),
  removeAsset: (appId: number, id: number, path: string) =>
    del<Dataset>(`/api/apps/${appId}/datasets/${id}/assets/${path.split('/').map(encodeURIComponent).join('/')}`),
  metaUrl: (token: string) => `/api/v1/datasets/${token}/meta`,
  dataUrl: (token: string) => `/api/v1/datasets/${token}/data`,
}
