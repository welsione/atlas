import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common'
import type { App, CreateAppResult } from '@atlas/types'
import { ok } from '../common/response.js'
import { pageParams } from '../common/utils.js'
import { AppService } from './app.service.js'
import { AppTokenService } from '../auth/app-token.service.js'

/**
 * 应用管理端点（管理面）。
 * 业务异常（ValidationError/NotFoundError）由全局 AppExceptionFilter 统一映射为
 * 真实 HTTP 状态码（400/404）+ {code,message,data} 信封。
 */
@Controller('/api/apps')
export class AppController {
  constructor(
    @Inject(AppService) private readonly service: AppService,
    @Inject(AppTokenService) private readonly tokenService: AppTokenService,
  ) {}

  @Get()
  list(@Query('page') page?: string, @Query('size') size?: string) {
    const { page: p, size: s } = pageParams(page, size)
    return ok(this.service.listPage(p, s))
  }

  @Post()
  create(@Body() body: { name?: string; description?: string; pluginTypes?: string[] }) {
    const types = Array.isArray(body?.pluginTypes) ? body.pluginTypes.filter((t) => typeof t === 'string') : undefined
    return ok(this.service.create(body?.name ?? '', body?.description ?? '', types))
  }

  @Post(':id/rotate')
  rotate(@Param('id') id: string) {
    return ok(this.service.rotate(Number(id)))
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string) {
    const app = this.service.revoke(Number(id))
    this.tokenService.revokeAppTokens(app.id)
    return ok(app)
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return ok(this.service.activate(Number(id)))
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.service.remove(Number(id))
    return ok(null)
  }
}