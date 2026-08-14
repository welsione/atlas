import { Body, Controller, Get, Param, Post, Put, Query, Inject } from '@nestjs/common'
import { ok, error, ValidationError } from '../common/response.js'
import { pageParams } from '../common/utils.js'
import type { Page } from '@atlas/types'
import { MonitorRepository, type MonitorRange } from './monitor.repository.js'
import { EndpointRuleRepository } from './endpoint-rule.repository.js'
import { PluginService } from '../plugins/plugin.service.js'
import { PluginRegistry } from '../plugins/plugin.registry.js'

/** monitor 接口监控聚合端点（应用空间，框架内置能力）。 */
@Controller('/api/apps')
export class MonitorController {
  constructor(
    @Inject(MonitorRepository) private readonly repository: MonitorRepository,
    @Inject(EndpointRuleRepository) private readonly rules: EndpointRuleRepository,
    @Inject(PluginService) private readonly pluginService: PluginService,
    @Inject(PluginRegistry) private readonly registry: PluginRegistry,
  ) {}

  private range(q: string | undefined): MonitorRange {
    return q === '24h' || q === '7d' || q === 'all' ? q : '24h'
  }

  @Get(':appId/monitor/overview')
  overview(@Param('appId') appId: string, @Query('range') range?: string) {
    return ok(this.repository.overview(Number(appId), this.range(range)))
  }

  @Get(':appId/monitor/endpoints')
  endpoints(@Param('appId') appId: string, @Query('range') range?: string, @Query('page') page?: string, @Query('size') size?: string) {
    const { page: p, size: s } = pageParams(page, size)
    return ok(this.repository.endpoints(Number(appId), this.range(range), p, s))
  }

  @Get(':appId/monitor/interfaces')
  interfaces(@Param('appId') appId: string, @Query('page') page?: string, @Query('size') size?: string) {
    const { page: p, size: s } = pageParams(page, size)
    return ok(this.pageInterfaces(Number(appId), p, s))
  }

  @Put(':appId/monitor/interfaces/:pluginType/:method')
  setInterfaceEnabled(
    @Param('appId') appId: string,
    @Param('pluginType') pluginType: string,
    @Param('method') method: string,
    @Body() body: { path?: string; enabled?: boolean },
  ) {
    try {
      this.requireDeclaredEndpoint(Number(appId), pluginType, method, body?.path ?? '')
      this.rules.setEnabled(Number(appId), pluginType, method.toUpperCase(), body!.path!, !!body!.enabled)
      return ok(null)
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Post(':appId/monitor/interfaces/:pluginType/:method/reset')
  resetInterfaceRule(
    @Param('appId') appId: string,
    @Param('pluginType') pluginType: string,
    @Param('method') method: string,
    @Body() body: { path?: string },
  ) {
    try {
      this.requireDeclaredEndpoint(Number(appId), pluginType, method, body?.path ?? '')
      this.rules.remove(Number(appId), pluginType, method.toUpperCase(), body!.path!)
      return ok(null)
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  /** 校验目标端点确为该应用已启用实例的声明端点，防止无效规则行。 */
  private requireDeclaredEndpoint(appId: number, pluginType: string, method: string, path: string): void {
    const found = this.interfaceDirectory(appId).find(
      (r) => r.pluginType === pluginType && r.method === method.toUpperCase() && r.path === path,
    )
    if (!found) throw new ValidationError(`端点不存在或未启用实例: ${pluginType} ${method.toUpperCase()} ${path}`)
  }

  /** 接口目录分页（组合后切片）。 */
  private pageInterfaces(appId: number, page: number, size: number): Page<Record<string, unknown>> {
    const all = this.interfaceDirectory(appId)
    const start = (page - 1) * size
    return { rows: all.slice(start, start + size), total: all.length, page, size }
  }

  /** 接口目录：已启用实例的插件声明端点 + 规则状态 + 调用统计。 */
  private interfaceDirectory(appId: number): Array<Record<string, unknown>> {
    const ruleMap = new Map(this.rules.list(appId).map((r) => [`${r.method} ${r.pluginType} ${r.endpointPath}`, r.enabled]))
    const statMap = new Map(
      this.repository.interfaceStats(appId, 'all').map((s) => [`${s.plugin_type} ${s.endpoint}`, s]),
    )
    const rows: Array<Record<string, unknown>> = []
    for (const row of this.pluginService.instanceOverview(appId)) {
      if (!row.instance || !row.instance.enabled || !row.runtimeLoaded) continue
      const loaded = this.registry.byType(row.plugin.pluginType)
      if (!loaded) continue
      for (const ep of loaded.plugin.endpoints?.() ?? []) {
        const key = `${ep.method} ${row.plugin.pluginType} ${ep.path}`
        const stat = statMap.get(`${row.plugin.pluginType} ${ep.method} ${ep.path}`)
        rows.push({
          pluginType: row.plugin.pluginType,
          pluginName: row.plugin.name,
          method: ep.method,
          path: ep.path,
          summary: ep.summary,
          enabled: ruleMap.get(key) ?? true,
          count: Number(stat?.count ?? 0),
          failures: Number(stat?.failures ?? 0),
          bytes: Number(stat?.bytes ?? 0),
          lastAccess: stat?.last_access ?? '',
        })
      }
    }
    return rows
  }

  @Get(':appId/monitor/top-resources')
  topResources(@Param('appId') appId: string, @Query('range') range?: string, @Query('page') page?: string, @Query('size') size?: string) {
    const { page: p, size: s } = pageParams(page, size)
    return ok(this.repository.topResources(Number(appId), this.range(range), p, s))
  }

  @Get(':appId/monitor/top-ips')
  topIps(@Param('appId') appId: string, @Query('range') range?: string, @Query('page') page?: string, @Query('size') size?: string) {
    const { page: p, size: s } = pageParams(page, size)
    return ok(this.repository.topIps(Number(appId), this.range(range), p, s))
  }

  @Get(':appId/monitor/top-apps')
  topApps(@Param('appId') appId: string, @Query('range') range?: string, @Query('page') page?: string, @Query('size') size?: string) {
    const { page: p, size: s } = pageParams(page, size)
    return ok(this.repository.topApps(Number(appId), this.range(range), p, s))
  }

  @Get(':appId/monitor/series')
  series(@Param('appId') appId: string, @Query('range') range?: string) {
    return ok(this.repository.series(Number(appId), this.range(range)))
  }

  @Get(':appId/monitor/recent')
  recent(@Param('appId') appId: string, @Query('page') page?: string, @Query('size') size?: string) {
    const { page: p, size: s } = pageParams(page, size)
    return ok(this.repository.recent(Number(appId), p, s))
  }
}
