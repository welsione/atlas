import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { CONFIG, type AtlasConfig } from '../config.js'

/**
 * 管理认证：登录签发 HMAC 签名 token，双通道校验（Bearer token / X-Atlas-Key）。
 * 与 Java 版行为一致：ATLAS_ADMIN_PASSWORD（登录密码）与 ATLAS_ADMIN_KEY（固定管理 Token）；
 * 两者均未配置时管理接口开放（本地开发模式）。
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private static readonly TOKEN_TTL_MS = 12 * 60 * 60 * 1000
  private readonly hmacKey: Buffer

  constructor(@Inject(CONFIG) private readonly config: AtlasConfig) {
    this.hmacKey = createHash('sha256')
      .update(this.config.encKey || 'atlas-auth')
      .digest()
    if (!this.authEnabled()) {
      this.logger.warn('未配置 ATLAS_ADMIN_PASSWORD / ATLAS_ADMIN_KEY，管理接口未启用认证（仅限本地开发）')
    }
  }

  authEnabled(): boolean {
    return this.config.adminPassword !== '' || this.config.adminKey !== ''
  }

  verifyPassword(password: string | undefined): boolean {
    const expected = this.config.adminPassword
    if (expected === '' || password === undefined) return false
    return safeEqual(expected, password)
  }

  issueToken(): string {
    const payload = Buffer.from(String(Date.now() + AuthService.TOKEN_TTL_MS))
      .toString('base64url')
    return `${payload}.${this.sign(payload)}`
  }

  verifyToken(token: string | undefined | null): boolean {
    if (!token) return false
    const dot = token.indexOf('.')
    if (dot <= 0) return false
    const payload = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    if (!safeEqual(this.sign(payload), sig)) return false
    try {
      const exp = Number(Buffer.from(payload, 'base64url').toString('utf8'))
      return exp > Date.now()
    } catch {
      return false
    }
  }

  verifyAdminKey(key: string | undefined): boolean {
    const expected = this.config.adminKey
    if (expected === '' || key === undefined) return false
    return safeEqual(expected, key)
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.hmacKey).update(payload).digest('base64url')
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
