import { Body, Controller, Post, Req, Inject } from '@nestjs/common'
import type { Request } from 'express'
import { ok, error } from '../common/response.js'
import { AppTokenService } from './app-token.service.js'

/**
 * 数据面消费凭证端点：应用用 app_id + app_secret 换取短时效令牌。
 */
@Controller('/api/v1/app')
export class AppAuthController {
  constructor(@Inject(AppTokenService) private readonly tokenService: AppTokenService) {}

  @Post('auth')
  auth(@Body() body: { appId?: string; appSecret?: string }, @Req() req: Request) {
    try {
      const result = this.tokenService.issue(body?.appId ?? '', body?.appSecret ?? '')
      return ok(result)
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }
}
