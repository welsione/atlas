import { Controller, Get, Param, Query, Inject } from '@nestjs/common'
import { ok } from '../common/response.js'
import { MonitorRepository, type MonitorRange } from './monitor.repository.js'

/** monitor 内置插件聚合端点（应用空间）。 */
@Controller('/api/apps')
export class MonitorController {
  constructor(@Inject(MonitorRepository) private readonly repository: MonitorRepository) {}

  private range(q: string | undefined): MonitorRange {
    return q === '24h' || q === '7d' || q === 'all' ? q : '24h'
  }

  @Get(':appId/monitor/overview')
  overview(@Param('appId') appId: string, @Query('range') range?: string) {
    return ok(this.repository.overview(Number(appId), this.range(range)))
  }

  @Get(':appId/monitor/endpoints')
  endpoints(@Param('appId') appId: string, @Query('range') range?: string) {
    return ok(this.repository.endpoints(Number(appId), this.range(range)))
  }

  @Get(':appId/monitor/top-resources')
  topResources(@Param('appId') appId: string, @Query('range') range?: string, @Query('limit') limit?: string) {
    return ok(this.repository.topResources(Number(appId), this.range(range), Number(limit ?? 10)))
  }

  @Get(':appId/monitor/top-ips')
  topIps(@Param('appId') appId: string, @Query('range') range?: string, @Query('limit') limit?: string) {
    return ok(this.repository.topIps(Number(appId), this.range(range), Number(limit ?? 10)))
  }

  @Get(':appId/monitor/top-apps')
  topApps(@Param('appId') appId: string, @Query('range') range?: string, @Query('limit') limit?: string) {
    return ok(this.repository.topApps(Number(appId), this.range(range), Number(limit ?? 10)))
  }

  @Get(':appId/monitor/series')
  series(@Param('appId') appId: string, @Query('range') range?: string) {
    return ok(this.repository.series(Number(appId), this.range(range)))
  }

  @Get(':appId/monitor/recent')
  recent(@Param('appId') appId: string, @Query('limit') limit?: string) {
    return ok(this.repository.recent(Number(appId), Number(limit ?? 50)))
  }
}
