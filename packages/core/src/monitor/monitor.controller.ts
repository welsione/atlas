import { Body, Controller, Get, Param, Post, Put, Query, Inject } from '@nestjs/common'
import { ok, error, ValidationError } from '../common/response.js'
import { pageParams } from '../common/utils.js'
import type { Page } from '@atlas/types'
import { MonitorRepository, type MonitorRange } from './monitor.repository.js'
import { ExternalInterfaceRuleRepository, type ExternalInterfaceKind } from './external-interface-rule.repository.js'
import { PluginService } from '../plugins/plugin.service.js'
import { PluginRegistry } from '../plugins/plugin.registry.js'
import { PluginEpTokenRepository } from '../plugins/plugin-ep-token.repository.js'
import { DatasetService } from '../datasets/dataset.service.js'
import { PluginFileRegistry } from '../plugins/plugin-file.registry.js'

/** monitor 接口监控聚合端点（应用空间，框架内置能力）。 */
@Controller('/api/apps')
export class MonitorController {
  constructor(
    @Inject(MonitorRepository) private readonly repository: MonitorRepository,
    @Inject(ExternalInterfaceRuleRepository) private readonly externRules: ExternalInterfaceRuleRepository,
    @Inject(PluginService) private readonly pluginService: PluginService,
    @Inject(PluginRegistry) private readonly registry: PluginRegistry,
    @Inject(PluginEpTokenRepository) private readonly epTokens: PluginEpTokenRepository,
    @Inject(DatasetService) private readonly datasetService: DatasetService,
    @Inject(PluginFileRegistry) private readonly fileRegistry: PluginFileRegistry,
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

  @Put(':appId/monitor/interfaces')
  setInterfaceEnabled(
    @Param('appId') appId: string,
    @Body() body: { kind: ExternalInterfaceKind; key: string; enabled?: boolean },
  ) {
    try {
      this.requireDeclaredExternalInterface(Number(appId), body.kind, body.key)
      this.externRules.setEnabled(Number(appId), body.kind, body.key, !!body!.enabled)
      return ok(null)
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Post(':appId/monitor/interfaces/reset')
  resetInterfaceRule(
    @Param('appId') appId: string,
    @Body() body: { kind: ExternalInterfaceKind; key: string },
  ) {
    try {
      this.requireDeclaredExternalInterface(Number(appId), body.kind, body.key)
      this.externRules.remove(Number(appId), body.kind, body.key)
      return ok(null)
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  /** 校验目标对外接口确为该应用声明项，防止无效规则行。 */
  private requireDeclaredExternalInterface(appId: number, kind: ExternalInterfaceKind, key: string): void {
    const found = this.interfaceDirectory(appId).some((r) => r.kind === kind && r.key === key)
    if (!found) throw new ValidationError(`对外接口不存在或未启用: ${kind} ${key}`)
  }

  /** 对外接口目录分页（组合后切片）。 */
  private pageInterfaces(appId: number, page: number, size: number): Page<Record<string, unknown>> {
    const all = this.interfaceDirectory(appId)
    const start = (page - 1) * size
    return { rows: all.slice(start, start + size), total: all.length, page, size }
  }

  /** 对外接口目录：数据集 + 插件公开 ep + 文件公开下载 统一聚合 + 启停状态 + 调用统计。 */
  private interfaceDirectory(appId: number): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = []
    const extStats = new Map(
      this.repository.externalStats(appId, 'all').map((s) => [`${s.resource_type}:${s.key}`, s]),
    )
    const extEnabled = (kind: ExternalInterfaceKind, key: string): boolean =>
      this.externRules.isAllowed(appId, kind, key)
    const pluginNameOf = (t: string): string => this.registry.byType(t)?.plugin.name ?? t

    // 1) 数据集对外接口（已发布）
    for (const d of this.datasetService.list(appId)) {
      const stat = extStats.get(`DATASET:${d.id}`)
      const key = String(d.id)
      rows.push({
        kind: 'DATASET',
        key,
        appId,
        pluginType: d.pluginType || '',
        pluginName: d.pluginType ? pluginNameOf(d.pluginType) : '',
        name: d.name,
        method: '',
        path: '',
        summary: d.description,
        sensitivity: d.sensitivity,
        token: d.token,
        accessPath: `/api/v1/datasets/${d.token}/data`,
        enabled: extEnabled('DATASET', key),
        count: Number(stat?.count ?? 0),
        failures: Number(stat?.failures ?? 0),
        bytes: Number(stat?.bytes ?? 0),
        lastAccess: stat?.last_access ?? '',
      })
    }

    // 2) 插件公开 ep（public:true）
    const statMap = new Map(
      this.repository.interfaceStats(appId, 'all').map((s) => [`${s.plugin_type} ${s.endpoint}`, s]),
    )
    const tokenRows = this.epTokens.listByApp(appId)
    for (const row of this.pluginService.instanceOverview(appId)) {
      if (!row.instance || !row.instance.enabled || !row.runtimeLoaded) continue
      const loaded = this.registry.byType(row.plugin.pluginType)
      if (!loaded) continue
      for (const ep of loaded.plugin.endpoints?.() ?? []) {
        if (ep.public !== true) continue // 内部端点不进对外接口目录
        const tokenRow = tokenRows.find(
          (t) => t.pluginType === row.plugin.pluginType && t.method === ep.method && t.endpointPath === ep.path,
        )
        if (!tokenRow) continue // 尚未生成 token（实例未同步）
        const key = `${ep.method} ${ep.path}`
        const stat = statMap.get(`${row.plugin.pluginType} ${ep.method} ${ep.path}`)
        rows.push({
          kind: 'PLUGIN_EP',
          key,
          appId,
          pluginType: row.plugin.pluginType,
          pluginName: row.plugin.name,
          name: row.plugin.name,
          method: ep.method,
          path: ep.path,
          summary: ep.summary,
          sensitivity: tokenRow.sensitivity,
          token: tokenRow.token,
          accessPath: `/api/v1/app/${appId}/plugins/${row.plugin.pluginType}/${tokenRow.token}/ep/${ep.path}`,
          enabled: extEnabled('PLUGIN_EP', key),
          count: Number(stat?.count ?? 0),
          failures: Number(stat?.failures ?? 0),
          bytes: Number(stat?.bytes ?? 0),
          lastAccess: stat?.last_access ?? '',
        })
      }
    }

    // 3) 文件公开下载（该应用作用域下已 publish）
    for (const f of this.fileRegistry.listByScope(appId)) {
      const stat = extStats.get(`MODEL_FILE:${f.token}`)
      rows.push({
        kind: 'PUBLIC_FILE',
        key: f.token,
        appId,
        pluginType: f.plugin_type,
        pluginName: pluginNameOf(f.plugin_type),
        name: f.name || f.rel_path,
        method: '',
        path: '',
        summary: `公开文件下载（${f.rel_path}）`,
        sensitivity: 'PUBLIC',
        token: f.token,
        accessPath: `/api/files/${f.token}/download`,
        enabled: extEnabled('PUBLIC_FILE', f.token),
        count: Number(stat?.count ?? 0),
        failures: Number(stat?.failures ?? 0),
        bytes: Number(stat?.bytes ?? 0),
        lastAccess: stat?.last_access ?? '',
      })
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
