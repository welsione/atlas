import { Inject, Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { CONFIG, type AtlasConfig } from '../config.js'
import { AuthService } from './auth.service.js'
import { IpRuleRepository } from './ip-rule.repository.js'
import { clientIp } from '../common/utils.js'
import { ExtensionRegistry } from '../spi/extension.registry.js'

/**
 * 统一安全过滤器（全局中间件）：
 * - IP 黑名单：命中返回 403（覆盖全部 /api/** 请求）
 * - 管理认证：非公开端点需 Bearer token 或 X-Atlas-Key（未配置密钥时放行本地开发）
 * - 安全响应头：nosniff / X-Frame-Options
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  constructor(
    @Inject(CONFIG) private readonly config: AtlasConfig,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(IpRuleRepository) private readonly ipRuleRepository: IpRuleRepository,
    @Inject(ExtensionRegistry) private readonly extensions: ExtensionRegistry,
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
    const adminKey = req.header('x-atlas-key')
    if (this.authService.verifyToken(bearer) || this.authService.verifyAdminKey(adminKey)) {
      next()
      return
    }
    res.status(401).json({ code: 401, message: '未认证：请先登录或携带管理 Token', data: null })
  }

  /** 公开端点：内置公开文件/数据面/UI 前缀 + 插件声明的 publicUrls() + 运行时注册的 publicUrl()。 */
  private isPublic(path: string): boolean {
    return this.extensions.allPublicUrls().some((p) => path.startsWith(p))
  }
}
