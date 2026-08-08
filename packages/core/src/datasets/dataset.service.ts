import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import type { Dataset, DatasetSensitivity, Secret } from '@atlas/types'
import { DatasetRepository } from './dataset.repository.js'
import { EnvelopeCrypto } from './envelope-crypto.js'
import { PluginService } from '../plugins/plugin.service.js'
import { NotFoundError, ValidationError } from '../common/response.js'
import { createRateLimiter, now } from '../common/utils.js'
import { CONFIG, type AIBaseConfig } from '../config.js'

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
    @Inject(CONFIG) private readonly config: AIBaseConfig,
    private readonly repository: DatasetRepository,
    private readonly crypto: EnvelopeCrypto,
    @Inject(forwardRef(() => PluginService)) private readonly pluginService: PluginService,
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
    return this.repository.findById(id)!
  }

  remove(appId: number, datasetId: number): void {
    const d = this.requireDataset(appId, datasetId)
    this.repository.delete(d.id)
    this.logger.warn(`删除数据集：app=${appId}，${d.name}`)
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

  /** 手动/定时刷新入口：渲染 → 发布（哈希变则版本+1）。 */
  refreshByKey(appId: number, pluginType: string, datasetKey: string): Promise<boolean> | boolean {
    const d = this.requireDatasetByKey(appId, pluginType, datasetKey)
    const env = this.pluginService.environmentOrNull(appId, pluginType)
    if (!env || !env.datasetSource()) {
      this.repository.updateRefreshMeta(d.id, now())
      return false
    }
    const content = env.datasetSource()!.render(env)
    if (content === null) return false
    if (typeof content === 'string') {
      const changed = this.publishFromPlugin(appId, pluginType, datasetKey, d.name, d.sensitivity, content)
      this.repository.updateRefreshMeta(d.id, now())
      return changed
    }
    return content.then((resolved) => {
      if (resolved === null) return false
      const changed = this.publishFromPlugin(appId, pluginType, datasetKey, d.name, d.sensitivity, resolved)
      this.repository.updateRefreshMeta(d.id, now())
      return changed
    })
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
    const etag = `"${d.contentHash}"`
    const status = ifNoneMatch && ifNoneMatch.replace(/^W\//, '') === etag ? 304 : 200
    if (status === 304) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'data', 304, 0, ip, ua)
      return { etag, contentJson: '' }
    }
    if (!this.checkConsumeAllowed(d, consumerAppId)) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'data', 400, 0, ip, ua)
      throw new ValidationError('未授权访问该数据集')
    }
    if (!this.rateLimiter.allow(ip)) {
      this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'data', 429, 0, ip, ua)
      throw new ValidationError('下载过于频繁，请稍后再试')
    }
    const bytes = Buffer.byteLength(d.contentJson, 'utf8')
    this.repository.insertAccessLog(d.appId, consumerAppId, 'DATASET', d.id, d.token, 'data', 200, bytes, ip, ua)
    this.repository.insertDownloadLog(d.id, consumerAppId, consumerAppId === null ? d.token : '', ip, ua, bytes)
    return { etag, contentJson: d.contentJson }
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
