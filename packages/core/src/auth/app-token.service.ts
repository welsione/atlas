import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { AppService } from '../apps/app.service.js'
import { ValidationError } from '../common/response.js'

export interface TokenEntry {
  appId: number
  expiresAt: number
}

export interface TokenResult {
  token: string
  expiresIn: number
}

/**
 * 应用令牌服务：app_secret 换短时效 access_token（内存缓存，单机部署）。
 * 吊销即时生效（校验时查询应用状态 + 移除缓存）；过期条目定时清扫防内存泄漏。
 */
@Injectable()
export class AppTokenService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppTokenService.name)
  private readonly tokens = new Map<string, TokenEntry>()
  private sweepTimer: NodeJS.Timeout | null = null

  constructor(@Inject(AppService) private readonly appService: AppService) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => {
      const nowMs = Date.now()
      let removed = 0
      for (const [token, entry] of this.tokens) {
        if (entry.expiresAt < nowMs) {
          this.tokens.delete(token)
          removed += 1
        }
      }
      if (removed > 0) this.logger.debug(`应用令牌过期清理：${removed} 个`)
    }, 60_000)
    this.sweepTimer.unref()
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer)
  }

  issue(appId: string, appSecret: string): TokenResult {
    if (!this.appService.credentialValid(appId, appSecret)) {
      throw new ValidationError('应用凭证无效')
    }
    const app = this.appService.requireActive(appId)
    const token = randomBytes(32).toString('hex')
    const ttlSeconds = app.tokenTtlSeconds
    this.tokens.set(token, { appId: app.id, expiresAt: Date.now() + ttlSeconds * 1000 })
    return { token, expiresIn: ttlSeconds }
  }

  /** 校验令牌：有效且应用 ACTIVE 返回 appId，否则 null。 */
  validate(accessToken: string | undefined | null): number | null {
    if (!accessToken) return null
    const entry = this.tokens.get(accessToken)
    if (!entry || entry.expiresAt < Date.now()) {
      this.tokens.delete(accessToken)
      return null
    }
    try {
      const app = this.appService.get(entry.appId)
      if (app.status !== 'ACTIVE') {
        this.tokens.delete(accessToken)
        return null
      }
      return app.id
    } catch {
      this.tokens.delete(accessToken)
      return null
    }
  }

  revokeAppTokens(appId: number): void {
    for (const [token, entry] of this.tokens) {
      if (entry.appId === appId) this.tokens.delete(token)
    }
  }
}
