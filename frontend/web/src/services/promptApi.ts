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
  upload: (category: string, description: string, files: File[]) => {
    const form = new FormData()
    form.append('category', category)
    form.append('description', description)
    for (const file of files) {
      // 目录上传保留相对路径（webkitRelativePath）
      form.append('files', file, file.webkitRelativePath || file.name)
    }
    return post<ModelFile>('/api/model-files', form)
  },
  downloadUrl: (id: number) => `/api/model-files/${id}/download`,
  /** 固定公开下载链接（随机 token，防穷举，创建后不变）。 */
  tokenDownloadUrl: (token: string) => `/api/files/${token}/download`,
  remove: (id: number) => del<void>(`/api/model-files/${id}`),
}
