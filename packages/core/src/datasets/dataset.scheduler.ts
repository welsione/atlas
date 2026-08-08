import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { DatasetRepository } from './dataset.repository.js'
import { DatasetService } from './dataset.service.js'
import { PluginService } from '../plugins/plugin.service.js'
import { OpsLogService } from '../plugins/ops-log.service.js'
import { CONFIG, type AIBaseConfig } from '../config.js'

/**
 * 数据集定时刷新：按配置间隔扫描 SCHEDULED 数据集，调用插件 DatasetSource 重渲染，
 * 内容哈希变化才 bump 版本（幂等）。结果写入运维台工作日志。
 */
@Injectable()
export class DatasetScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DatasetScheduler.name)
  private timer: NodeJS.Timeout | null = null

  constructor(
    @Inject(CONFIG) private readonly config: AIBaseConfig,
    private readonly repository: DatasetRepository,
    private readonly datasetService: DatasetService,
    private readonly pluginService: PluginService,
    private readonly opsLogService: OpsLogService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      this.refreshScheduled().catch((e) => this.logger.warn(`数据集扫描异常: ${(e as Error).message}`))
    }, this.config.datasetRefreshIntervalMs)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async refreshScheduled(): Promise<void> {
    for (const d of this.repository.findScheduled()) {
      try {
        await this.refreshNow(d)
      } catch (e) {
        this.logger.warn(`数据集定时刷新失败：dataset=${d.id}，${(e as Error).message}`)
        this.opsLogService.write(d.appId, d.pluginType, 'ERROR', `数据集定时刷新失败：${d.name}`, {
          datasetKey: d.datasetKey,
          error: (e as Error).message,
        })
      }
    }
  }

  /** 手动/定时刷新入口：渲染 → 发布（哈希变则版本+1）。 */
  async refreshNow(d: import('@atlas/types').Dataset): Promise<boolean> {
    const env = this.pluginService.environmentOrNull(d.appId, d.pluginType)
    if (!env || !env.datasetSource()) {
      this.opsLogService.write(d.appId, d.pluginType, 'INFO', `数据集刷新跳过（无渲染源）：${d.name}`, {
        datasetKey: d.datasetKey,
        reason: 'no dataset source',
      })
      return false
    }
    const changed = await this.datasetService.refreshByKey(d.appId, d.pluginType, d.datasetKey)
    this.opsLogService.write(
      d.appId, d.pluginType, 'INFO',
      (changed ? '数据集已刷新（版本+1）：' : '数据集刷新完成（内容未变化）：') + d.name,
      { datasetKey: d.datasetKey, version: d.version, changed },
    )
    return changed
  }
}
