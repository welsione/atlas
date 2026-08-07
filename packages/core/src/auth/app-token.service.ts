import { Inject, Injectable } from '@nestjs/common'
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
 * 吊销即时生效（校验时查询应用状态 + 移除缓存）。
 */
@Injectable()
export class AppTokenService {
  private readonly tokens = new Map<string, TokenEntry>()

  constructor(@Inject(AppService) private readonly appService: AppService) {}

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
