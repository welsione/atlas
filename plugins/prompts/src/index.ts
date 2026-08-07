import type { AibasePlugin, PluginEnvironment } from '@atlas/types'

/**
 * prompts 插件：提示词模板管理（APP_LOCAL —— 每个应用独立）。
 * 数据存通用存储（entity_key=prompts），含变量渲染与版本历史。
 */
interface Prompt {
  id: number
  name: string
  category: string
  description: string
  content: string
  variables: Array<{ name: string; description: string; required: boolean }>
  version: number
  history: Array<{ version: number; content: string; createdAt: string }>
  enabled: boolean
  sortOrder: number
}

const now = (): string => new Date().toISOString().slice(0, 19).replace('T', ' ')

const plugin: AibasePlugin = {
  type: 'prompts',
  name: '提示词管理',
  describe: '提示词模板、变量渲染、版本历史',
  defaultDataScope: 'APP_LOCAL',

  endpoints: () => [
    {
      method: 'GET', path: 'list', summary: '提示词列表',
      handle: async (env) => (await env.store().get<Prompt[]>('prompts')) ?? [],
    },
    {
      method: 'GET', path: 'categories', summary: '分类列表',
      handle: async (env) => {
        const list = (await env.store().get<Prompt[]>('prompts')) ?? []
        return [...new Set(list.map((p) => p.category))].sort()
      },
    },
    {
      method: 'POST', path: 'create', summary: '新增提示词',
      handle: async (env, _params, body) => {
        const req = body as { name: string; category?: string; description?: string; content: string; variables?: Prompt['variables']; enabled?: boolean; sortOrder?: number }
        if (!req?.name?.trim() || !req.content?.trim()) throw new Error('名称与内容不能为空')
        const list = (await env.store().get<Prompt[]>('prompts')) ?? []
        const next: Prompt = {
          id: list.reduce((m, p) => Math.max(m, p.id), 0) + 1,
          name: req.name.trim(),
          category: req.category ?? 'default',
          description: req.description ?? '',
          content: req.content,
          variables: req.variables ?? [],
          version: 1,
          history: [],
          enabled: req.enabled ?? true,
          sortOrder: req.sortOrder ?? list.length,
        }
        list.push(next)
        await env.store().put('prompts', list)
        return next
      },
    },
    {
      method: 'PUT', path: 'update/{id}', summary: '更新提示词（内容变更版本+1）',
      handle: async (env, params, body) => {
        const req = body as { name?: string; content?: string; variables?: Prompt['variables']; enabled?: boolean }
        const list = (await env.store().get<Prompt[]>('prompts')) ?? []
        const row = list.find((p) => p.id === Number(params.id))
        if (!row) throw new Error(`提示词不存在: ${params.id}`)
        const idx = list.indexOf(row)
        const contentChanged = req.content !== undefined && req.content !== row.content
        const next: Prompt = {
          ...row,
          name: req.name ?? row.name,
          content: req.content ?? row.content,
          variables: req.variables ?? row.variables,
          enabled: req.enabled ?? row.enabled,
          version: contentChanged ? row.version + 1 : row.version,
          history: contentChanged
            ? [...row.history, { version: row.version, content: row.content, createdAt: now() }]
            : row.history,
        }
        list[idx] = next
        await env.store().put('prompts', list)
        return next
      },
    },
    {
      method: 'DELETE', path: 'delete/{id}', summary: '删除提示词',
      handle: async (env, params) => {
        const list = (await env.store().get<Prompt[]>('prompts')) ?? []
        await env.store().put('prompts', list.filter((p) => p.id !== Number(params.id)))
        return null
      },
    },
    {
      method: 'POST', path: 'render/{id}', summary: '变量占位渲染',
      handle: async (env, params, body) => {
        const req = body as { variables?: Record<string, string> }
        const list = (await env.store().get<Prompt[]>('prompts')) ?? []
        const row = list.find((p) => p.id === Number(params.id))
        if (!row) throw new Error(`提示词不存在: ${params.id}`)
        const variables = req?.variables ?? {}
        const missing: Record<string, string> = {}
        for (const v of row.variables) {
          if (v.required && (variables[v.name] === undefined || variables[v.name] === '')) {
            missing[v.name] = v.description ?? ''
          }
        }
        let content = row.content
        for (const [key, value] of Object.entries(variables)) {
          content = content.replaceAll(`{{${key}}}`, value)
        }
        return { content, missingVariables: missing }
      },
    },
    {
      method: 'GET', path: 'versions/{id}', summary: '版本历史',
      handle: async (env, params) => {
        const list = (await env.store().get<Prompt[]>('prompts')) ?? []
        const row = list.find((p) => p.id === Number(params.id))
        if (!row) throw new Error(`提示词不存在: ${params.id}`)
        return [...row.history].reverse()
      },
    },
  ],
}

export default plugin
