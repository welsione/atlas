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
}

function env(name: string, def = ''): string {
  return process.env[name] ?? def
}

function int(name: string, def: number): number {
  const raw = env(name)
  if (!raw) return def
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : def
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
  const encKey = env('AIBASE_ENC_KEY', 'aibase-dev-encryption-key-change-me')
  const adminPassword = env('AIBASE_ADMIN_PASSWORD', '')
  const adminKey = env('AIBASE_ADMIN_KEY', '')
  return {
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
    ...overrides,
  }
}

/** 配置提供者（Nest DI）。 */
export const CONFIG = Symbol('AIBaseConfig')

export const configProvider = {
  provide: CONFIG,
  useFactory: () => loadConfig(),
}
