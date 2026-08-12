import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { ok, error } from '../common/response.js'
import { AuthService } from './auth.service.js'
import { clientIp, createRateLimiter } from '../common/utils.js'
import { CONFIG, type AtlasConfig } from '../config.js'

/** 登录限流：每 IP 每分钟 10 次尝试。 */
const loginLimiter = createRateLimiter(10, 60_000)

/**
 * 管理认证端点：登录签发 token、认证状态查询。
 */
@Controller('/api/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CONFIG) private readonly config: AtlasConfig,
  ) {}

  @Post('login')
  login(@Body() body: { password?: string }, @Req() req: Request) {
    if (!loginLimiter.allow(clientIp(req, this.config.trustProxy))) {
      return error(400, '登录尝试过于频繁，请 1 分钟后再试')
    }
    if (!this.authService.authEnabled() || this.authService.verifyPassword(body?.password)) {
      return ok({ token: this.authService.issueToken() })
    }
    return error(400, '管理密码错误')
  }

  @Get('status')
  status() {
    return ok({ authEnabled: this.authService.authEnabled() })
  }
}
