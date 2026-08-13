import { Injectable, Inject } from '@nestjs/common'
import type { PluginMetricDef, PluginMonitorRange } from '@atlas/types'
import { MonitorRepository } from '../monitor/monitor.repository.js'
import { ExtensionRegistry } from './extension.registry.js'

/**
 * env.monitor() 门面：数据面监控聚合读取 + 自定义指标注册。
 * 监控数据按应用维度，方法均以 appId 为第一参数；PlatformPluginEnvironment.monitor() 绑定调用方实例的 appId。
 */
@Injectable()
export class MonitorFacade {
  constructor(
    @Inject(MonitorRepository) private readonly repository: MonitorRepository,
    @Inject(ExtensionRegistry) private readonly extensions: ExtensionRegistry,
  ) {}

  overview(appId: number, range?: PluginMonitorRange): Record<string, number> {
    return this.repository.overview(appId, range ?? '24h')
  }

  endpoints(appId: number, range?: PluginMonitorRange): Array<Record<string, unknown>> {
    return this.repository.endpoints(appId, range ?? '24h', 1, 10).rows
  }

  topResources(appId: number, range?: PluginMonitorRange, limit?: number): Array<Record<string, unknown>> {
    return this.repository.topResources(appId, range ?? '24h', 1, limit ?? 10).rows
  }

  topIps(appId: number, range?: PluginMonitorRange, limit?: number): Array<Record<string, unknown>> {
    return this.repository.topIps(appId, range ?? '24h', 1, limit ?? 10).rows
  }

  topApps(appId: number, range?: PluginMonitorRange, limit?: number): Array<Record<string, unknown>> {
    return this.repository.topApps(appId, range ?? '24h', 1, limit ?? 10).rows
  }

  series(appId: number, range?: PluginMonitorRange): Array<Record<string, unknown>> {
    return this.repository.series(appId, range ?? '24h')
  }

  recent(appId: number, limit?: number): Array<Record<string, unknown>> {
    return this.repository.recent(appId, 1, limit ?? 50).rows
  }

  /** 注册自定义监控指标（平台按采集周期调用 collect 并汇聚）。 */
  registerMetric(def: PluginMetricDef): void {
    this.extensions.registerMetric(def)
  }
}