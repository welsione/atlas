import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { AibasePlugin, PluginEnvironment } from '@atlas/types'

/**
 * providers 插件：AI 供应商管理（GLOBAL_SHARED —— 共享一份数据）。
 * 每个供应商同时维护 OpenAI 兼容接口与 Anthropic 兼容接口（一般以 BaseUrl 区分），
 * 模型清单共享一份，API Key 用 env.crypto() 加密、按接口分别存储。
 * - 图标：内置 icons/vendors/（来源 cc-switch）+ 自定义上传（store 存储，SVG 消毒）
 * - 模型参考：内置精简版 models.dev 数据（data/model-reference.json），支持远端刷新
 */
interface CompatEndpoint {
  baseUrl: string
  /** 加密后的 API Key（'' 表示未配置）。 */
  apiKey: string
}

interface Provider {
  id: number
  name: string
  icon: string
  iconColor: string
  openai: CompatEndpoint
  anthropic: CompatEndpoint
  models: Array<{ modelId: string; contextTokens: number | null }>
}

/** 内置模型参考数据（models.dev 精简版）。 */
interface ModelReference {
  source: string
  updatedAt: string
  modelCount: number
  providers: Record<string, Array<{ modelId: string; name: string; contextTokens: number | null; maxOutputTokens: number | null }>>
}

interface CustomIcon {
  name: string
  dataUrl: string
}

const SEED: Array<Omit<Provider, 'id' | 'openai' | 'anthropic' | 'models'>> = [
  { name: 'DeepSeek', icon: 'icons/vendors/deepseek.svg', iconColor: '#4D6BFE' },
  { name: 'MiniMax', icon: 'icons/vendors/minimax.svg', iconColor: '#00B1B9' },
  { name: '火山引擎', icon: 'icons/vendors/bytedance.svg', iconColor: '#3370FF' },
  { name: '智谱', icon: 'icons/vendors/zhipu.svg', iconColor: '#3859FF' },
  { name: 'Kimi', icon: 'icons/vendors/kimi.svg', iconColor: '#000000' },
  { name: 'OpenAI', icon: 'icons/vendors/openai.svg', iconColor: '#10A37F' },
  { name: 'Anthropic', icon: 'icons/vendors/anthropic.svg', iconColor: '#D97757' },
  { name: 'OpenRouter', icon: 'icons/vendors/openrouter.svg', iconColor: '#8B5CF6' },
]

/** 种子供应商默认的 OpenAI 兼容 BaseUrl（保守只填官方确认的）。 */
const SEED_OPENAI_URL: Record<string, string> = {
  'DeepSeek': 'https://api.deepseek.com/v1',
  'MiniMax': 'https://api.minimax.chat/v1',
  '火山引擎': 'https://ark.cn-beijing.volces.com/api/v3',
  '智谱': 'https://open.bigmodel.cn/api/paas/v4',
  'Kimi': 'https://api.moonshot.cn/v1',
  'OpenAI': 'https://api.openai.com/v1',
  'OpenRouter': 'https://openrouter.ai/api/v1',
}

/** 种子供应商默认的 Anthropic 兼容 BaseUrl（官方提供 /anthropic 兼容端点的）。 */
const SEED_ANTHROPIC_URL: Record<string, string> = {
  'DeepSeek': 'https://api.deepseek.com/anthropic',
  'MiniMax': 'https://api.minimax.chat/anthropic',
  'Anthropic': 'https://api.anthropic.com/v1',
  'OpenRouter': 'https://openrouter.ai/api/v1/anthropic',
}

const REFERENCE_KEY = 'model-reference'
const CUSTOM_ICONS_KEY = 'custom-icons'

/** 自定义图标限制：单文件 ≤ 64KB（SVG 文本），总数 ≤ 20。 */
const MAX_ICON_BYTES = 64 * 1024
const MAX_CUSTOM_ICONS = 20

const loadBuiltinReference = (): ModelReference => {
  const path = fileURLToPath(new URL('../data/model-reference.json', import.meta.url.split('?')[0]))
  return JSON.parse(readFileSync(path, 'utf8')) as ModelReference
}

const plugin: AibasePlugin = {
  type: 'providers',
  name: '供应商管理',
  describe: '供应商配置：OpenAI/Anthropic 兼容接口、API Key 加密、模型快速选择、图标上传',
  defaultDataScope: 'GLOBAL_SHARED',
  scopeOverrideAllowed: true,

  async init(env: PluginEnvironment) {
    const store = env.store()
    const list = (await store.get<Provider[]>('providers')) ?? []
    if (list.length === 0) {
      const seeded: Provider[] = SEED.map((s, i) => ({
        ...s,
        id: i + 1,
        openai: { baseUrl: SEED_OPENAI_URL[s.name] ?? '', apiKey: '' },
        anthropic: { baseUrl: SEED_ANTHROPIC_URL[s.name] ?? '', apiKey: '' },
        models: [],
      }))
      await store.put('providers', seeded)
      env.info('共享供应商种子初始化完成（8 个）')
    } else {
      await migrate(env, list)
    }
  },

  endpoints: () => [
    {
      method: 'GET', path: 'list', summary: '供应商列表（密钥脱敏）',
      handle: async (env) => {
        const list = (await env.store().get<Provider[]>('providers')) ?? []
        await migrate(env, list)
        return list.map(masked)
      },
    },
    {
      method: 'POST', path: 'create', summary: '新增供应商',
      handle: async (env, _params, body) => {
        const req = body as { name: string; icon?: string; iconColor?: string; openai?: Partial<CompatEndpoint>; anthropic?: Partial<CompatEndpoint>; models?: Provider['models'] }
        const name = req?.name?.trim()
        if (!name) throw new Error('名称不能为空')
        const openaiBase = req?.openai?.baseUrl?.trim() ?? ''
        const anthropicBase = req?.anthropic?.baseUrl?.trim() ?? ''
        if (!openaiBase && !anthropicBase) throw new Error('OpenAI 兼容与 Anthropic 兼容接口至少配置一个 BaseUrl')
        const list = (await env.store().get<Provider[]>('providers')) ?? []
        const next: Provider = {
          id: list.reduce((m, p) => Math.max(m, p.id), 0) + 1,
          name,
          icon: req.icon ?? '',
          iconColor: req.iconColor ?? '',
          openai: { baseUrl: openaiBase, apiKey: req.openai?.apiKey ? env.crypto().encrypt(req.openai.apiKey) : '' },
          anthropic: { baseUrl: anthropicBase, apiKey: req.anthropic?.apiKey ? env.crypto().encrypt(req.anthropic.apiKey) : '' },
          models: req.models ?? [],
        }
        list.push(next)
        await env.store().put('providers', list)
        env.info(`新增供应商：${next.name}`)
        return masked(next)
      },
    },
    {
      method: 'PUT', path: 'update/{id}', summary: '更新供应商（全字段）',
      handle: async (env, params, body) => {
        const req = body as { name?: string; icon?: string; iconColor?: string; openai?: Partial<CompatEndpoint>; anthropic?: Partial<CompatEndpoint>; models?: Provider['models'] }
        const list = (await env.store().get<Provider[]>('providers')) ?? []
        const row = list.find((p) => p.id === Number(params.id))
        if (!row) throw new Error(`供应商不存在: ${params.id}`)
        const idx = list.indexOf(row)
        const openaiBase = req?.openai?.baseUrl !== undefined ? req.openai.baseUrl.trim() : row.openai.baseUrl
        const anthropicBase = req?.anthropic?.baseUrl !== undefined ? req.anthropic.baseUrl.trim() : row.anthropic.baseUrl
        if (!openaiBase && !anthropicBase) throw new Error('OpenAI 兼容与 Anthropic 兼容接口至少保留一个 BaseUrl')
        const next: Provider = {
          ...row,
          name: req?.name?.trim() || row.name,
          icon: req?.icon ?? row.icon,
          iconColor: req?.iconColor ?? row.iconColor,
          openai: {
            baseUrl: openaiBase,
            apiKey: req?.openai?.apiKey ? env.crypto().encrypt(req.openai.apiKey) : row.openai.apiKey,
          },
          anthropic: {
            baseUrl: anthropicBase,
            apiKey: req?.anthropic?.apiKey ? env.crypto().encrypt(req.anthropic.apiKey) : row.anthropic.apiKey,
          },
          models: req?.models ?? row.models,
        }
        list[idx] = next
        await env.store().put('providers', list)
        return masked(next)
      },
    },
    {
      method: 'DELETE', path: 'delete/{id}', summary: '删除供应商',
      handle: async (env, params) => {
        const list = (await env.store().get<Provider[]>('providers')) ?? []
        const row = list.find((p) => p.id === Number(params.id))
        if (!row) throw new Error(`供应商不存在: ${params.id}`)
        await env.store().put('providers', list.filter((p) => p.id !== row.id))
        env.warn(`删除供应商：${row.name}`)
        return null
      },
    },
    {
      method: 'POST', path: 'test', summary: '连接测试（compat=openai|anthropic，用已存密钥）',
      handle: async (env, _params, body) => {
        const req = body as { id?: number; compat?: string; timeoutSeconds?: number }
        const compat = req?.compat === 'anthropic' ? 'anthropic' : 'openai'
        const timeoutMs = Math.max(1, Math.min(30, Number(req?.timeoutSeconds) || 5)) * 1000
        if (req?.id == null) throw new Error('缺少供应商 id')
        const list = (await env.store().get<Provider[]>('providers')) ?? []
        const row = list.find((p) => p.id === Number(req.id))
        if (!row) throw new Error(`供应商不存在: ${req.id}`)
        const endpoint = compat === 'anthropic' ? row.anthropic : row.openai
        const label = compat === 'anthropic' ? 'Anthropic 兼容' : 'OpenAI 兼容'
        const baseUrl = endpoint.baseUrl.replace(/\/+$/, '')
        if (!baseUrl) return { success: false, message: `未配置${label}接口 BaseUrl`, latencyMs: null, httpStatus: null }
        const apiKey = endpoint.apiKey ? env.crypto().decrypt(endpoint.apiKey) : ''
        const started = Date.now()
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const headers: Record<string, string> = { Accept: 'application/json' }
          if (apiKey) {
            if (compat === 'anthropic') headers['x-api-key'] = apiKey
            else headers['Authorization'] = `Bearer ${apiKey}`
          }
          const res = await fetch(`${baseUrl}/models`, { method: 'GET', signal: controller.signal, headers })
          const elapsed = Date.now() - started
          let modelCount: number | null = null
          if (res.ok) {
            try {
              const j = await res.json()
              const arr = j?.data ?? j?.models
              if (Array.isArray(arr)) modelCount = arr.length
            } catch { /* 非 JSON 响应忽略 */ }
          }
          return {
            success: res.ok,
            message: `HTTP ${res.status}${modelCount != null ? `，探测到 ${modelCount} 个模型` : ''}`,
            latencyMs: elapsed,
            httpStatus: res.status,
            modelCount,
          }
        } catch (e) {
          const aborted = (e as Error).name === 'AbortError'
          return { success: false, message: aborted ? `请求超时（${timeoutMs / 1000}s）` : (e as Error).message, latencyMs: Date.now() - started, httpStatus: null }
        } finally {
          clearTimeout(timer)
        }
      },
    },
    {
      method: 'GET', path: 'reference/providers', summary: '模型参考库：供应商列表',
      handle: async (env) => {
        const ref = await referenceOf(env)
        return { source: ref.source, updatedAt: ref.updatedAt, modelCount: ref.modelCount, providers: Object.keys(ref.providers).sort() }
      },
    },
    {
      method: 'POST', path: 'reference/search', summary: '模型参考库：搜索模型',
      handle: async (env, _params, body) => {
        const req = (body ?? {}) as { q?: string; provider?: string; limit?: number }
        const ref = await referenceOf(env)
        const q = (req.q ?? '').trim().toLowerCase()
        const provider = (req.provider ?? '').trim().toLowerCase()
        const limit = Math.max(1, Math.min(200, Number(req.limit) || 50))
        const hits: Array<{ provider: string; modelId: string; name: string; contextTokens: number | null; maxOutputTokens: number | null }> = []
        for (const [prov, models] of Object.entries(ref.providers)) {
          if (provider && prov.toLowerCase() !== provider) continue
          for (const m of models) {
            if (q && !m.modelId.toLowerCase().includes(q) && !(m.name ?? '').toLowerCase().includes(q)) continue
            hits.push({ provider: prov, ...m })
            if (hits.length >= limit) break
          }
          if (hits.length >= limit) break
        }
        return { source: ref.source, updatedAt: ref.updatedAt, q, total: hits.length, models: hits }
      },
    },
    {
      method: 'POST', path: 'reference/refresh', summary: '模型参考库：从 models.dev 拉取最新并缓存',
      handle: async (env) => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 30000)
        try {
          const res = await fetch('https://models.dev/api.json', { signal: controller.signal, headers: { 'User-Agent': 'atlas-providers-plugin' } })
          if (!res.ok) throw new Error(`models.dev 返回 HTTP ${res.status}`)
          const raw = (await res.json()) as { providers?: Record<string, unknown>; models?: unknown[] }
          const models = Array.isArray(raw.models) ? raw.models : []
          const ref = buildReferenceFrom(models)
          await env.store().put(REFERENCE_KEY, ref)
          env.info(`模型参考库已刷新：${ref.modelCount} 个模型 / ${Object.keys(ref.providers).length} 家供应商`)
          return { source: ref.source, updatedAt: ref.updatedAt, modelCount: ref.modelCount, providers: Object.keys(ref.providers).length }
        } catch (e) {
          const aborted = (e as Error).name === 'AbortError'
          throw new Error(aborted ? '拉取超时（30s），请检查网络后重试' : `刷新失败：${(e as Error).message}`)
        } finally {
          clearTimeout(timer)
        }
      },
    },
    {
      method: 'GET', path: 'icons/list', summary: '图标清单（内置 + 自定义）',
      handle: async (env) => {
        const builtinDir = fileURLToPath(new URL('../icons/vendors', import.meta.url.split('?')[0]))
        const builtin = readdirSync(builtinDir).filter((f) => f.toLowerCase().endsWith('.svg')).sort()
        return {
          builtin: builtin.map((f) => ({ name: f, path: `icons/vendors/${f}` })),
          custom: await customIcons(env),
        }
      },
    },
    {
      method: 'POST', path: 'icons/upload', summary: '上传自定义图标（SVG，≤64KB，消毒）',
      handle: async (env, _params, body) => {
        const req = body as { data?: string; name?: string }
        if (!req?.data) throw new Error('缺少图标数据（base64）')
        const buf = Buffer.from(req.data, 'base64')
        if (buf.length > MAX_ICON_BYTES) throw new Error(`图标过大：${(buf.length / 1024).toFixed(1)}KB（上限 64KB）`)
        const raw = buf.toString('utf8')
        const cleaned = sanitizeSvg(raw)
        if (!/^<svg[\s\S]*<\/svg>\s*$/i.test(cleaned)) throw new Error('仅支持 SVG 图标（需以 <svg> 开头、</svg> 结尾）')
        const list = await customIcons(env)
        if (list.length >= MAX_CUSTOM_ICONS) throw new Error(`自定义图标已达上限（${MAX_CUSTOM_ICONS} 个），请先删除部分`)
        const name = `custom-${(req.name ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'icon'}-${Date.now().toString(36)}.svg`
        const dataUrl = `data:image/svg+xml;base64,${Buffer.from(cleaned, 'utf8').toString('base64')}`
        list.push({ name, dataUrl })
        await env.store().put(CUSTOM_ICONS_KEY, list)
        env.info(`上传自定义图标：${name}`)
        return { name, path: dataUrl }
      },
    },
    {
      method: 'DELETE', path: 'icons/{name}', summary: '删除自定义图标',
      handle: async (env, params) => {
        const list = await customIcons(env)
        const name = params.name ?? ''
        if (!name.startsWith('custom-')) throw new Error('内置图标不可删除')
        const next = list.filter((c) => c.name !== name)
        if (next.length === list.length) throw new Error(`图标不存在: ${name}`)
        await env.store().put(CUSTOM_ICONS_KEY, next)
        env.info(`删除自定义图标：${name}`)
        return null
      },
    },
  ],
}

/** 模型参考数据：优先用 refresh 缓存，否则用内置精简版。 */
async function referenceOf(env: PluginEnvironment): Promise<ModelReference> {
  const cached = await env.store().get<ModelReference>(REFERENCE_KEY)
  if (cached?.providers) return cached
  return loadBuiltinReference()
}

/** 把 models.dev api.json 的 models 数组精简为内置格式。 */
function buildReferenceFrom(models: unknown[]): ModelReference {
  const providers: ModelReference['providers'] = {}
  let modelCount = 0
  for (const raw of models) {
    const m = raw as { id?: string; name?: string; context_length?: number; top_provider?: { context_length?: number; max_completion_tokens?: number } }
    const id = m.id ?? ''
    const slash = id.indexOf('/')
    if (slash <= 0) continue
    const prov = id.slice(0, slash)
    const modelId = id.slice(slash + 1)
    if (!modelId) continue
    const ctx = m.context_length ?? m.top_provider?.context_length ?? null
    providers[prov] ??= []
    providers[prov].push({
      modelId,
      name: m.name ?? '',
      contextTokens: ctx ?? null,
      maxOutputTokens: m.top_provider?.max_completion_tokens ?? null,
    })
    modelCount += 1
  }
  for (const p of Object.keys(providers)) {
    providers[p].sort((a, b) => (b.contextTokens ?? 0) - (a.contextTokens ?? 0))
  }
  return { source: 'https://models.dev', updatedAt: new Date().toISOString().slice(0, 10), modelCount, providers }
}

/** 自定义图标列表（store）。 */
async function customIcons(env: PluginEnvironment): Promise<CustomIcon[]> {
  return (await env.store().get<CustomIcon[]>(CUSTOM_ICONS_KEY)) ?? []
}

/** SVG 消毒：剥除 script、事件属性与 javascript: 引用。 */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, '')
    .replace(/xlink:href\s*=\s*["']\s*javascript:[^"']*["']/gi, '')
}

/** 幂等迁移：旧结构（providerType/顶层 baseUrl/apiKey）→ 双兼容接口结构；并始终补齐种子默认接口。 */
async function migrate(env: PluginEnvironment, list: Provider[]): Promise<void> {
  const seedOpenaiByLower = new Map(Object.entries(SEED_OPENAI_URL).map(([k, v]) => [k.toLowerCase(), v]))
  const seedAnthropicByLower = new Map(Object.entries(SEED_ANTHROPIC_URL).map(([k, v]) => [k.toLowerCase(), v]))
  let changed = false
  for (const p of list) {
    const old = p as unknown as Record<string, unknown>
    if ('providerType' in old) {
      // 旧结构转换：按 providerType 归入对应接口
      const legacy = p as unknown as Provider & { providerType?: string; baseUrl?: string; apiKey?: string }
      const compat: CompatEndpoint = { baseUrl: legacy.baseUrl ?? '', apiKey: legacy.apiKey ?? '' }
      p.openai = { baseUrl: '', apiKey: '' }
      p.anthropic = { baseUrl: '', apiKey: '' }
      if (legacy.providerType === 'ANTHROPIC_COMPATIBLE') {
        p.anthropic = compat
      } else if (compat.baseUrl) {
        p.openai = compat
      }
      for (const k of ['providerType', 'baseUrl', 'apiKey', 'defaultModel', 'maxTokens', 'timeoutSeconds', 'extraConfig', 'enabled', 'isDefault', 'sortOrder']) {
        delete old[k]
      }
      changed = true
    }
    // 补缺省接口（幂等：仅补空值，且只对种子供应商）
    const nameKey = p.name.toLowerCase()
    if (!p.openai.baseUrl) {
      const seed = seedOpenaiByLower.get(nameKey)
      if (seed) {
        p.openai.baseUrl = seed
        changed = true
      }
    }
    if (!p.anthropic.baseUrl) {
      const seed = seedAnthropicByLower.get(nameKey)
      if (seed) {
        p.anthropic.baseUrl = seed
        changed = true
      }
    }
  }
  if (changed) {
    await env.store().put('providers', list)
    env.info('供应商数据已迁移/补齐为双兼容接口结构（OpenAI + Anthropic）')
  }
}

/** 密钥脱敏视图：不对外返回密文，仅暴露是否有 Key。 */
function masked(p: Provider) {
  return {
    ...p,
    openai: { baseUrl: p.openai.baseUrl, apiKey: '', apiKeySet: p.openai.apiKey !== '' },
    anthropic: { baseUrl: p.anthropic.baseUrl, apiKey: '', apiKeySet: p.anthropic.apiKey !== '' },
  }
}

export default plugin
