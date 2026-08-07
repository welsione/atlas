import { Body, Controller, Delete, Get, Inject, Param, Post } from '@nestjs/common'
import type { App, CreateAppResult } from '@atlas/types'
import { ok, error, ValidationError, NotFoundError } from '../common/response.js'
import { AppService } from './app.service.js'
import { AppTokenService } from '../auth/app-token.service.js'

/**
 * 应用管理端点（管理面）。
 */
@Controller('/api/apps')
export class AppController {
  constructor(
    private readonly service: AppService,
    private readonly tokenService: AppTokenService,
  ) {}

  @Get()
  list() {
    return ok(this.service.list())
  }

  @Post()
  create(@Body() body: { name?: string; description?: string }) {
    try {
      return ok(this.service.create(body?.name ?? '', body?.description ?? ''))
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Post(':id/rotate')
  rotate(@Param('id') id: string) {
    const appId = Number(id)
    try {
      return ok(this.service.rotate(appId))
    } catch (e) {
      return error(404, (e as Error).message)
    }
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string) {
    const appId = Number(id)
    try {
      const app = this.service.revoke(appId)
      this.tokenService.revokeAppTokens(app.id)
      return ok(app)
    } catch (e) {
      return error(404, (e as Error).message)
    }
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    try {
      return ok(this.service.activate(Number(id)))
    } catch (e) {
      return error(404, (e as Error).message)
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    try {
      this.service.remove(Number(id))
      return ok(null)
    } catch (e) {
      return error(404, (e as Error).message)
    }
  }
}
