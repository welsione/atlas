import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { Dataset, DatasetSensitivity, Page, Secret } from '@atlas/types'
import { DatasetRepository } from './dataset.repository.js'
import { EnvelopeCrypto } from './envelope-crypto.js'
import { PluginService } from '../plugins/plugin.service.js'
import { NotFoundError, ValidationError } from '../common/response.js'
import { createRateLimiter, now } from '../common/utils.js'
import { CONFIG, type AtlasConfig } from '../config.js'
import { PlatformEventEmitter } from '../spi/platform-event-emitter.js'

export interface MetaResult {
  token: string
  name: string
  sensitivity: string
  version: number
  contentHash: string
  assetCount: number
  updatedAt: string
  appId: number
}

export interface ContentResult {
  etag: string
  contentJson: string
}

export interface SecretResult {
  values: Array<{ key: string; value: string }>
  audited: boolean
}

/**
 * 数据集服务：版本化发布（内容哈希驱动）、消费（meta/data/secrets/assets + 304）、
 * 信封加密（SECRET 级）、跨应用授权、访问审计、IP 限流。
 */
@Injectable()
export class DatasetService {
  private readonly logger = new Logger(DatasetService.name)
  /** IP 限流：每分钟每 IP 最多 120 次消费。 */
  private readonly rateLimiter = createRateLimiter(120, 60_000)

  constructor(
    @Inject(CONFIG) private readonly config: AtlasConfig,
    @Inject(DatasetRepository) private readonly repository: DatasetRepository,
    @Inject(EnvelopeCrypto) private readonly crypto: EnvelopeCrypto,
    @Inject(forwardRef(() => PluginService)) private readonly pluginService: PluginService,
    @Inject(PlatformEventEmitter) private readonly eventBus: PlatformEventEmitter,
  ) {}

  static hash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  static randomToken(): string {
    return randomBytes(32).toString('hex')
  }

  // ---------- 管理面 ----------

  list(appId: number): Dataset[] {
    return this.repository.findAllByApp(appId)
  }

  /** 分页列表（管理面）。 */
  listPage(appId: number, page: number, size: number): Page<Dataset> {
    return {
      rows: this.repository.findAllByAppPage(appId, page, size),
      total: this.repository.countByApp(appId),
      page,
      size,
    }
  }

  create(
    appId: number,
    req: {
      name: string
      description?: string
      sensitivity?: DatasetSensitivity
      contentJson?: string
      pluginType?: string
      datasetKey?: string
      refreshMode?: string
      refreshIntervalSeconds?: number | null
    },
  ): Dataset {
    if (!req.name?.trim()) throw new ValidationError('数据集名称不能为空')
    const sensitivity = (req.sensitivity ?? 'PUBLIC') as DatasetSensitivity
    if (!['PUBLIC', 'INTERNAL', 'SECRET'].includes(sensitivity)) {
      throw new ValidationError(`非法敏感度: ${sensitivity}`)
    }
    const contentJson = req.contentJson ?? '{}'
    const datasetKey = req.datasetKey?.trim()
      ? req.datasetKey.trim()
      : `manual-${Date.now()}`
    const dekWrapped = sensitivity === 'SECRET' ? this.crypto.wrapNewDek() : ''
    const nowTs = now()
    const id = this.repository.insert({
      app_id: appId,
      plugin_type: req.pluginType ?? '',
      dataset_key: datasetKey,
      name: req.name.trim(),
      description: req.description ?? '',
      sensitivity,
      token: DatasetService.randomToken(),
      version: 1,
      content_hash: DatasetService.hash(contentJson),
      content_json: contentJson,
      assets_json: '[]',
      dek_wrapped: dekWrapped,
      refresh_mode: req.refreshMode === 'SCHEDULED' ? 'SCHEDULED' : 'MANUAL',
      refresh_interval_seconds: req.refreshIntervalSeconds ?? null,
      last_refreshed_at: null,
      status: 'PUBLISHED',
      created_at: nowTs,
      updated_at: nowTs,
    })
    this.logger.log(`创建数据集：app=${appId}，${req.name}（sensitivity=${sensitivity}）`)
    const created = this.repository.findById(id)!
    this.eventBus.emit('dataset.created', created)
    return created
  }

  update(
    appId: number,
    datasetId: number,
    req: {
      name?: string
      description?: string
      sensitivity?: DatasetSensitivity
      contentJson?: string
    },
  ): Dataset {
    const d = this.requireDataset(appId, datasetId)
    if (d.pluginType) {
      const mutable = ['name', 'description', 'contentJson'] as const
      const touched = mutable.filter((k) => (req as Record<string, unknown>)[k] !== undefined)
      if (touched.length > 0) throw new ValidationError('插件注册数据集仅可调整敏感度')
    }
    if (req.name !== undefined && !req.name?.trim()) throw new ValidationError('数据集名称不能为空')
    const sensitivity = (req.sensitivity ?? d.sensitivity) as DatasetSensitivity
    if (!['PUBLIC', 'INTERNAL', 'SECRET'].includes(sensitivity)) {
      throw new ValidationError(`非法敏感度: ${sensitivity}`)
    }
    const contentJson = req.contentJson ?? d.contentJson
    const hash = DatasetService.hash(contentJson)
    const version = hash === d.contentHash ? d.version : d.version + 1
    let dekWrapped = d.dekWrapped
    if (sensitivity === 'SECRET' && d.sensitivity !== 'SECRET') {
      dekWrapped = this.crypto.wrapNewDek()
    } else if (sensitivity !== 'SECRET' && d.sensitivity === 'SECRET') {
      dekWrapped = ''
    }
    this.repository.updateContent(
      d.id,
      req.name?.trim() ?? d.name,
      req.description !== undefined ? req.description : d.description,
      sensitivity,
      version,
      hash,
      contentJson,
      d.assets.length > 0 ? JSON.stringify(d.assets) : '[]',
      dekWrapped,
      now(),
    )
    this.logger.log(`更新数据集：app=${appId}，${d.name}（sensitivity=${sensitivity}，${hash === d.contentHash ? '版本不变' : `v${d.version}→v${version}`}）`)
    if (d.pluginType && sensitivity !== d.sensitivity) {
      // 密级变更后重新对齐插件内容/敏感凭证
      void this.pluginService.syncPluginDatasets(appId, d.pluginType).catch((e) =>
        this.logger.warn(`插件数据集密级变更后同步失败: ${(e as Error).message}`))
    }
    const updated = this.repository.findById(d.id)!
    this.eventBus.emit('dataset.updated', updated)
    return updated
  }

  remove(appId: number, datasetId: number): void {
    const d = this.requireDataset(appId, datasetId)
    if (d.pluginType) throw new ValidationError('插件注册数据集由插件管理，不可删除')
    this.repository.delete(d.id)
    const dir = this.datasetFilesRoot(d.id)
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    this.logger.warn(`删除数据集：app=${appId}，${d.name}`)
    this.eventBus.emit('dataset.deleted', { appId, datasetId })
  }

  // ---------- 手动数据集资产（管理面） ----------

  /** 资产文件根目录。 */
  private datasetFilesRoot(datasetId: number): string {
    return resolve(this.config.dataDir, 'dataset-files', String(datasetId))
  }

  /** 资产路径安全校验：仅允许相对单段/多段子路径，禁绝对路径与目录穿越。 */
  private safeAssetPath(raw: string): string {
    const p = (raw ?? '').replace(/\\/g, '/').trim()
    if (!p || p.startsWith('/') || p.includes('..') || p.includes('\0') || p.length > 255) {
      throw new ValidationError('非法资产路径')
    }
    return p
  }

  /** 上传资产（multipart 或 base64 统一入口）：写磁盘 + 清单更新（version+1）。 */
  uploadAsset(appId: number, datasetId: number, rawPath: string, mime: string, buffer: Buffer): Dataset {
    const d = this.requireDataset(appId, datasetId)
    if (d.pluginType) throw new ValidationError('插件注册数据集由插件管理，不可上传资产')
    if (!buffer || buffer.length === 0) throw new ValidationError('文件内容为空')
    if (buffer.length > 64 * 1024 * 1024) throw new ValidationError('文件超过 64MB 上限')
    const path = this.safeAssetPath(rawPath || basename('unnamed'))
    const dir = join(this.datasetFilesRoot(d.id), path.split('/').slice(0, -1).join('/'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(this.datasetFilesRoot(d.id), path), buffer)
    const assets = d.assets.filter((a) => a.path !== path)
    assets.push({ path, size: buffer.length, mime: mime || 'application/octet-stream' })
    this.repository.updateAssets(d.id, JSON.stringify(assets), d.version + 1, now())
    this.logger.log(`数据集资产上传：dataset=${d.name}，${path}（${buffer.length}B，v${d.version + 1}）`)
    return this.repository.findById(d.id)!
  }

  /** 删除资产：删磁盘 + 清单更新（version+1）。 */
  removeAsset(appId: number, datasetId: number, rawPath: string): Dataset {
    const d = this.requireDataset(appId, datasetId)
    if (d.pluginType) throw new ValidationError('插件注册数据集由插件管理，不可删除资产')
    const path = this.safeAssetPath(rawPath)
    const exists = d.assets.some((a) => a.path === path)
    if (!exists) throw new NotFoundError(`资产不存在: ${path}`)
    const abs = join(this.datasetFilesRoot(d.id), path)
    if (existsSync(abs)) rmSync(abs)
    const assets = d.assets.filter((a) => a.path !== path)
    this.repository.updateAssets(d.id, JSON.stringify(assets), d.version + 1, now())
    this.logger.log(`数据集资产删除：dataset=${d.name}，${path}，v${d.version + 1}`)
    return this.repository.findById(d.id)!
  }

  // ---------- 插件发布（env.datasets()） ----------

  /** 插件发布/更新数据集：内容哈希驱动版本。返回是否发生版本变更。 */
  publishFromPlugin(
    appId: number,
    pluginType: string,
    datasetKey: string,
    name: string,
    sensitivity: DatasetSensitivity,
    contentJson: string,
  ): boolean {
    const hash = DatasetService.hash(contentJson)
    const existing = this.repository.findDatasetByKey(appId, pluginType, datasetKey)
    const nowTs = now()
    if (existing) {
      if (existing.contentHash === hash) return false
      this.repository.updateContent(
        existing.id, name, existing.description, sensitivity,
        existing.version + 1, hash, contentJson, existing.assets.length > 0 ? JSON.stringify(existing.assets) : '[]',
        existing.dekWrapped, nowTs,
      )
      this.logger.log(`数据集已发布（版本+1）：app=${appId}，key=${datasetKey}，v${existing.version + 1}`)
      this.eventBus.emit('dataset.published', this.repository.findById(existing.id)!)
      return true
    }
    const id = this.repository.insert({
      app_id: appId,
      plugin_type: pluginType,
      dataset_key: datasetKey,
      name,
      description: '',
      sensitivity,
      token: DatasetService.randomToken(),
      version: 1,
      content_hash: hash,
      content_json: contentJson,
      assets_json: '[]',
      dek_wrapped: sensitivity === 'SECRET' ? this.crypto.wrapNewDek() : '',
      refresh_mode: 'MANUAL',
      refresh_interval_seconds: null,
      last_refreshed_at: null,
      status: 'PUBLISHED',
      created_at: nowTs,
      updated_at: nowTs,
    })
    void id
    return true
  }

  // ---------- 敏感凭证（SECRET 级） ----------

  upsertSecretFromPlugin(appId: number, pluginType: string, datasetKey: string, keyName: string, value: string): void {
    const d = this.requireDatasetByKey(appId, pluginType, datasetKey)
    this.upsertSecret(d, keyName, value)
  }

  deactivateSecretFromPlugin(appId: number, pluginType: string, datasetKey: string, keyName: string): void {
    const d = this.requireDatasetByKey(appId, pluginType, datasetKey)
    this.repository.deactivateSecret(d.id, keyName)
  }

  upsertSecret(d: Dataset, keyName: string, value: string): Secret {
    if (d.sensitivity !== 'SECRET') throw new ValidationError('仅 SECRET 级数据集可录入敏感凭证')
    if (!keyName?.trim() || value === undefined) throw new ValidationError('密钥名与值不能为空')
    const dek = this.crypto.unwrapDek(d.dekWrapped)
    const ciphertext = this.crypto.encryptWithDek(dek, value)
    this.repository.deactivateSecret(d.id, keyName)
    this.repository.insertSecret(d.id, keyName.trim(), ciphertext, now())
    this.logger.log(`敏感凭证录入：dataset=${d.name}，key=${keyName}`)
    const rows = this.repository.findActiveSecrets(d.id).filter((s) => s.key_name === keyName)
    return {
      id: rows[rows.length - 1].id,
      datasetId: d.id,
      keyName,
      secretVersion: rows.length,
      active: true,
      createdAt: rows[rows.length - 1].created_at,
      updatedAt: rows[rows.length - 1].created_at,
    }
  }

  // ---------- 授权 ----------

  grant(datasetId: number, appId: number): void {
    this.repository.insertGrant(datasetId, appId)
  }

  revokeGrant(datasetId: number, appId: number): void {
    this.repository.revokeGrant(datasetId, appId)
  }

  grantAppIds(datasetId: number): number[] {
    return this.repository.grantAppIds(datasetId)
  }

  // ---------- 数据面消费 ----------

  /** 插件注册渲染源（注册项优先，回退 datasetSource 兼容）。 */
  private registeredRender(appId: number, pluginType: string, datasetKey: string): ((env: import('@atlas/types').PluginEnvironment) => string | null | Promise<string | null>) | null {
    const reg = this.pluginService.datasetRegistration(appId, pluginType, datasetKey)
    if (reg) return (env) => reg.render(env)
    const env = this.pluginService.environmentOrNull(appId, pluginType)
    return env?.datasetSource() ? (e) => env.datasetSource()!.render(e) : null
  }

  /** 手动/定时刷新入口：渲染 → 发布（哈希变则版本+1）。注册渲染源 + 发布后同步插件敏感凭证。 */
  refreshByKey(appId: number, pluginType: string, datasetKey: string): Promise<boolean> | boolean {
    const d = this.requireDatasetByKey(appId, pluginType, datasetKey)
    const env = this.pluginService.environmentOrNull(appId, pluginType)
    const render = this.registeredRender(appId, pluginType, datasetKey)
    if (!env || !render) {
      this.repository.updateRefreshMeta(d.id, now())
      return false
    }
    const afterPublish = async () => {
      this.repository.updateRefreshMeta(d.id, now())
      await this.pluginService.syncAssetsFor(appId, pluginType, datasetKey)
      await this.pluginService.syncSecretsFor(appId, pluginType, datasetKey)
    }
    const content = render(env)
    if (content === null) return false
    if (typeof content === 'string') {
      const changed = this.publishFromPlugin(appId, pluginType, datasetKey, d.name, d.sensitivity, content)
      return afterPublish().then(() => changed)
    }
    return content.then(async (resolved) => {
      if (resolved === null) return false
      const changed = this.publishFromPlugin(appId, pluginType, datasetKey, d.name, d.sensitivity, resolved)
      await afterPublish()
      return changed
    })
  }

  /** 插件注册数据集保证存在：创建（v1）或按内容哈希升级；同步注册声明的调度配置。 */
  ensureRegistered(
    appId: number,
    pluginType: string,
    reg: {
      key: string
      name: string
      sensitivity: 'PUBLIC' | 'INTERNAL' | 'SECRET'
      refreshMode?: string
      refreshIntervalSeconds?: number | null
    },
    content: string,
  ): Dataset {
    const existing = this.repository.findDatasetByKey(appId, pluginType, reg.key)
    const hash = DatasetService.hash(content)
    const mode = reg.refreshMode === 'SCHEDULED' ? 'SCHEDULED' : 'MANUAL'
    const interval = reg.refreshIntervalSeconds ?? null
    const nowTs = now()
    if (!existing) {
      const id = this.repository.insert({
        app_id: appId,
        plugin_type: pluginType,
        dataset_key: reg.key,
        name: reg.name,
        description: '',
        sensitivity: reg.sensitivity,
        token: DatasetService.randomToken(),
        version: 1,
        content_hash: hash,
        content_json: content,
        assets_json: '[]',
        dek_wrapped: reg.sensitivity === 'SECRET' ? this.crypto.wrapNewDek() : '',
        refresh_mode: mode,
        refresh_interval_seconds: interval,
        last_refreshed_at: nowTs,
        status: 'PUBLISHED',
        created_at: nowTs,
        updated_at: nowTs,
      })
      this.logger.log(`插件注册数据集已创建：app=${appId}，${pluginType}/${reg.key}（sensitivity=${reg.sensitivity}，v1）`)
      return this.repository.findById(id)!
    }
    if (existing.contentHash !== hash) {
      this.repository.updateContent(
        existing.id, existing.name, existing.description, existing.sensitivity,
        existing.version + 1, hash, content,
        existing.assets.length > 0 ? JSON.stringify(existing.assets) : '[]',
        existing.dekWrapped, nowTs,
      )
      this.logger.log(`插件注册数据集已发布（版本+1）：app=${appId}，${pluginType}/${reg.key}，v${existing.version + 1}`)
    }
    if (existing.refreshMode !== mode || existing.refreshIntervalSeconds !== interval) {
      this.repository.updateRefreshSchedule(existing.id, mode, interval)
    }
    return this.repository.findById(existing.id)!
  }

  meta(token: string): MetaResult {
    const d = this.requireByToken(token)
    return {
      token: d.token,
      name: d.name,
      sensitivity: d.sensitivity,
      version: d.version,
      contentHash: d.contentHash,
      assetCount: d.assets.length,
      updatedAt: d.updatedAt,
      appId: d.appId,
    }
  }

  recordMetaAccess(token: string, consumerAppId: number | null, ip: string, ua: string): void {
    const d = this.requireByToken(token)
    this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'meta', 200, 0, ip, ua)
  }

  /** 内容消费：304 条件请求 + 限流 + 审计。 */
  data(token: string, ifNoneMatch: string | undefined, consumerAppId: number | null, ip: string, ua: string): ContentResult {
    const d = this.requireByToken(token)
    // 鉴权与限流必须先于 304 短路，否则持有分发 token 的匿名调用者可绕过密级鉴权与限流刷审计日志
    if (!this.checkConsumeAllowed(d, consumerAppId)) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'data', 400, 0, ip, ua)
      throw new ValidationError('未授权访问该数据集')
    }
    if (!this.rateLimiter.allow(ip)) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'data', 429, 0, ip, ua)
      throw new ValidationError('下载过于频繁，请稍后再试')
    }
    const etag = `"${d.contentHash}"`
    const notModified = ifNoneMatch && ifNoneMatch.replace(/^W\//, '') === etag
    if (notModified) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'data', 304, 0, ip, ua)
      return { etag, contentJson: '' }
    }
    const bytes = Buffer.byteLength(d.contentJson, 'utf8')
    this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'data', 200, bytes, ip, ua)
    this.repository.insertDownloadLog(d.id, consumerAppId, consumerAppId === null ? d.token : '', ip, ua, bytes)
    return { etag, contentJson: d.contentJson }
  }

  /** 资产消费：鉴权 + 路径校验 + 懒加载（插件）或磁盘读取（手动）+ 304 + 审计。 */
  async asset(token: string, rawPath: string, ifNoneMatch: string | undefined, consumerAppId: number | null, ip: string, ua: string): Promise<{
    buffer: Buffer
    mime: string
    etag: string
    notModified: boolean
  }> {
    const d = this.requireByToken(token)
    if (!this.checkConsumeAllowed(d, consumerAppId)) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'asset', 400, 0, ip, ua)
      throw new ValidationError('未授权访问该数据集')
    }
    if (!this.rateLimiter.allow(ip)) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'asset', 429, 0, ip, ua)
      throw new ValidationError('下载过于频繁，请稍后再试')
    }
    const path = this.safeAssetPath(rawPath)
    const assetMeta = d.assets.find((a) => a.path === path)
    if (!assetMeta) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'asset', 404, 0, ip, ua)
      throw new NotFoundError(`资产不存在: ${path}`)
    }
    // ETag 必须纯 ASCII：path 可能含非 ASCII（中文文件名等），用其 hash 前缀
    const etag = `"${d.updatedAt}:${DatasetService.hash(path).slice(0, 16)}"`
    if (ifNoneMatch && ifNoneMatch.replace(/^W\//, '') === etag) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'asset', 304, 0, ip, ua)
      return { buffer: Buffer.alloc(0), mime: assetMeta.mime, etag, notModified: true }
    }
    let buffer: Buffer | null = null
    if (d.pluginType) {
      buffer = await this.pluginService.assetSourceFor(d.appId, d.pluginType, d.datasetKey, path)
    } else {
      const abs = join(this.datasetFilesRoot(d.id), path)
      if (existsSync(abs)) buffer = readFileSync(abs)
    }
    if (!buffer) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'asset', 404, 0, ip, ua)
      throw new NotFoundError(`资产不可用: ${path}`)
    }
    this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'asset', 200, buffer.length, ip, ua)
    return { buffer, mime: assetMeta.mime, etag, notModified: false }
  }

  /** SECRET 消费：Bearer 令牌 + 授权 + 每次取用审计。 */
  secrets(token: string, consumerAppId: number | null, ip: string, ua: string): SecretResult {
    const d = this.requireByToken(token)
    if (d.sensitivity !== 'SECRET') {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'secrets', 400, 0, ip, ua)
      throw new ValidationError('该数据集非 SECRET 级')
    }
    if (consumerAppId === null) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'secrets', 400, 0, ip, ua)
      throw new ValidationError('SECRET 数据集需要 Bearer 应用令牌')
    }
    if (!this.checkConsumeAllowed(d, consumerAppId)) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'secrets', 400, 0, ip, ua)
      throw new ValidationError('未授权访问该数据集')
    }
    // 最敏感的明文密钥端点必须限流，防止被授权的 app 或泄露的 app 令牌无限拉取
    if (!this.rateLimiter.allow(ip)) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'secrets', 429, 0, ip, ua)
      throw new ValidationError('下载过于频繁，请稍后再试')
    }
    const dek = this.crypto.unwrapDek(d.dekWrapped)
    const rows = this.repository.findActiveSecrets(d.id)
    const values = rows.map((s) => {
      this.repository.insertSecretAccessLog(s.id, d.id, consumerAppId!, ip)
      return { key: s.key_name, value: this.crypto.decryptWithDek(dek, s.ciphertext) }
    })
    this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'secrets', 200, 0, ip, ua)
    return { values, audited: true }
  }

  /** SECRET 数据集未授权访问记录（controller 调用）。 */
  recordSecretDenied(token: string, consumerAppId: number | null, ip: string, ua: string): void {
    const d = this.requireByToken(token)
    this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'secrets', 400, 0, ip, ua)
  }

  // ---------- 审计查询（管理面） ----------

  audit(datasetId: number): Record<string, unknown> {
    return {
      downloadLogs: this.repository.downloadLogs(datasetId),
      secretAccessLogs: this.repository.secretAccessLogs(datasetId),
      secretHistory: this.repository.secretHistory(datasetId),
    }
  }

  // ---------- 内部 ----------

  /** 非抛错定位（插件注册同步用）。 */
  findByKeyOrNull(appId: number, pluginType: string, datasetKey: string): Dataset | null {
    return this.repository.findDatasetByKey(appId, pluginType, datasetKey) ?? null
  }

  /** 插件资产清单落库（syncAssetsFor 调用）：变更 bump 版本。 */
  applyAssets(datasetId: number, assetsJson: string): void {
    const d = this.repository.findById(datasetId)
    if (!d) return
    this.repository.updateAssets(datasetId, assetsJson, d.version + 1, now())
  }

  /** 当前有效敏感凭证 keyName 列表（插件凭证对齐用）。 */
  activeSecretNames(datasetId: number): string[] {
    return this.repository.findActiveSecrets(datasetId).map((s) => s.key_name)
  }

  /** 消费授权：PUBLIC 任意；属主应用始终豁免（INTERNAL/SECRET 均可自消费）；其余按 grant。 */
  private checkConsumeAllowed(d: Dataset, consumerAppId: number | null): boolean {
    if (d.sensitivity === 'PUBLIC') return true
    if (consumerAppId === null) return false
    if (consumerAppId === d.appId) return true
    if (d.sensitivity === 'INTERNAL') return this.repository.hasGrant(d.id, consumerAppId)
    return this.repository.hasGrant(d.id, consumerAppId)
  }

  private requireDataset(appId: number, datasetId: number): Dataset {
    const d = this.repository.findById(datasetId)
    if (!d || d.appId !== appId) throw new NotFoundError(`数据集不存在: ${datasetId}`)
    return d
  }

  private requireDatasetByKey(appId: number, pluginType: string, datasetKey: string): Dataset {
    const d = this.repository.findDatasetByKey(appId, pluginType, datasetKey)
    if (!d) throw new NotFoundError(`数据集不存在: ${pluginType}/${datasetKey}`)
    return d
  }

  private requireByToken(token: string): Dataset {
    if (!token || token.length < 16) throw new NotFoundError('数据集不存在')
    const d = this.repository.findByToken(token)
    if (!d || d.status !== 'PUBLISHED') throw new NotFoundError('数据集不存在')
    return d
  }
}
