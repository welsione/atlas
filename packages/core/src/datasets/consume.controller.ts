import { Controller, Get, Header, Headers, Param, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ok, error } from '../common/response.js'
import { DatasetService } from './dataset.service.js'
import { AppTokenService } from '../auth/app-token.service.js'

/**
 * 数据面消费端点（公开前缀 /api/v1/）：
 * meta/data/secrets —— Bearer 令牌解析消费方 + 304 条件请求 + 审计。
 */
@Controller('/api/v1/datasets')
export class DatasetConsumeController {
  constructor(
    private readonly service: DatasetService,
    private readonly tokenService: AppTokenService,
  ) {}

  @Get(':token/meta')
  meta(@Param('token') token: string, @Req() req: Request) {
    const { appId } = this.consumeContext(req)
    this.service.recordMetaAccess(token, appId, clientIp(req), req.header('user-agent') ?? '')
    return ok(this.service.meta(token))
  }

  @Get(':token/data')
  @Header('Cache-Control', 'no-cache')
  data(@Param('token') token: string, @Headers('if-none-match') ifNoneMatch: string | undefined, @Req() req: Request, @Res() res: Response) {
    const { appId } = this.consumeContext(req)
    try {
      const result = this.service.data(token, ifNoneMatch, appId, clientIp(req), req.header('user-agent') ?? '')
      res.setHeader('ETag', result.etag)
      if (result.contentJson === '') {
        res.status(304).end()
        return
      }
      return res.json(ok(JSON.parse(result.contentJson)))
    } catch (e) {
      if (e instanceof Error && e.message.includes('过于频繁')) {
        return res.status(429).json(error(429, e.message))
      }
      return res.status(404).json(error(404, (e as Error).message))
    }
  }

  @Get(':token/secrets')
  secrets(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    const { appId } = this.consumeContext(req)
    try {
      const result = this.service.secrets(token, appId, clientIp(req), req.header('user-agent') ?? '')
      return res.json(ok(result))
    } catch (e) {
      const err = e as Error
      if (err.message.includes('非 SECRET') || err.message.includes('未授权') || err.message.includes('Bearer')) {
        this.service.recordSecretDenied(token, appId, clientIp(req), req.header('user-agent') ?? '')
        return res.status(400).json(error(400, err.message))
      }
      return res.status(404).json(error(404, err.message))
    }
  }

  /** Bearer 令牌解析：有效则返回消费方 appId，否则 null（匿名）。 */
  private consumeContext(req: Request): { appId: number | null } {
    const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '')
    return { appId: this.tokenService.validate(bearer) }
  }
}

export function clientIp(req: Request): string {
  const fwd = req.header('x-forwarded-for')
  if (fwd && fwd.trim() !== '') return fwd.split(',')[0].trim()
  return req.socket.remoteAddress ?? ''
}
