import { get, post, put, del } from './http'
import type { Prompt, PromptRequest, RenderResult } from '../types'

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
