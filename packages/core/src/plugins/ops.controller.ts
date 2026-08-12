import { Controller, Get, Query, Inject } from '@nestjs/common'
import { ok } from '../common/response.js'
import { OpsLogService } from './ops-log.service.js'

/** 运维台端点（平台核心页面，管理认证）。 */
@Controller('/api/ops')
export class OpsController {
  constructor(@Inject(OpsLogService) private readonly service: OpsLogService) {}

  @Get('logs')
  logs(
    @Query('appId') appId?: string,
    @Query('pluginType') pluginType?: string,
    @Query('level') level?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return ok(
      this.service.query({
        appId: appId ? Number(appId) : undefined,
        pluginType,
        level,
        page: page ? Number(page) : undefined,
        size: size ? Number(size) : undefined,
      }),
    )
  }

  @Get('overview')
  overview() {
    return ok(this.service.overview())
  }
}
