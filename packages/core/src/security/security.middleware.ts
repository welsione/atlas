import { Inject, Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { CONFIG, type AIBaseConfig } from '../config.js'
import { AuthService } from './auth.service.js'
import { IpRuleRepository } from './ip-rule.repository.js'
import { clientIp } from '../common/utils.js'

/**
 * 统一安全过滤器（全局中间件）：
 * - IP 黑名单：命中返回 403（覆盖全部 /api/** 请求）
 * - 管理认证：非公开端点需 Bearer token 或 X-AIBase-Key（未配置密钥时放行本地开发）
 * - 安全响应头：nosniff / X-Frame-Options
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  /** 公开端点：公开文件下载、数据面消费（/api/v1/：app 令牌换发 + 数据集消费）、插件 UI 资源。 */
  private static readonly PUBLIC_PREFIXES = ['/api/files/', '/api/auth/', '/api/v1/', '/_pluginui/']

  constructor(
    @Inject(CONFIG) private readonly config: AIBaseConfig,
    private readonly authService: AuthService,
    private readonly ipRuleRepository: IpRuleRepository,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const path = req.originalUrl?.split('?')[0] ?? req.path
    if (!path.startsWith('/api/')) {
      next()
      return
    }
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')

    const ip = clientIp(req, this.config.trustProxy)
    if (this.ipRuleRepository.isBlocked(ip)) {
      res.status(403).json({ code: 403, message: '该 IP 已被禁止访问', data: null })
      return
    }

    if (this.isPublic(path)) {
      next()
      return
    }
    if (!this.authService.authEnabled()) {
      next()
      return
    }
    const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '')
    const adminKey = req.header('x-aibase-key')
    if (this.authService.verifyToken(bearer) || this.authService.verifyAdminKey(adminKey)) {
      next()
      return
    }
    res.status(401).json({ code: 401, message: '未认证：请先登录或携带管理 Token', data: null })
  }

  private isPublic(path: string): boolean {
    return SecurityMiddleware.PUBLIC_PREFIXES.some((p) => path.startsWith(p))
  }
}
