import { Injectable, Logger } from '@nestjs/common'
import { lt as semverLt } from 'semver'
import type { DataScope, PluginEnvironment, PluginSpiExport } from '@atlas/types'

/** 单个 SPI 注册项：绑定实例上下文，能力懒构建并缓存。 */
interface SpiRegistration {
  pluginType: string
  appId: number
  scope: DataScope
  exports: Record<string, PluginSpiExport>
  /** 构建提供方 env（返回 null 表示实例不可用）。惰性调用，避免为未消费的能力构建对象。 */
  buildEnv: () => PluginEnvironment | null
  /** namespace → 已构建的能力对象（惰性缓存）。 */
  cache: Map<string, unknown>
  /** 共享实例（GLOBAL_SHARED）被多个应用启用时的引用计数。 */
  refs: number
}

/**
 * 插件双向 SPI 注册中心：
 * - 被动存储 + 惰性求值：仅当消费方 resolve 时才 buildEnv 并 create 能力对象，缓存复用。
 * - 作用域：GLOBAL_SHARED 以 @0 注册（任意 app 可解析）；APP_LOCAL 以 @appId 注册（仅同 app 可解析）。
 * - 不依赖 PluginService（避免反向循环），由 PluginService 在实例生命周期编排驱动。
 */
/** 解析级审计上下文：能力对象首次构建（缓存 miss）时上报一次。 */
export interface SpiBuildAudit {
  pluginType: string
  namespace: string
  consumerAppId: number
}

@Injectable()
export class PluginSpiRegistry {
  private readonly logger = new Logger(PluginSpiRegistry.name)
  private readonly regs = new Map<string, SpiRegistration>()
  /** 解析级审计回调（可选，默认不记录）：缓存 miss 首次构建成功时触发，由 PluginService 接 ops()。
   *  用 setter 注入而非构造参数（避免 Nest DI 将 Function 参数视为可注入令牌）。 */
  private onBuild?: (ctx: SpiBuildAudit) => void

  /** 设置审计回调（PluginService 启动时注入；registry 保持纯净，不依赖 OpsLogService）。 */
  setAuditHook(cb: (ctx: SpiBuildAudit) => void): void {
    this.onBuild = cb
  }

  private key(pluginType: string, scopeKey: number): string {
    return `${pluginType}@${scopeKey}`
  }

  /** 注册（enableInstance 调用）。共享实例可被多应用启用，用引用计数管理。 */
  register(pluginType: string, appId: number, scope: DataScope, exports: Record<string, PluginSpiExport>, buildEnv: () => PluginEnvironment | null): void {
    const scopeKey = scope === 'GLOBAL_SHARED' ? 0 : appId
    const key = this.key(pluginType, scopeKey)
    const existing = this.regs.get(key)
    if (existing) {
      existing.refs += 1
      return
    }
    this.regs.set(key, { pluginType, appId, scope, exports, buildEnv, cache: new Map(), refs: 1 })
    this.logger.log(`SPI 已注册：${pluginType}（scope=${scope}，${Object.keys(exports).join(',')}）`)
  }

  /** 注销（deleteInstance/unload 调用）。不带 appId 清该类型全部作用域；
   *  带 scope 时按实例实际作用域精确注销（混合 scope 下不会误减共享实例引用）。 */
  unregister(pluginType: string, appId?: number, scope?: DataScope): void {
    if (appId === undefined) {
      for (const k of [...this.regs.keys()]) {
        if (k.startsWith(`${pluginType}@`)) {
          this.regs.delete(k)
          this.logger.log(`SPI 已注销（全部）：${pluginType}`)
        }
      }
      return
    }
    const key = scope === 'GLOBAL_SHARED' ? this.key(pluginType, 0) : this.key(pluginType, appId)
    const reg = this.regs.get(key)
    if (!reg) return
    reg.refs -= 1
    if (reg.refs <= 0) {
      // 条目删除：连同已缓存的能力对象一并清除（热替换/重启用后重建，无残留）
      this.regs.delete(key)
      this.logger.log(`SPI 已注销：${pluginType}@{scopeKey=${key.split('@')[1]}}`)
    }
  }

  /** 解析：共享优先（@0），其次仅同 app 的本地实例（@consumerAppId）。不可用返回 null。
   *  opts.minVersion：消费方要求的契约版本下限（提供方 version 存在时按 semver 比较，不满足返回 null + warn）。 */
  resolve<T = unknown>(pluginType: string, namespace: string, consumerAppId: number, opts?: { minVersion?: string }): T | null {
    const shared = this.regs.get(this.key(pluginType, 0))
    if (shared) return this.build<T>(shared, namespace, consumerAppId, opts)
    const local = this.regs.get(this.key(pluginType, consumerAppId))
    if (local) return this.build<T>(local, namespace, consumerAppId, opts)
    return null
  }

  /** 惰性构建并缓存能力对象；expore 缺失 / env 不可用 / create 抛错 / 版本不满足 → null。 */
  private build<T>(reg: SpiRegistration, namespace: string, consumerAppId: number, opts?: { minVersion?: string }): T | null {
    const factory = reg.exports[namespace]
    if (!factory) return null
    if (opts?.minVersion && factory.version) {
      try {
        // 提供方版本低于消费方要求（version < minVersion）→ 拒绝并告警
        if (semverLt(factory.version, opts.minVersion)) {
          this.logger.warn(`SPI 能力版本不满足: ${reg.pluginType}/${namespace} 提供 ${factory.version}，需 >= ${opts.minVersion}`)
          return null
        }
      } catch {
        this.logger.warn(`SPI 能力版本比较失败（已隔离）: ${reg.pluginType}/${namespace}，minVersion=${opts.minVersion}`)
        return null
      }
    }
    if (reg.cache.has(namespace)) return reg.cache.get(namespace) as T
    const env = reg.buildEnv()
    if (!env) return null
    try {
      const obj = factory.create(env)
      reg.cache.set(namespace, obj)
      this.onBuild?.({ pluginType: reg.pluginType, namespace, consumerAppId })
      return obj as T
    } catch (e) {
      this.logger.warn(`SPI 能力构建失败（已隔离）: ${reg.pluginType}/${namespace}，${(e as Error).message}`)
      return null
    }
  }

  /** 某插件暴露的全部命名空间（管理面/调试用）。 */
  namespacesOf(pluginType: string): string[] {
    const out = new Set<string>()
    for (const [k, reg] of this.regs) {
      if (k.startsWith(`${pluginType}@`)) for (const ns of Object.keys(reg.exports)) out.add(ns)
    }
    return [...out]
  }

  /** 某插件运行时暴露的命名空间及注册状态（registered=存在 refs>0 的注册项）。管理面拓扑用。 */
  providedNamespaces(pluginType: string): Array<{ namespace: string; registered: boolean }> {
    const out = new Map<string, boolean>()
    for (const [k, reg] of this.regs) {
      if (k.startsWith(`${pluginType}@`)) {
        for (const ns of Object.keys(reg.exports)) {
          if (!out.has(ns)) out.set(ns, false)
          if (reg.refs > 0) out.set(ns, true)
        }
      }
    }
    return [...out.entries()].map(([namespace, registered]) => ({ namespace, registered }))
  }
}