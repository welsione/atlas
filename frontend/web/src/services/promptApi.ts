import { get, post, put, del } from './http'
import type { Prompt, PromptRequest, RenderResult, ModelFile } from '../types'

export const promptApi = {
  list: () => get<Prompt[]>('/api/prompts'),
  categories: () => get<string[]>('/api/prompts/categories'),
  create: (req: PromptRequest) => post<Prompt>('/api/prompts', req),
  update: (id: number, req: PromptRequest) => put<Prompt>(`/api/prompts/${id}`, req),
  remove: (id: number) => del<void>(`/api/prompts/${id}`),
  render: (id: number, variables: Record<string, string>) =>
    post<RenderResult>(`/api/prompts/${id}/render`, { variables }),
  versions: (id: number) => get<Array<{ version: number; content: string; createdAt: string }>>(`/api/prompts/${id}/versions`),
}

export const pluginApi = {
  overview: () =>
    get<{ providerAdapters: string[]; promptProcessors: string[]; externalJars: string[] }>('/api/plugins'),
}

export const modelFileApi = {
  list: () => get<ModelFile[]>('/api/model-files'),
  upload: (category: string, description: string, files: File[], updateToken?: string) => {
    const form = new FormData()
    form.append('category', category)
    form.append('description', description)
    if (updateToken) form.append('token', updateToken)
    for (const file of files) {
      // 目录上传保留相对路径（webkitRelativePath）
      form.append('files', file, file.webkitRelativePath || file.name)
    }
    return post<ModelFile>('/api/model-files', form)
  },
  downloadUrl: (id: number) => `/api/model-files/${id}/download`,
  /** 固定公开下载链接（随机 token，防穷举，创建后不变）。 */
  tokenDownloadUrl: (token: string) => `/api/files/${token}/download`,
  /** 下载元数据（version + contentHash + 下载次数）。 */
  metaUrl: (token: string) => `/api/files/${token}/meta`,
  downloadLogs: (id: number) => get<Array<{ ip: string; userAgent: string; downloadedAt: string }>>(`/api/model-files/${id}/download-logs`),
  remove: (id: number) => del<void>(`/api/model-files/${id}`),
}

export const monitorApi = {
  stats: (range: '24h' | '7d' | 'all') =>
    get<{ uploadBytes: number; uploadCount: number; downloadBytes: number; downloadCount: number; series: Array<{ bucket: string; uploadBytes: number; downloadBytes: number }> }>(`/api/monitor/stats?range=${range}`),
  overview: () =>
    get<{
      cpuCores: number; systemLoad: number; processCpuPercent: number
      heapUsed: number; heapMax: number; threadCount: number; uptimeSeconds: number
      systemTotalMemory: number; systemFreeMemory: number
      diskTotal: number; diskFree: number
      entryCount: number; storedBytes: number; dataDirBytes: number; dbFileBytes: number
    }>('/api/monitor/overview'),
  top: (range: '24h' | '7d' | 'all', limit = 10) =>
    get<{ topDownloadFiles: Array<{ fileId: number; name: string; count: number; totalBytes: number }>; topIps: Array<{ ip: string; count: number; totalBytes: number }>; topUploadFiles: Array<{ fileId: number; name: string; count: number; totalBytes: number }> }>(`/api/monitor/top?range=${range}&limit=${limit}`),
}
