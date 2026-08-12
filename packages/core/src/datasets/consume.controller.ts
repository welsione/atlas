import { Controller, Get, Header, Headers, Inject, Param, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ok, error } from '../common/response.js'
import { DatasetService } from './dataset.service.js'
import { AppTokenService } from '../auth/app-token.service.js'
import { clientIp } from '../common/utils.js'
import { textContentType } from '../plugins/plugin-dispatch.utils.js'
import { CONFIG, type AtlasConfig } from '../config.js'

/**
 * 数据面消费端点（公开前缀 /api/v1/）：
 * meta/data/secrets —— Bearer 令牌解析消费方 + 304 条件请求 + 审计。
 */
@Controller('/api/v1/datasets')
export class DatasetConsumeController {
  constructor(
    @Inject(DatasetService) private readonly service: DatasetService,
    @Inject(AppTokenService) private readonly tokenService: AppTokenService,
    @Inject(CONFIG) private readonly config: AtlasConfig,
  ) {}

  @Get(':token/meta')
  meta(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    const { appId } = this.consumeContext(req)
    try {
      const meta = this.service.meta(token)
      this.service.recordMetaAccess(token, appId, clientIp(req, this.config.trustProxy), req.header('user-agent') ?? '')
      return res.json(ok(meta))
    } catch {
      return res.status(404).json(error(404, '数据集不存在'))
    }
  }

  @Get(':token/data')
  @Header('Cache-Control', 'no-cache')
  data(@Param('token') token: string, @Headers('if-none-match') ifNoneMatch: string | undefined, @Req() req: Request, @Res() res: Response) {
    const { appId } = this.consumeContext(req)
    try {
      const result = this.service.data(token, ifNoneMatch, appId, clientIp(req, this.config.trustProxy), req.header('user-agent') ?? '')
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
      // 未知异常不透出内部细节（解密失败/解析错误等），统一 404 泛化
      return res.status(404).json(error(404, '内容不可用'))
    }
  }

  @Get(':token/secrets')
  secrets(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    const { appId } = this.consumeContext(req)
    try {
      const result = this.service.secrets(token, appId, clientIp(req, this.config.trustProxy), req.header('user-agent') ?? '')
      return res.json(ok(result))
    } catch (e) {
      const err = e as Error
      if (err.message.includes('过于频繁')) {
        return res.status(429).json(error(429, err.message))
      }
      if (err.message.includes('非 SECRET') || err.message.includes('Bearer')) {
        this.service.recordSecretDenied(token, appId, clientIp(req, this.config.trustProxy), req.header('user-agent') ?? '')
        return res.status(404).json(error(404, '数据集不存在'))
      }
      if (err.message.includes('未授权')) {
        this.service.recordSecretDenied(token, appId, clientIp(req, this.config.trustProxy), req.header('user-agent') ?? '')
        return res.status(404).json(error(404, '数据集不存在'))
      }
      // 未知异常不透出内部细节
      return res.status(404).json(error(404, '内容不可用'))
    }
  }

  @Get(':token/assets/:path(*)')
  @Header('Cache-Control', 'no-cache')
  async asset(@Param('token') token: string, @Param('path') path: string, @Headers('if-none-match') ifNoneMatch: string | undefined, @Req() req: Request, @Res() res: Response) {
    const { appId } = this.consumeContext(req)
    try {
      const result = await this.service.asset(token, path, ifNoneMatch, appId, clientIp(req, this.config.trustProxy), req.header('user-agent') ?? '')
      res.setHeader('ETag', result.etag)
      // 文本类资产声明 UTF-8，防止浏览器按本地编码（GBK）解码中文乱码
      res.setHeader('Content-Type', textContentType(result.mime))
      if (result.notModified) {
        res.status(304).end()
        return
      }
      res.setHeader('Content-Length', result.buffer.length)
      return res.send(result.buffer)
    } catch (e) {
      const err = e as Error
      if (err.message.includes('过于频繁')) return res.status(429).json(error(429, err.message))
      // 未知异常不透出内部细节
      return res.status(404).json(error(404, '资产不可用'))
    }
  }

  /** Bearer 令牌解析：有效则返回消费方 appId，否则 null（匿名）。 */
  private consumeContext(req: Request): { appId: number | null } {
    const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '')
    return { appId: this.tokenService.validate(bearer) }
  }
}
