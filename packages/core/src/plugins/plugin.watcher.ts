import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { PluginLoader } from './plugin.loader.js'
import { CONFIG, type AIBaseConfig } from '../config.js'

/**
 * 外部插件热扫描：定时对比目录 hash，处理新增/更新/删除三态。
 */
@Injectable()
export class PluginWatcher implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PluginWatcher.name)
  private readonly known = new Map<string, string>()
  private timer: NodeJS.Timeout | null = null

  constructor(
    @Inject(CONFIG) private readonly config: AIBaseConfig,
    private readonly loader: PluginLoader,
  ) {}

  onApplicationBootstrap(): void {
    // 以启动加载时的目录哈希初始化 known（避免与 PluginLoader 启动加载重复）
    for (const [name, hash] of this.loader.externalHashes()) {
      this.known.set(name, hash)
    }
    this.timer = setInterval(
      () => {
        this.loader
          .scanExternal(this.known)
          .catch((e) => this.logger.warn(`插件扫描异常: ${(e as Error).message}`))
      },
      this.config.pluginScanIntervalMs,
    )
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  /** 手动 reload 后重置 known 基线（避免与下次扫描重复热替换）。 */
  resyncKnown(): void {
    this.known.clear()
    for (const [name, hash] of this.loader.externalHashes()) {
      this.known.set(name, hash)
    }
  }
}
