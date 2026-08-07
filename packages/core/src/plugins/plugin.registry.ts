import { Injectable, Logger } from '@nestjs/common'
import type { LoadedPlugin } from './types.js'

/**
 * 插件注册中心：type 全局唯一（内置保留字保护），
 * 热替换 = unregister（destroy）→ register 新版。
 */
@Injectable()
export class PluginRegistry {
  private readonly logger = new Logger(PluginRegistry.name)
  private readonly plugins = new Map<string, LoadedPlugin>()

  register(loaded: LoadedPlugin): boolean {
    const existing = this.plugins.get(loaded.plugin.type)
    if (existing) {
      this.logger.warn(
        `插件类型 ${loaded.plugin.type} 已注册（${existing.artifact}），拒绝重复集成 ${loaded.artifact}`,
      )
      return false
    }
    this.plugins.set(loaded.plugin.type, loaded)
    this.logger.log(`插件已注册：${loaded.plugin.name}（type=${loaded.plugin.type}，artifact=${loaded.artifact}）`)
    return true
  }

  /** 热替换：卸载旧版 → 注册新版。 */
  replace(loaded: LoadedPlugin): boolean {
    this.unregister(loaded.plugin.type)
    return this.register(loaded)
  }

  /** 卸载：调用 destroy 钩子并移除注册（数据由平台保管，重集成恢复）。 */
  unregister(type: string): LoadedPlugin | undefined {
    const removed = this.plugins.get(type)
    if (removed) {
      try {
        void removed.plugin.destroy?.()
      } catch (e) {
        this.logger.warn(`插件 ${type} 卸载钩子异常: ${(e as Error).message}`)
      }
      this.plugins.delete(type)
      this.logger.log(`插件已卸载：${removed.plugin.name}（type=${type}）`)
    }
    return removed
  }

  byType(type: string): LoadedPlugin | undefined {
    return this.plugins.get(type)
  }

  all(): LoadedPlugin[] {
    return [...this.plugins.values()]
  }

  types(): string[] {
    return [...this.plugins.keys()]
  }
}
