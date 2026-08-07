import type { AibasePlugin, PluginEnvironment } from '@atlas/types'

/**
 * providers 插件：AI 供应商管理（GLOBAL_SHARED —— 共享一份数据）。
 * 数据存通用存储（entity_key=providers），API Key 用 env.crypto() 加密。
 */
interface Provider {
  id: number
  name: string
  providerType: string
  apiKey: string
  baseUrl: string
  icon: string
  iconColor: string
  models: Array<{ modelId: string; contextTokens: number | null }>
  defaultModel: string
  maxTokens: number | null
  timeoutSeconds: number
  extraConfig: string
  enabled: boolean
  isDefault: boolean
  sortOrder: number
}

const SEED: Array<Omit<Provider, 'id' | 'apiKey' | 'models' | 'defaultModel' | 'maxTokens' | 'timeoutSeconds' | 'extraConfig' | 'enabled' | 'isDefault' | 'sortOrder'>> = [
  { name: 'DeepSeek', providerType: 'OPENAI_COMPATIBLE', baseUrl: 'https://api.deepseek.com/v1', icon: '', iconColor: '#4D6BFE' },
  { name: 'MiniMax', providerType: 'OPENAI_COMPATIBLE', baseUrl: 'https://api.minimax.chat/v1', icon: '', iconColor: '#00B1B9' },
  { name: '火山引擎', providerType: 'ARK', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', icon: '', iconColor: '#3370FF' },
  { name: '智谱', providerType: 'OPENAI_COMPATIBLE', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', icon: '', iconColor: '#3859FF' },
  { name: 'Kimi', providerType: 'OPENAI_COMPATIBLE', baseUrl: 'https://api.moonshot.cn/v1', icon: '', iconColor: '#000000' },
  { name: 'OpenAI', providerType: 'OPENAI_COMPATIBLE', baseUrl: 'https://api.openai.com/v1', icon: '', iconColor: '#10A37F' },
  { name: 'Anthropic', providerType: 'ANTHROPIC_COMPATIBLE', baseUrl: 'https://api.anthropic.com/v1', icon: '', iconColor: '#D97757' },
  { name: 'OpenRouter', providerType: 'OPENAI_COMPATIBLE', baseUrl: 'https://openrouter.ai/api/v1', icon: '', iconColor: '#8B5CF6' },
]

const plugin: AibasePlugin = {
  type: 'providers',
  name: '供应商管理',
  describe: '供应商配置、API Key 加密存储（仅网关内部使用，不进数据集）、连接测试',
  defaultDataScope: 'GLOBAL_SHARED',
  scopeOverrideAllowed: true,

  async init(env: PluginEnvironment) {
    const list = await env.store().get<Provider[]>('providers')
    if (!list || list.length === 0) {
      const seeded = SEED.map((s, i) => ({ ...s, id: i + 1, apiKey: '', models: [], defaultModel: '', maxTokens: null, timeoutSeconds: 240, extraConfig: '{}', enabled: true, isDefault: false, sortOrder: i }))
      await env.store().put('providers', seeded)
      env.info('共享供应商种子初始化完成（8 个）')
    }
  },

  endpoints: () => [
    {
      method: 'GET', path: 'list', summary: '供应商列表',
      handle: async (env) => (await env.store().get<Provider[]>('providers')) ?? [],
    },
    {
      method: 'GET', path: 'types', summary: '支持类型',
      handle: () => ['OPENAI_COMPATIBLE', 'ANTHROPIC_COMPATIBLE', 'ARK', 'CUSTOM'],
    },
    {
      method: 'POST', path: 'create', summary: '新增供应商',
      handle: async (env, _params, body) => {
        const req = body as { name: string; providerType?: string; apiKey?: string; baseUrl: string; icon?: string; iconColor?: string; models?: Provider['models']; defaultModel?: string; maxTokens?: number | null; timeoutSeconds?: number; enabled?: boolean; isDefault?: boolean; sortOrder?: number }
        if (!req?.name?.trim() || !req.baseUrl?.trim()) throw new Error('名称与 base_url 不能为空')
        const list = (await env.store().get<Provider[]>('providers')) ?? []
        const next: Provider = {
          id: list.reduce((m, p) => Math.max(m, p.id), 0) + 1,
          name: req.name.trim(),
          providerType: req.providerType ?? 'OPENAI_COMPATIBLE',
          apiKey: env.crypto().encrypt(req.apiKey ?? ''),
          baseUrl: req.baseUrl.trim(),
          icon: req.icon ?? '',
          iconColor: req.iconColor ?? '',
          models: req.models ?? [],
          defaultModel: req.defaultModel ?? '',
          maxTokens: req.maxTokens ?? null,
          timeoutSeconds: req.timeoutSeconds ?? 240,
          extraConfig: '{}',
          enabled: req.enabled ?? true,
          isDefault: req.isDefault ?? false,
          sortOrder: req.sortOrder ?? list.length,
        }
        list.push(next)
        await env.store().put('providers', list)
        env.info(`新增供应商：${next.name}`)
        return next
      },
    },
    {
      method: 'PUT', path: 'update/{id}', summary: '更新供应商',
      handle: async (env, params, body) => {
        const req = body as { name?: string; apiKey?: string; baseUrl?: string; models?: Provider['models']; enabled?: boolean; isDefault?: boolean }
        const list = (await env.store().get<Provider[]>('providers')) ?? []
        const row = list.find((p) => p.id === Number(params.id))
        if (!row) throw new Error(`供应商不存在: ${params.id}`)
        const idx = list.indexOf(row)
        list[idx] = {
          ...row,
          name: req.name ?? row.name,
          baseUrl: req.baseUrl ?? row.baseUrl,
          apiKey: req.apiKey !== undefined && req.apiKey !== '' ? env.crypto().encrypt(req.apiKey) : row.apiKey,
          models: req.models ?? row.models,
          enabled: req.enabled ?? row.enabled,
          isDefault: req.isDefault ?? row.isDefault,
        }
        await env.store().put('providers', list)
        return list[idx]
      },
    },
    {
      method: 'DELETE', path: 'delete/{id}', summary: '删除供应商',
      handle: async (env, params) => {
        const list = (await env.store().get<Provider[]>('providers')) ?? []
        const next = list.filter((p) => p.id !== Number(params.id))
        await env.store().put('providers', next)
        return null
      },
    },
    {
      method: 'PUT', path: 'default/{id}', summary: '设为默认',
      handle: async (env, params) => {
        const list = (await env.store().get<Provider[]>('providers')) ?? []
        const next = list.map((p) => ({ ...p, isDefault: p.id === Number(params.id) }))
        await env.store().put('providers', next)
        return next.find((p) => p.id === Number(params.id))
      },
    },
    {
      method: 'PUT', path: 'enabled/{id}', summary: '启用/停用',
      handle: async (env, params, body) => {
        const list = (await env.store().get<Provider[]>('providers')) ?? []
        const next = list.map((p) => (p.id === Number(params.id) ? { ...p, enabled: (body as { enabled?: boolean }).enabled ?? true } : p))
        await env.store().put('providers', next)
        return next.find((p) => p.id === Number(params.id))
      },
    },
    {
      method: 'POST', path: 'test', summary: '连接测试',
      handle: async (env, _params, body) => {
        const req = body as { baseUrl?: string; apiKey?: string; timeoutSeconds?: number }
        if (!req?.baseUrl) return { success: false, message: '缺少 base_url', latencyMs: null }
        const started = Date.now()
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), (req.timeoutSeconds ?? 5) * 1000)
          const res = await fetch(req.baseUrl.replace(/\/$/, ''), { method: 'GET', signal: controller.signal })
          clearTimeout(timer)
          return { success: res.ok || res.status < 500, message: `HTTP ${res.status}`, latencyMs: Date.now() - started }
        } catch (e) {
          return { success: false, message: (e as Error).message, latencyMs: Date.now() - started }
        }
      },
    },
  ],
}

export default plugin
