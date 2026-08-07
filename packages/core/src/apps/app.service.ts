import { Inject, Injectable, Logger } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { AppRepository, type AppRow } from './app.repository.js'
import { NotFoundError, ValidationError } from '../common/response.js'
import type { App, AppStatus, CreateAppResult } from '@atlas/types'
import { PluginService } from '../plugins/plugin.service.js'

/** 应用服务：CRUD、凭证（SHA-256）、轮换/吊销/激活、凭证校验。 */
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name)

  constructor(
    @Inject(AppRepository) private readonly repository: AppRepository,
    private readonly pluginService: PluginService,
  ) {}

  static now(): string {
    return new Date().toISOString().slice(0, 19).replace('T', ' ')
  }

  static hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex')
  }

  static toApp(row: AppRow): App {
    return {
      id: row.id,
      appId: row.app_id,
      name: row.name,
      description: row.description,
      status: row.status as AppStatus,
      tokenTtlSeconds: row.token_ttl_seconds,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  create(name: string, description = ''): CreateAppResult {
    if (!name?.trim()) {
      throw new ValidationError('应用名称不能为空')
    }
    const appId = `app_${randomBytes(12).toString('hex')}`
    const secret = randomBytes(32).toString('hex')
    const now = AppService.now()
    const id = this.repository.insert({
      app_id: appId,
      name: name.trim(),
      description,
      app_secret_hash: AppService.hashSecret(secret),
      status: 'ACTIVE',
      token_ttl_seconds: 86400,
      created_at: now,
      updated_at: now,
    })
    this.repository.insertCredential(id, AppService.hashSecret(secret), now)
    this.pluginService.autoInstantiate(id)
    this.logger.log(`创建应用：${name}（${appId}）`)
    return { app: AppService.toApp(this.repository.findById(id)!), secret }
  }

  list(): App[] {
    return this.repository.findAll().map(AppService.toApp)
  }

  get(id: number): App {
    const row = this.repository.findById(id)
    if (!row) throw new NotFoundError(`应用不存在: ${id}`)
    return AppService.toApp(row)
  }

  requireActive(appId: string): App {
    const row = this.repository.findByAppId(appId)
    if (!row) throw new NotFoundError(`应用不存在: ${appId}`)
    if (row.status !== 'ACTIVE') {
      throw new ValidationError(`应用已${row.status === 'REVOKED' ? '吊销' : '暂停'}: ${appId}`)
    }
    return AppService.toApp(row)
  }

  /** 凭证校验：当前 secret 或历史未吊销 secret 均有效（轮换后旧 secret 保留一段时间）。 */
  credentialValid(appId: string, appSecret: string): boolean {
    const row = this.repository.findByAppId(appId)
    if (!row) return false
    const hash = AppService.hashSecret(appSecret ?? '')
    const current = this.repository.findActiveCredentials(row.id)
    return current.includes(hash)
  }

  rotate(id: number): { app: App; secret: string } {
    const row = this.repository.findById(id)
    if (!row) throw new NotFoundError(`应用不存在: ${id}`)
    const secret = randomBytes(32).toString('hex')
    const hash = AppService.hashSecret(secret)
    const now = AppService.now()
    this.repository.updateSecret(id, hash, now)
    this.repository.insertCredential(id, hash, now)
    this.logger.warn(`应用凭证轮换：app=${row.app_id}`)
    return { app: AppService.toApp(this.repository.findById(id)!), secret }
  }

  revoke(id: number): App {
    const row = this.repository.findById(id)
    if (!row) throw new NotFoundError(`应用不存在: ${id}`)
    const now = AppService.now()
    this.repository.updateStatus(id, 'REVOKED', now)
    // 历史凭证全部失效（吊销后不可恢复校验）
    this.repository.revokeAllCredentials(id)
    this.logger.warn(`应用吊销：app=${row.app_id}`)
    return AppService.toApp(this.repository.findById(id)!)
  }

  activate(id: number): App {
    const row = this.repository.findById(id)
    if (!row) throw new NotFoundError(`应用不存在: ${id}`)
    const now = AppService.now()
    this.repository.updateStatus(id, 'ACTIVE', now)
    return AppService.toApp(this.repository.findById(id)!)
  }

  remove(id: number): void {
    const row = this.repository.findById(id)
    if (!row) throw new NotFoundError(`应用不存在: ${id}`)
    this.repository.delete(id)
    this.logger.warn(`删除应用：app=${row.app_id}`)
  }
}
