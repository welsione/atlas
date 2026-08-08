import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** 平台配置：全部来自环境变量（默认本地开发）。 */
export interface AIBaseConfig {
  port: number
  dataDir: string
  dbPath: string
  /** 信封加密 KEK（数据集 SECRET 级）。 */
  encKey: string
  /** 管理密码（登录用）。 */
  adminPassword: string
  /** 固定管理 Token（X-AIBase-Key 头）。 */
  adminKey: string
  authEnabled: boolean
  pluginScanIntervalMs: number
  datasetRefreshIntervalMs: number
  pluginsDir: string
  /** 是否信任 X-Forwarded-For（部署在可信反向代理后开启；默认 false 防伪造）。 */
  trustProxy: boolean
  /** 开发期重置数据库（每次启动 DROP 全表重建）；生产必须关闭。 */
  devResetDb: boolean
  /** 管理面 CORS 允许来源（逗号分隔；默认 '*'）。 */
  corsOrigin: string
  /** 访问/工作日志保留天数（过期定时清理）。 */
  keepLogDays: number
}

/** 默认开发加密密钥：仅本地开发模式（未启用认证）允许。 */
const DEV_ENC_KEY = 'aibase-dev-encryption-key-change-me'

function env(name: string, def = ''): string {
  return process.env[name] ?? def
}

function int(name: string, def: number): number {
  const raw = env(name)
  if (!raw) return def
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : def
}

function bool(name: string, def = false): boolean {
  const raw = env(name)
  if (!raw) return def
  return raw === '1' || raw.toLowerCase() === 'true'
}

function repoRootOf(): string {
  // 找含 workspaces 字段的根 package.json（monorepo 根）
  let d = process.cwd()
  while (d && d !== '/') {
    const pkgPath = join(d, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
        if (Array.isArray(pkg.workspaces)) return d
      } catch {
        // 忽略解析失败，继续向上
      }
    }
    d = dirname(d)
  }
  return process.cwd()
}

export function loadConfig(overrides: Partial<AIBaseConfig> = {}): AIBaseConfig {
  const dataDir = resolve(env('AIBASE_DATA_DIR', './data'))
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  const encKey = env('AIBASE_ENC_KEY', DEV_ENC_KEY)
  const adminPassword = env('AIBASE_ADMIN_PASSWORD', '')
  const adminKey = env('AIBASE_ADMIN_KEY', '')
  const config: AIBaseConfig = {
    port: int('AIBASE_PORT', 18081),
    dataDir,
    dbPath: env('AIBASE_DB', resolve(dataDir, 'aibase.db')),
    encKey,
    adminPassword,
    adminKey,
    authEnabled: adminPassword !== '' || adminKey !== '',
    pluginScanIntervalMs: int('AIBASE_PLUGIN_SCAN_INTERVAL_MS', 10000),
    datasetRefreshIntervalMs: int('AIBASE_DATASET_REFRESH_INTERVAL_MS', 60000),
    pluginsDir: (() => {
      const explicit = env('AIBASE_PLUGINS_DIR')
      if (explicit) return resolve(explicit)
      const repoPlugins = join(repoRootOf(), 'plugins')
      return existsSync(repoPlugins) ? repoPlugins : resolve(dataDir, 'plugins')
    })(),
    trustProxy: bool('AIBASE_TRUST_PROXY'),
    devResetDb: bool('AIBASE_DEV_RESET_DB'),
    corsOrigin: env('AIBASE_CORS_ORIGIN', '*'),
    keepLogDays: int('AIBASE_KEEP_LOG_DAYS', 30),
    ...overrides,
  }
  // 生产安全闸门：启用认证即视为生产，禁止使用默认开发密钥（SECRET 加密/HMAC 形同虚设）
  if (config.authEnabled && config.encKey === DEV_ENC_KEY) {
    throw new Error('AIBASE_ENC_KEY 未配置：启用认证（生产）时必须显式设置加密密钥，禁止使用默认开发密钥')
  }
  return config
}

/** 配置提供者（Nest DI）。 */
export const CONFIG = Symbol('AIBaseConfig')

export const configProvider = {
  provide: CONFIG,
  useFactory: () => loadConfig(),
}
