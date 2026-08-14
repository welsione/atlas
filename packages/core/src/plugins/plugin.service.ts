import { forwardRef, Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import type {
  AtlasPlugin,
  DatasetPublisher,
  DatasetSource,
  DataScope,
  Ops,
  PluginEnvironment,
  PluginFiles,
  PluginCrypto,
  PluginInstanceContext,
  PluginStore,
  PluginEvents,
  PluginApps,
  PluginMonitor,
  PluginSecurity,
  PluginPlatform,
  PluginSpiDependency,
} from '@atlas/types'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PluginRegistry } from './plugin.registry.js'
import { PluginRepository } from './plugin.repository.js'
import { PluginEpTokenRepository } from './plugin-ep-token.repository.js'
import { OpsLogService } from './ops-log.service.js'
import { DatasetService } from '../datasets/dataset.service.js'
import { PluginFileRegistry } from './plugin-file.registry.js'
import type { LoadedPlugin } from './types.js'
import { NotFoundError, ValidationError } from '../common/response.js'
import { now } from '../common/utils.js'
import { CONFIG, type AtlasConfig } from '../config.js'
import { PlatformEventEmitter } from '../spi/platform-event-emitter.js'
import { APP_FACADE, MONITOR_FACADE, SECURITY_FACADE, PLATFORM_FACADE, PLUGIN_SPI_REGISTRY } from '../spi/tokens.js'
import type { AppFacade } from '../spi/app.facade.js'
import type { MonitorFacade } from '../spi/monitor.facade.js'
import type { SecurityFacade } from '../spi/security.facade.js'
import type { PlatformFacade } from '../spi/platform.facade.js'
import type { PluginSpiRegistry } from '../spi/plugin-spi.registry.js'


/**
 * 插件服务：注册表同步、实例生命周期（enable/disable/删除）、
 * 单向覆盖校验（SHARED→LOCAL）、环境构建（PluginEnvironment）、通用存储、双向 SPI 编排。
 */
@Injectable()
export class PluginService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginService.name)
  /** 启用实例创建的 env 追踪：实例销毁/插件卸载时调用 env.dispose() 自动退订事件。 */
  private readonly activeEnvs = new Map<number, PlatformPluginEnvironment>()

  constructor(
    @Inject(CONFIG) private readonly config: AtlasConfig,
    @Inject(PluginRegistry) private readonly registry: PluginRegistry,
    @Inject(PluginRepository) private readonly repository: PluginRepository,
    @Inject(OpsLogService) private readonly opsLogService: OpsLogService,
    @Inject(forwardRef(() => DatasetService)) private readonly datasetService: DatasetService,
    @Inject(PluginFileRegistry) private readonly fileRegistry: PluginFileRegistry,
    @Inject(PluginEpTokenRepository) private readonly epTokens: PluginEpTokenRepository,
    @Inject(PlatformEventEmitter) private readonly eventBus: PlatformEventEmitter,
    @Inject(APP_FACADE) private readonly appFacade: AppFacade,
    @Inject(MONITOR_FACADE) private readonly monitorFacade: MonitorFacade,
    @Inject(SECURITY_FACADE) private readonly securityFacade: SecurityFacade,
    @Inject(PLATFORM_FACADE) private readonly platformFacade: PlatformFacade,
    @Inject(PLUGIN_SPI_REGISTRY) private readonly spiRegistry: PluginSpiRegistry,
  ) {}

  /** 订阅热替换事件：unloaded 清 SPI + dispose 实例 env；loaded 重建 SPI + re-init（对已启用实例）；注入解析级审计回调。 */
  onApplicationBootstrap(): void {
    this.eventBus.on('plugin.unloaded', ({ pluginType }) => {
      this.spiRegistry.unregister(pluginType)
      this.disposeInstancesOf(pluginType)
    })
    this.eventBus.on('plugin.loaded', ({ pluginType }) => {
      this.rebuildSpiFor(pluginType)
      void this.reinitInstancesOf(pluginType)
    })
    // P2-3 跨插件调用审计：能力对象首次构建（缓存 miss）时记录一次，缓存命中不记
    this.spiRegistry.setAuditHook(({ pluginType, namespace, consumerAppId }) => {
      this.opsLogService.write(consumerAppId, pluginType, 'INFO', `跨插件 SPI 调用：${pluginType}/${namespace}`)
    })
  }

  // ---------- 注册表同步 ----------

  /** 启动时同步已加载插件到注册表（def 表）。 */
  syncDefs(): void {
    for (const loaded of this.registry.all()) {
      this.upsertDef(loaded.plugin, loaded.plugin.type, loaded.artifact, loaded.artifactHash, loaded.version, loaded.icon, true)
    }
    this.logger.log('插件注册表同步完成')
  }

  private upsertDef(
    plugin: AtlasPlugin,
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
        const nextScope = this.resolveScope(plugin, requestedScope)
        // scope 变更前先注销旧作用域的 SPI 注册，避免旧 @0/@appId 条目永久残留（规范 R-05）
        this.spiRegistry.unregister(pluginType, appId, existing.dataScope)
        existing.dataScope = nextScope
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
      void this.syncPluginDatasets(appId, pluginType).catch((e) =>
        this.logger.warn(`插件数据集同步异常: ${pluginType}，${(e as Error).message}`))
      // 恢复时重建 SPI（此前可能已注册）+ 同步对外端点 token
      this.registerSpiFor(appId, pluginType, existing.dataScope)
      this.syncEpTokens(appId, pluginType)
      this.eventBus.emit('plugin.enabled', { appId, pluginType, instanceId: existing.id })
      return existing
    }
    const scope = requestedScope ? this.resolveScope(plugin, requestedScope) : plugin.defaultDataScope
    const nowTs = now()
    const id = this.repository.insertInstance({
      app_id: appId, plugin_type: pluginType, data_scope: scope,
      config_json: '{}', enabled: 1, created_at: nowTs, updated_at: nowTs,
    })
    const env = this.environmentOf(appId, id, pluginType, scope)
    this.activeEnvs.set(id, env)
    this.registerSpiFor(appId, pluginType, scope)
    this.syncEpTokens(appId, pluginType)
    void (async () => {
      try {
        await plugin.init?.(env)
      } catch (e) {
        this.logger.warn(`插件实例初始化异常（实例仍创建）: type=${pluginType}，${(e as Error).message}`)
      }
      await this.syncPluginDatasets(appId, pluginType).catch((e) =>
        this.logger.warn(`插件数据集同步异常: ${pluginType}，${(e as Error).message}`))
    })()
    this.logger.log(`启用插件实例：app=${appId}，type=${pluginType}，scope=${scope}`)
    this.eventBus.emit('plugin.enabled', { appId, pluginType, instanceId: id })
    return this.repository.findInstance(appId, pluginType)!
  }

  /** 单向规则解析。 */
  private resolveScope(plugin: AtlasPlugin, requested: string): DataScope {
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
    // 停用 → 对外端点 token 立即注销（数据面不可用）
    this.epTokens.removeByPlugin(appId, pluginType)
    this.eventBus.emit('plugin.disabled', { appId, pluginType, instanceId: inst.id })
    return inst
  }

  /** 删除实例：APP_LOCAL 时清理该应用 store；共享插件只删实例（共享数据保留）。 */
  deleteInstance(appId: number, pluginType: string): void {
    const inst = this.requireInstance(appId, pluginType)
    // 注意：这里不调用插件级 destroy()——destroy 无实例上下文，删除单实例时调用会
    // 误伤其他应用共享的插件运行时状态（规范 R-01）。实例级清理见下方 store/事件/SPI 注销。
    // 删除 → 对外端点 token 注销
    this.epTokens.removeByPlugin(appId, pluginType)
    if (inst.dataScope === 'APP_LOCAL') {
      // 仅清理该插件在该应用的通用存储（instance_id=appId + plugin_type），不动兄弟插件
      this.repository.storeDeleteInstance(appId, pluginType)
    }
    this.activeEnvs.get(inst.id)?.dispose()
    this.activeEnvs.delete(inst.id)
    // 按实例实际作用域精确注销：混合 scope（共享@0 + 本地@appId）时不误减共享实例引用
    this.spiRegistry.unregister(pluginType, appId, inst.dataScope)
    this.repository.deleteInstance(inst.id)
    this.logger.log(`删除插件实例：app=${appId}，type=${pluginType}`)
    this.eventBus.emit('plugin.deleted', { appId, pluginType })
  }

  /**
   * 创建应用时自动实例化插件：默认全部已注册插件；可传 pluginTypes 精确指定（创建应用勾选场景）。
   * 未注册/未加载的插件类型静默跳过。对声明 dependsOn 的插件做拓扑排序（先启用被依赖方），环检测拒绝。
   */
  autoInstantiate(appId: number, pluginTypes?: string[]): void {
    const want = pluginTypes && pluginTypes.length > 0 ? new Set(pluginTypes) : null
    const pending = this.repository
      .findAllDefs()
      .filter((d) => d.loaded && (!want || want.has(d.pluginType)) && !this.repository.findInstance(appId, d.pluginType))
      .map((d) => d.pluginType)
    if (pending.length === 0) return

    const { order, cycles } = topoSortPlugins(pending, (t) => this.dependenciesOf(t))
    for (const cyc of cycles) {
      this.logger.error(`插件依赖存在环，已跳过启用: ${cyc.join(' → ')}`)
    }
    const inCycle = new Set(cycles.flat())
    for (const t of order) {
      if (inCycle.has(t)) continue // 环成员拒绝启用
      this.enableInstance(appId, t)
    }
  }

  /** 插件声明的依赖 pluginType 集合（去重）；带 spi 字段的依赖项做存在性校验
   *  （提供方已加载且 provides() 暴露该命名空间），不满足 warn（不抛错，不影响排序）。 */
  private dependenciesOf(pluginType: string): string[] {
    const loaded = this.registry.byType(pluginType)
    const deps = loaded?.plugin.dependsOn?.() ?? []
    for (const d of deps) {
      const st = this.dependencyStatus(d)
      if (d.spi && !st.satisfied) {
        this.logger.warn(`依赖声明不满足: ${pluginType} 依赖 ${d.pluginType}/${d.spi}（${st.reason}）`)
      }
    }
    return [...new Set(deps.map((d: PluginSpiDependency) => d.pluginType))]
  }

  /** 单个依赖项的满足状态（结构化；供 spiOverview 管理面查询复用，不产生告警）。 */
  private dependencyStatus(d: PluginSpiDependency): { pluginType: string; spi?: string; satisfied: boolean; reason?: string } {
    const target = this.registry.byType(d.pluginType)
    if (!target) return { pluginType: d.pluginType, spi: d.spi, satisfied: false, reason: 'NOT_LOADED' }
    if (d.spi) {
      const exposed = target.plugin.provides?.() ?? {}
      if (!exposed[d.spi]) return { pluginType: d.pluginType, spi: d.spi, satisfied: false, reason: 'NOT_EXPOSED' }
    }
    return { pluginType: d.pluginType, spi: d.spi, satisfied: true }
  }

  // ---------- 管理面 SPI 拓扑（P2-1） ----------

  /** SPI 拓扑概览：全部已加载插件的 provides/dependsOn 声明 + 运行时注册状态 + 依赖满足状态 + 环。动态计算，无新表。 */
  spiOverview(): {
    plugins: Array<{
      pluginType: string
      name: string
      provides: Array<{ namespace: string; describe: string; registered: boolean }>
      dependsOn: Array<{ pluginType: string; spi?: string; satisfied: boolean; reason?: string }>
      loaded: boolean
      instancesEnabled: number
    }>
    cycles: string[][]
  } {
    const loaded = this.registry.all()
    const allTypes = loaded.map((l) => l.plugin.type)
    const { cycles } = topoSortPlugins(allTypes, (t) => this.dependenciesOf(t))
    return {
      plugins: loaded.map((l) => {
        const p = l.plugin
        const declared = p.provides?.() ?? {}
        const runtime = new Map(this.spiRegistry.providedNamespaces(p.type).map((r) => [r.namespace, r.registered]))
        return {
          pluginType: p.type,
          name: p.name,
          provides: Object.entries(declared).map(([namespace, exp]) => ({
            namespace,
            describe: exp.describe,
            registered: runtime.get(namespace) ?? false,
          })),
          dependsOn: (p.dependsOn?.() ?? []).map((d) => this.dependencyStatus(d)),
          loaded: true,
          instancesEnabled: this.repository.findAllEnabledInstancesOf(p.type).length,
        }
      }),
      cycles,
    }
  }

  /** 卸载插件（软停用 loaded=0，实例/数据保留；重集成恢复）。 */
  unload(pluginType: string): void {
    const loaded = this.registry.byType(pluginType)
    if (!loaded) throw new ValidationError(`插件未加载: ${pluginType}`)
    this.spiRegistry.unregister(pluginType)
    this.registry.unregister(pluginType)
    this.markDefUnloaded(pluginType)
    this.logger.warn(`插件已卸载（数据保留）: ${pluginType}`)
  }

  /** 标记插件定义未加载（卸载/加载失败时调用；实例与数据保留，重集成可恢复）。 */
  markDefUnloaded(pluginType: string): void {
    this.repository.markLoaded(pluginType, false)
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

  /** 分页插件概览（page 从 1 起，defs 分页取数；instances 一次全量 join 状态）。 */
  instanceOverviewPage(appId: number, page: number, size: number): import('@atlas/types').Page<{
    plugin: import('@atlas/types').PluginDef
    instance: import('@atlas/types').PluginInstance | null
    runtimeLoaded: boolean
  }> {
    const instances = new Map(this.repository.findAllInstancesByApp(appId).map((i) => [i.pluginType, i]))
    return {
      rows: this.repository.findAllDefsPage(page, size).map((def) => ({
        plugin: def,
        instance: instances.get(def.pluginType) ?? null,
        runtimeLoaded: this.registry.byType(def.pluginType) !== undefined,
      })),
      total: this.repository.countDefs(),
      page,
      size,
    }
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

  // ---------- 数据集注册 ----------

  datasetRegistrations(pluginType: string): import('@atlas/types').PluginDatasetRegistration[] {
    const loaded = this.registry.byType(pluginType)
    return loaded?.plugin.datasets?.() ?? []
  }

  /** 插件级按 key 查注册项（不依赖 app）。 */
  datasetRegistration(_appId: number, pluginType: string, key: string): import('@atlas/types').PluginDatasetRegistration | null {
    return this.datasetRegistrations(pluginType).find((r) => r.key === key) ?? null
  }

  /** 同步插件注册数据集：创建/升级内容、调度配置、资产清单、敏感凭证对齐。实例须已启用。 */
  async syncPluginDatasets(appId: number, pluginType: string): Promise<void> {
    const env = this.environmentOrNull(appId, pluginType)
    if (!env) return
    for (const reg of this.datasetRegistrations(pluginType)) {
      try {
        const content = (await reg.render(env)) ?? '{}'
        this.datasetService.ensureRegistered(appId, pluginType, {
          key: reg.key,
          name: reg.name,
          sensitivity: reg.sensitivity ?? 'INTERNAL',
          refreshMode: reg.refreshMode,
          refreshIntervalSeconds: reg.refreshIntervalSeconds,
        }, content)
        await this.syncAssetsFor(appId, pluginType, reg.key)
        await this.syncSecretsFor(appId, pluginType, reg.key)
      } catch (e) {
        this.logger.warn(`插件数据集同步失败：app=${appId}，${pluginType}/${reg.key}，${(e as Error).message}`)
      }
    }
  }

  /** 对齐插件注册的资产清单：变化则写入 assets_json 并 bump 版本。 */
  async syncAssetsFor(appId: number, pluginType: string, datasetKey: string): Promise<void> {
    const reg = this.datasetRegistration(appId, pluginType, datasetKey)
    const env = this.environmentOrNull(appId, pluginType)
    if (!reg?.assets || !env) return
    const d = this.datasetService.findByKeyOrNull(appId, pluginType, datasetKey)
    if (!d) return
    const assets = await reg.assets(env)
    const next = JSON.stringify(assets)
    if (JSON.stringify(d.assets) !== next) {
      this.datasetService.applyAssets(d.id, next)
      this.logger.log(`插件数据集资产已同步：app=${appId}，${pluginType}/${datasetKey}（${assets.length} 项）`)
    }
  }

  /** 经插件注册的 assetSource 懒加载资产字节；无注册源返回 null。 */
  async assetSourceFor(appId: number, pluginType: string, datasetKey: string, path: string): Promise<Buffer | null> {
    const reg = this.datasetRegistration(appId, pluginType, datasetKey)
    const env = this.environmentOrNull(appId, pluginType)
    if (!reg?.assetSource || !env) return null
    try {
      const buf = await reg.assetSource(env, path)
      return buf ? Buffer.from(buf) : null
    } catch {
      return null
    }
  }

  /** 对齐插件注册的敏感凭证：仅 SECRET 级数据集生效；录入存在项、停用已移除项。 */
  async syncSecretsFor(appId: number, pluginType: string, datasetKey: string): Promise<void> {
    const reg = this.datasetRegistration(appId, pluginType, datasetKey)
    const env = this.environmentOrNull(appId, pluginType)
    if (!reg?.secrets || !env) return
    const d = this.datasetService.findByKeyOrNull(appId, pluginType, datasetKey)
    if (!d || d.sensitivity !== 'SECRET') return
    const secrets = await reg.secrets(env)
    for (const [keyName, value] of Object.entries(secrets)) {
      if (value) this.datasetService.upsertSecretFromPlugin(appId, pluginType, datasetKey, keyName, value)
    }
    const active = this.datasetService.activeSecretNames(d.id)
    for (const keyName of active) {
      if (!(keyName in secrets)) this.datasetService.deactivateSecretFromPlugin(appId, pluginType, datasetKey, keyName)
    }
  }

  /** 启动后对全部已启用实例补同步插件注册数据集（存量环境）。 */
  async syncAllEnabledDatasets(): Promise<void> {
    for (const inst of this.repository.findAllEnabled()) {
      try {
        await this.syncPluginDatasets(inst.appId, inst.pluginType)
      } catch (e) {
        this.logger.warn(`启动数据集补同步失败：app=${inst.appId}，${inst.pluginType}，${(e as Error).message}`)
      }
    }
  }

  private environmentOf(appId: number, instanceId: number, pluginType: string, scope: DataScope): PlatformPluginEnvironment {
    return new PlatformPluginEnvironment(
      this, this.repository, this.opsLogService, this.datasetService, this.fileRegistry, this.config,
      this.eventBus, this.appFacade, this.monitorFacade, this.securityFacade, this.platformFacade,
      this.spiRegistry, instanceId, appId, pluginType, scope,
    )
  }

  // ---------- 双向 SPI 编排 ----------

  /** 实例启用时注册其暴露的 SPI（provides() 非空才注册）。 */
  private registerSpiFor(appId: number, pluginType: string, scope: DataScope): void {
    const loaded = this.registry.byType(pluginType)
    const exports = loaded?.plugin.provides?.() ?? null
    if (!exports || Object.keys(exports).length === 0) return
    // 惰性构建：消费方 resolve 时才 buildEnv（此时实例已启用，返回该实例 env）
    this.spiRegistry.register(pluginType, appId, scope, exports, () => this.environmentOrNull(appId, pluginType))
  }

  /** 热替换后对某插件已启用实例重注册 SPI（旧注册已被 unloaded 清除）。 */
  private rebuildSpiFor(pluginType: string): void {
    for (const inst of this.repository.findAllEnabledInstancesOf(pluginType)) {
      this.registerSpiFor(inst.appId, pluginType, inst.dataScope)
      this.syncEpTokens(inst.appId, pluginType)
    }
  }

  /** 同步某应用某插件的对外端点 token：按 endpoints() 中 public:true 声明 upsert，非公开旧 token 注销。 */
  private syncEpTokens(appId: number, pluginType: string): void {
    const loaded = this.registry.byType(pluginType)
    if (!loaded) return
    const declared = (loaded.plugin.endpoints?.() ?? [])
      .filter((e) => e.public === true)
      .map((e) => ({ method: e.method, endpointPath: e.path, sensitivity: e.sensitivity ?? 'PUBLIC' }))
    try {
      this.epTokens.sync(appId, pluginType, declared)
    } catch (e) {
      this.logger.warn(`对外端点 token 同步失败: ${pluginType}，${(e as Error).message}`)
    }
  }

  /** 插件卸载/热替换前，dispose 该插件全部实例（含停用）的 env，退订事件防泄漏（规范 R-03）。 */
  private disposeInstancesOf(pluginType: string): void {
    for (const inst of this.repository.findAllInstancesOf(pluginType)) {
      this.activeEnvs.get(inst.id)?.dispose()
      this.activeEnvs.delete(inst.id)
      // 卸载 → 对外端点 token 注销（重载后经 rebuildSpiFor 重建）
      this.epTokens.removeByPlugin(inst.appId, pluginType)
    }
  }

  /** 插件热替换/重载后，对已启用实例重新 init（幂等）并重建 env 追踪（规范 R-04）。 */
  private async reinitInstancesOf(pluginType: string): Promise<void> {
    const loaded = this.registry.byType(pluginType)
    if (!loaded) return
    for (const inst of this.repository.findAllEnabledInstancesOf(pluginType)) {
      const env = this.environmentOf(inst.appId, inst.id, pluginType, inst.dataScope)
      this.activeEnvs.set(inst.id, env)
      try {
        await loaded.plugin.init?.(env)
      } catch (e) {
        this.logger.warn(`插件热重载后初始化异常（已隔离）: ${pluginType}，${(e as Error).message}`)
      }
      await this.syncPluginDatasets(inst.appId, pluginType).catch((e) =>
        this.logger.warn(`插件数据集同步异常: ${pluginType}，${(e as Error).message}`))
    }
  }

  // ---------- 实例配置 ----------

  updateInstanceConfig(appId: number, pluginType: string, config: Record<string, unknown>): void {
    const inst = this.requireInstance(appId, pluginType)
    this.repository.updateInstanceConfig(inst.id, JSON.stringify(config))
  }

  getInstanceConfig(appId: number, pluginType: string): Record<string, unknown> {
    const inst = this.requireInstance(appId, pluginType)
    return this.readConfig(inst)
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
  /** 本实例订阅的事件退订函数：dispose() 时统一清理（实例销毁/插件卸载）。 */
  private readonly unsubs: Array<() => void> = []

  constructor(
    private readonly service: PluginService,
    private readonly repository: PluginRepository,
    private readonly opsLogService: OpsLogService,
    private readonly datasetService: DatasetService,
    private readonly fileRegistry: PluginFileRegistry,
    private readonly atlasConfig: AtlasConfig,
    private readonly eventBus: PlatformEventEmitter,
    private readonly appFacade: AppFacade,
    private readonly monitorFacade: MonitorFacade,
    private readonly securityFacade: SecurityFacade,
    private readonly platformFacade: PlatformFacade,
    private readonly spiRegistry: PluginSpiRegistry,
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
    const pluginType = this.pluginType
    return {
      get: async <T = unknown>(entityKey: string, entityId = '') =>
        (this.repository.storeGet(scopeKey, pluginType, entityKey, entityId) as T | null) ?? null,
      put: async (entityKey: string, value: unknown, entityId = '') =>
        this.repository.storePut(scopeKey, pluginType, entityKey, entityId, JSON.stringify(value), now()),
      putIfVersion: async (entityKey: string, value: unknown, expectedVersion: number, entityId = '') =>
        this.repository.storePutIfVersion(scopeKey, pluginType, entityKey, entityId, JSON.stringify(value), expectedVersion, now()),
      version: async (entityKey: string, entityId = '') =>
        this.repository.storeVersion(scopeKey, pluginType, entityKey, entityId),
      remove: async (entityKey: string, entityId = '') =>
        this.repository.storeRemove(scopeKey, pluginType, entityKey, entityId),
      list: async <T = unknown>(entityId = '') =>
        this.repository.storeList(scopeKey, pluginType, entityId).map((r) => JSON.parse(r.value_json) as T),
    }
  }

  files(): PluginFiles {
    const root = resolve(this.atlasConfig.dataDir, 'plugin-files', String(this.scopeKey()), this.pluginType)
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
    const key = createHash('sha256').update(this.atlasConfig.encKey + ':' + this.pluginType).digest()
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

  events(): PluginEvents {
    return {
      on: (name, handler) => {
        const unsub = this.eventBus.on(name, handler)
        this.unsubs.push(unsub)
        return unsub
      },
      off: (name, handler) => this.eventBus.off(name, handler),
    }
  }

  apps(): PluginApps {
    return this.appFacade
  }

  monitor(): PluginMonitor {
    // 监控按应用维度：绑定本实例的 appId
    const appId = this.appId
    const facade = this.monitorFacade
    return {
      overview: (range) => facade.overview(appId, range),
      endpoints: (range) => facade.endpoints(appId, range),
      topResources: (range, limit) => facade.topResources(appId, range, limit),
      topIps: (range, limit) => facade.topIps(appId, range, limit),
      topApps: (range, limit) => facade.topApps(appId, range, limit),
      series: (range) => facade.series(appId, range),
      recent: (limit) => facade.recent(appId, limit),
      registerMetric: (def) => facade.registerMetric(def),
    }
  }

  security(): PluginSecurity {
    return this.securityFacade
  }

  platform(): PluginPlatform {
    return this.platformFacade
  }

  spi<T = unknown>(pluginType: string, namespace: string, targetAppId?: number, opts?: { minVersion?: string }): T | null {
    // 缺省以当前实例 appId 作为消费方上下文；GLOBAL_SHARED 提供方任意 app 可解析，APP_LOCAL 仅同 app。
    return this.spiRegistry.resolve<T>(pluginType, namespace, targetAppId ?? this.appId, opts)
  }

  /** 实例销毁/插件卸载时调用：自动退订本实例订阅的全部平台事件。 */
  dispose(): void {
    for (const unsub of this.unsubs.splice(0)) {
      try {
        unsub()
      } catch {
        /* 忽略退订异常 */
      }
    }
  }
}

/**
 * 拓扑排序插件启动顺序（被依赖方在前）。返回 { order, cycles }。
 * cycles 为检测到的全部环路径（含自身环），环路径经旋转规范化去重；环成员不保证顺序，由调用方决定是否启用。
 */
function topoSortPlugins(types: string[], depsOf: (t: string) => string[]): { order: string[]; cycles: string[][] } {
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const order: string[] = []
  const cycles: string[][] = []

  /** 环路径旋转到字典序最小，作为去重键（a→b→a 与 b→a→b 视为同一环）。 */
  const normalize = (cyc: string[]): string => {
    const n = cyc.length
    let best = cyc.join('→')
    for (let i = 1; i < n; i++) {
      const r = [...cyc.slice(i), ...cyc.slice(0, i)].join('→')
      if (r < best) best = r
    }
    return best
  }
  const seen = new Set<string>()

  const visit = (t: string, stack: string[]): void => {
    if (visiting.has(t)) {
      // 找到 back edge：从栈中截取环路径，旋转去重后收集（多环可同时报告）
      const cyc = [...stack.slice(stack.indexOf(t)), t]
      const key = normalize(cyc)
      if (!seen.has(key)) {
        seen.add(key)
        cycles.push(cyc)
      }
      return
    }
    if (visited.has(t)) return
    visiting.add(t)
    for (const dep of depsOf(t)) {
      if (types.includes(dep)) visit(dep, [...stack, t])
    }
    visiting.delete(t)
    visited.add(t)
    order.push(t)
  }

  for (const t of types) {
    if (!visited.has(t) && !visiting.has(t)) visit(t, [])
  }
  return { order, cycles }
}
