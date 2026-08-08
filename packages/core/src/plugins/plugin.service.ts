import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import type {
  AibasePlugin,
  DatasetPublisher,
  DatasetSource,
  DataScope,
  Ops,
  PluginEnvironment,
  PluginFiles,
  PluginCrypto,
  PluginInstanceContext,
  PluginStore,
} from '@atlas/types'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PluginRegistry } from './plugin.registry.js'
import { PluginRepository } from './plugin.repository.js'
import { OpsLogService } from './ops-log.service.js'
import { DatasetService } from '../datasets/dataset.service.js'
import { PluginFileRegistry } from './plugin-file.registry.js'
import type { LoadedPlugin } from './types.js'
import { NotFoundError, ValidationError } from '../common/response.js'
import { now } from '../common/utils.js'
import { CONFIG, type AIBaseConfig } from '../config.js'


/**
 * 插件服务：注册表同步、实例生命周期（enable/disable/删除）、
 * 单向覆盖校验（SHARED→LOCAL）、环境构建（PluginEnvironment）、通用存储。
 */
@Injectable()
export class PluginService {
  private readonly logger = new Logger(PluginService.name)

  constructor(
    @Inject(CONFIG) private readonly config: AIBaseConfig,
    private readonly registry: PluginRegistry,
    private readonly repository: PluginRepository,
    private readonly opsLogService: OpsLogService,
    @Inject(forwardRef(() => DatasetService)) private readonly datasetService: DatasetService,
    private readonly fileRegistry: PluginFileRegistry,
  ) {}

  // ---------- 注册表同步 ----------

  /** 启动时同步已加载插件到注册表（def 表）。 */
  syncDefs(): void {
    for (const loaded of this.registry.all()) {
      this.upsertDef(loaded.plugin, loaded.plugin.type, loaded.artifact, loaded.artifactHash, loaded.version, loaded.icon, true)
    }
    this.logger.log('插件注册表同步完成')
  }

  private upsertDef(
    plugin: AibasePlugin,
    pluginType: string,
    artifact: string,
    artifactHash: string,
    version: string,
    icon: string,
    loaded: boolean,
  ): void {
    const nowTs = now()
    this.repository.upsertDef({
      pluginType,
      name: plugin.name,
      description: plugin.describe,
      defaultDataScope: plugin.defaultDataScope,
      scopeOverrideAllowed: plugin.scopeOverrideAllowed ?? false,
      artifact,
      artifactHash,
      version,
      icon,
      loaded,
      builtin: artifact === 'builtin',
      createdAt: nowTs,
      updatedAt: nowTs,
    })
  }

  /** 外部插件注册后记录（热加载）。 */
  recordExternal(loaded: LoadedPlugin): void {
    this.upsertDef(loaded.plugin, loaded.plugin.type, loaded.artifact, loaded.artifactHash, loaded.version, loaded.icon, true)
  }

  // ---------- 实例生命周期 ----------

  /** 启用实例（创建或恢复）：scope 单向规则——声明共享可降级为独立；声明独立禁止升级。 */
  enableInstance(appId: number, pluginType: string, requestedScope?: string): import('@atlas/types').PluginInstance {
    const loaded = this.requireLoaded(pluginType)
    const plugin = loaded.plugin
    const existing = this.repository.findInstance(appId, pluginType)
    if (existing) {
      if (requestedScope && requestedScope !== existing.dataScope) {
        existing.dataScope = this.resolveScope(plugin, requestedScope)
        existing.updatedAt = now()
        this.repository.updateInstance({
          id: existing.id, app_id: existing.appId, plugin_type: existing.pluginType,
          data_scope: existing.dataScope, config_json: existing.configJson,
          enabled: existing.enabled ? 1 : 0, created_at: existing.createdAt, updated_at: existing.updatedAt,
        })
      }
      if (!existing.enabled) {
        existing.enabled = true
        existing.updatedAt = now()
        this.repository.updateInstance({
          id: existing.id, app_id: existing.appId, plugin_type: existing.pluginType,
          data_scope: existing.dataScope, config_json: existing.configJson,
          enabled: 1, created_at: existing.createdAt, updated_at: existing.updatedAt,
        })
        this.logger.log(`恢复插件实例：app=${appId}，type=${pluginType}`)
      }
      return existing
    }
    const scope = requestedScope ? this.resolveScope(plugin, requestedScope) : plugin.defaultDataScope
    const nowTs = now()
    const id = this.repository.insertInstance({
      app_id: appId, plugin_type: pluginType, data_scope: scope,
      config_json: '{}', enabled: 1, created_at: nowTs, updated_at: nowTs,
    })
    try {
      const env = this.environmentOf(appId, id, pluginType, scope)
      void plugin.init?.(env)
    } catch (e) {
      this.logger.warn(`插件实例初始化异常（实例仍创建）: type=${pluginType}，${(e as Error).message}`)
    }
    this.logger.log(`启用插件实例：app=${appId}，type=${pluginType}，scope=${scope}`)
    return this.repository.findInstance(appId, pluginType)!
  }

  /** 单向规则解析。 */
  private resolveScope(plugin: AibasePlugin, requested: string): DataScope {
    if (requested !== 'APP_LOCAL' && requested !== 'GLOBAL_SHARED') {
      throw new ValidationError(`非法数据范围: ${requested}`)
    }
    if (requested === 'GLOBAL_SHARED' && plugin.defaultDataScope === 'APP_LOCAL') {
      throw new ValidationError('插件声明为独立数据，禁止覆盖为共享（单向规则）')
    }
    return requested
  }

  /** 停用实例：数据保留，端点/数据访问立即失效。 */
  disableInstance(appId: number, pluginType: string): import('@atlas/types').PluginInstance {
    const inst = this.requireInstance(appId, pluginType)
    if (inst.enabled) {
      inst.enabled = false
      inst.updatedAt = now()
      this.repository.updateInstance({
        id: inst.id, app_id: inst.appId, plugin_type: inst.pluginType,
        data_scope: inst.dataScope, config_json: inst.configJson,
        enabled: 0, created_at: inst.createdAt, updated_at: inst.updatedAt,
      })
    }
    return inst
  }

  /** 删除实例：APP_LOCAL 时清理该应用 store；共享插件只删实例（共享数据保留）。 */
  deleteInstance(appId: number, pluginType: string): void {
    const inst = this.requireInstance(appId, pluginType)
    const loaded = this.registry.byType(pluginType)
    if (loaded) {
      try {
        void loaded.plugin.destroy?.()
      } catch (e) {
        this.logger.warn(`插件销毁钩子异常: ${pluginType}，${(e as Error).message}`)
      }
    }
    if (inst.dataScope === 'APP_LOCAL') {
      // 清理该应用作用域的通用存储（instance_id=appId）；共享 store（0）保留
      this.repository.storeDeleteByScope(appId)
    }
    this.repository.deleteInstance(inst.id)
    this.logger.log(`删除插件实例：app=${appId}，type=${pluginType}`)
  }

  /**
   * 创建应用时自动实例化插件：默认全部已注册插件；可传 pluginTypes 精确指定（创建应用勾选场景）。
   * 未注册/未加载的插件类型静默跳过。
   */
  autoInstantiate(appId: number, pluginTypes?: string[]): void {
    const want = pluginTypes && pluginTypes.length > 0 ? new Set(pluginTypes) : null
    for (const def of this.repository.findAllDefs()) {
      if (want && !want.has(def.pluginType)) continue
      if (!this.repository.findInstance(appId, def.pluginType)) {
        this.enableInstance(appId, def.pluginType)
      }
    }
  }

  /** 卸载插件（软停用 loaded=0，实例/数据保留；重集成恢复）。 */
  unload(pluginType: string): void {
    const loaded = this.registry.byType(pluginType)
    if (!loaded) throw new ValidationError(`插件未加载: ${pluginType}`)
    if (loaded.builtin) throw new ValidationError('内置插件不支持卸载')
    this.registry.unregister(pluginType)
    this.repository.markLoaded(pluginType, false)
    this.logger.warn(`插件已卸载（数据保留）: ${pluginType}`)
  }

  // ---------- 环境与查询 ----------

  instanceOverview(appId: number): Array<{ plugin: import('@atlas/types').PluginDef; instance: import('@atlas/types').PluginInstance | null; runtimeLoaded: boolean }> {
    const instances = new Map(this.repository.findAllInstancesByApp(appId).map((i) => [i.pluginType, i]))
    return this.repository.findAllDefs().map((def) => ({
      plugin: def,
      instance: instances.get(def.pluginType) ?? null,
      runtimeLoaded: this.registry.byType(def.pluginType) !== undefined,
    }))
  }

  requireInstance(appId: number, pluginType: string): import('@atlas/types').PluginInstance {
    const inst = this.repository.findInstance(appId, pluginType)
    if (!inst) throw new NotFoundError(`插件实例不存在: ${appId}/${pluginType}`)
    return inst
  }

  requireLoaded(pluginType: string): LoadedPlugin {
    const loaded = this.registry.byType(pluginType)
    if (!loaded) throw new ValidationError(`插件未注册: ${pluginType}`)
    return loaded
  }

  defOf(pluginType: string): import('@atlas/types').PluginDef | undefined {
    return this.repository.findDefByType(pluginType)
  }

  environment(appId: number, pluginType: string): PluginEnvironment {
    const inst = this.requireInstance(appId, pluginType)
    if (!inst.enabled) throw new ValidationError(`插件实例未启用: ${pluginType}`)
    this.requireLoaded(pluginType)
    return this.environmentOf(appId, inst.id, pluginType, inst.dataScope)
  }

  environmentOrNull(appId: number, pluginType: string): PluginEnvironment | null {
    try {
      return this.environment(appId, pluginType)
    } catch {
      return null
    }
  }

  private environmentOf(appId: number, instanceId: number, pluginType: string, scope: DataScope): PluginEnvironment {
    return new PlatformPluginEnvironment(
      this, this.repository, this.opsLogService, this.datasetService, this.fileRegistry, this.config,
      instanceId, appId, pluginType, scope,
    )
  }

  // ---------- 实例配置 ----------

  updateInstanceConfig(appId: number, pluginType: string, config: Record<string, unknown>): void {
    const inst = this.requireInstance(appId, pluginType)
    this.repository.updateInstanceConfig(inst.id, JSON.stringify(config))
  }

  readConfig(inst: import('@atlas/types').PluginInstance): Record<string, unknown> {
    try {
      return JSON.parse(inst.configJson || '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }
}

/** PluginEnvironment 实现：绑定实例上下文（appId/instanceId/scope）。
 *  store/files 作用域 = scope 决定（GLOBAL_SHARED → 全局一份，APP_LOCAL → 应用一份）。 */
class PlatformPluginEnvironment implements PluginEnvironment {
  constructor(
    private readonly service: PluginService,
    private readonly repository: PluginRepository,
    private readonly opsLogService: OpsLogService,
    private readonly datasetService: DatasetService,
    private readonly fileRegistry: PluginFileRegistry,
    private readonly aibaseConfig: AIBaseConfig,
    private readonly instanceId: number,
    private readonly appId: number,
    private readonly pluginType: string,
    private readonly scope: DataScope,
  ) {}

  /** store 作用域键：GLOBAL_SHARED → 0（全局共享一份）；APP_LOCAL → appId。 */
  private scopeKey(): number {
    return this.scope === 'GLOBAL_SHARED' ? 0 : this.appId
  }

  store(): PluginStore {
    const scopeKey = this.scopeKey()
    return {
      get: async <T = unknown>(entityKey: string, entityId = '') =>
        (this.repository.storeGet(scopeKey, entityKey, entityId) as T | null) ?? null,
      put: async (entityKey: string, value: unknown, entityId = '') =>
        this.repository.storePut(scopeKey, entityKey, entityId, JSON.stringify(value), now()),
      remove: async (entityKey: string, entityId = '') =>
        this.repository.storeRemove(scopeKey, entityKey, entityId),
      list: async <T = unknown>(entityId = '') =>
        this.repository.storeList(scopeKey, entityId).map((r) => JSON.parse(r.value_json) as T),
    }
  }

  files(): PluginFiles {
    const root = resolve(this.aibaseConfig.dataDir, 'plugin-files', String(this.scopeKey()), this.pluginType)
    mkdirSync(root, { recursive: true })
    const safe = (rel: string): string => {
      const normalized = resolve(root, rel.replaceAll('\\', '/').replace(/^\/+/, ''))
      if (!normalized.startsWith(resolve(root))) throw new ValidationError('非法文件路径')
      return normalized
    }
    return {
      write: async (relPath, data) => {
        const target = safe(relPath)
        mkdirSync(resolve(target, '..'), { recursive: true })
        writeFileSync(target, data)
        return relPath
      },
      read: async (relPath) => {
        const target = safe(relPath)
        if (!existsSync(target) || !statSync(target).isFile()) return null
        return readFileSync(target)
      },
      remove: async (relPath) => {
        const target = safe(relPath)
        if (existsSync(target)) rmSync(target, { force: true })
      },
      list: async () => {
        if (!existsSync(root)) return []
        const out: string[] = []
        const walk = (dir: string, prefix: string): void => {
          for (const name of readdirSync(dir)) {
            const full = join(dir, name)
            const rel = prefix ? `${prefix}/${name}` : name
            if (statSync(full).isDirectory()) walk(full, rel)
            else out.push(rel)
          }
        }
        walk(root, '')
        return out
      },
      publish: async (relPath, name) => {
        const target = safe(relPath)
        if (!existsSync(target) || !statSync(target).isFile()) throw new ValidationError('文件不存在')
        return this.fileRegistry.publish(this.scopeKey(), this.pluginType, relPath, target, name ?? relPath)
      },
      unpublish: async (token) => this.fileRegistry.unpublish(token),
    }
  }

  crypto(): PluginCrypto {
    const key = createHash('sha256').update(this.aibaseConfig.encKey + ':' + this.pluginType).digest()
    return {
      encrypt: (plain: string): string => {
        if (!plain) return ''
        const iv = randomBytes(12)
        const cipher = createCipheriv('aes-256-gcm', key, iv)
        const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
        return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64')
      },
      decrypt: (ciphertext: string): string => {
        if (!ciphertext) return ''
        try {
          const data = Buffer.from(ciphertext, 'base64')
          const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12))
          decipher.setAuthTag(data.subarray(data.length - 16))
          return Buffer.concat([decipher.update(data.subarray(12, data.length - 16)), decipher.final()]).toString('utf8')
        } catch {
          return ''
        }
      },
    }
  }

  datasets(): DatasetPublisher {
    const appId = this.appId
    const pluginType = this.pluginType
    return {
      publish: async (datasetKey, name, sensitivity, contentJson) =>
        this.datasetService.publishFromPlugin(appId, pluginType, datasetKey, name, sensitivity, contentJson),
      refresh: async (datasetKey) => this.datasetService.refreshByKey(appId, pluginType, datasetKey),
      upsertSecret: async (datasetKey, keyName, value) =>
        this.datasetService.upsertSecretFromPlugin(appId, pluginType, datasetKey, keyName, value),
      deactivateSecret: async (datasetKey, keyName) =>
        this.datasetService.deactivateSecretFromPlugin(appId, pluginType, datasetKey, keyName),
    }
  }

  datasetSource(): DatasetSource | null {
    const loaded = this.service['registry'].byType(this.pluginType)
    return loaded?.plugin.datasetSource?.() ?? null
  }

  info(message: string): void {
    this.opsLogService.write(this.appId, this.pluginType, 'INFO', message)
  }

  warn(message: string): void {
    this.opsLogService.write(this.appId, this.pluginType, 'WARN', message)
  }

  error(message: string): void {
    this.opsLogService.write(this.appId, this.pluginType, 'ERROR', message)
  }

  config(): Record<string, unknown> {
    const inst = this.repository.findInstance(this.appId, this.pluginType)
    return inst ? this.service.readConfig(inst) : {}
  }

  async updateConfig(config: Record<string, unknown>): Promise<void> {
    this.service.updateInstanceConfig(this.appId, this.pluginType, config)
  }

  instance(): PluginInstanceContext {
    return { appId: this.appId, instanceId: this.instanceId, dataScope: this.scope }
  }

  ops(): Ops {
    return {
      log: async (level, message, detail) =>
        this.opsLogService.write(this.appId, this.pluginType, level, message, detail),
      info: async (message) => this.opsLogService.write(this.appId, this.pluginType, 'INFO', message),
      warn: async (message) => this.opsLogService.write(this.appId, this.pluginType, 'WARN', message),
      error: async (message) => this.opsLogService.write(this.appId, this.pluginType, 'ERROR', message),
    }
  }
}
