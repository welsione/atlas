import { Injectable, Inject } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import type { PluginMetricDef } from '@atlas/types'
import { PluginRegistry } from '../plugins/plugin.registry.js'

/** 插件声明的级联清理表项。 */
export interface CleanupTableSpec {
  table: string
  /** 应用外键列，默认 'app_id'。 */
  column?: string
}

/** 插件声明的日志保留表项。 */
export interface LogTableSpec {
  table: string
  column: string
}

/**
 * 扩展注册中心：聚合「插件声明式扩展点」+「插件运行时动态注册」，供 core 内部消费。
 * - 声明式（AtlasPlugin 钩子）：schemaDdl / cleanupTables / logTables / publicUrls / resourceName。
 * - 运行时（env.security().publicUrl() / env.monitor().registerMetric()）。
 * - 内置种子：平台默认公开前缀、日志保留表、级联清理表。
 * 每次调用实时遍历当前已注册插件（热更新后自动反映最新声明），无需手动失效缓存。
 */
@Injectable()
export class ExtensionRegistry {
  /** 平台内置公开前缀（SecurityMiddleware 默认放行）。 */
  private static readonly BUILTIN_PUBLIC_URLS = ['/api/files/', '/api/auth/', '/api/v1/', '/_pluginui/']
  /** 平台内置日志保留表（LogCleanupService 定时清理）。 */
  private static readonly BUILTIN_LOG_TABLES: LogTableSpec[] = [
    { table: 'api_access_logs', column: 'accessed_at' },
    { table: 'ops_logs', column: 'created_at' },
    { table: 'dataset_download_logs', column: 'downloaded_at' },
    { table: 'secret_access_logs', column: 'accessed_at' },
    { table: 'auth_logs', column: 'created_at' },
    { table: 'download_logs', column: 'downloaded_at' },
    { table: 'upload_logs', column: 'uploaded_at' },
  ]

  /** 运行时动态注册的公开前缀（env.security().publicUrl()）。 */
  private readonly runtimePublicUrls = new Set<string>()
  /** 自定义监控指标（env.monitor().registerMetric()）。 */
  private readonly runtimeMetrics = new Map<string, PluginMetricDef>()

  constructor(@Inject(ModuleRef) private readonly moduleRef: ModuleRef) {}

  /** 惰性取 PluginRegistry（打破 SpiModule -> PluginModule 构造期循环依赖）。
   *  strict: false —— ModuleRef.get 默认只查宿主模块，需跨模块查全局容器。 */
  private get registry(): PluginRegistry {
    return this.moduleRef.get(PluginRegistry, { strict: false })
  }

  /** 全部公开前缀：内置 + 插件声明 + 运行时动态注册。 */
  allPublicUrls(): string[] {
    const urls = new Set<string>(ExtensionRegistry.BUILTIN_PUBLIC_URLS)
    for (const loaded of this.registry.all()) {
      for (const u of loaded.plugin.publicUrls?.() ?? []) urls.add(u)
    }
    for (const u of this.runtimePublicUrls) urls.add(u)
    return [...urls]
  }

  /** 运行时注册公开前缀（env.security().publicUrl()）。 */
  addPublicUrl(prefix: string): void {
    if (prefix?.trim()) this.runtimePublicUrls.add(prefix.trim())
  }

  /** 全部日志保留表：内置 + 插件声明。 */
  allLogTables(): LogTableSpec[] {
    const tables = [...ExtensionRegistry.BUILTIN_LOG_TABLES]
    for (const loaded of this.registry.all()) {
      for (const t of loaded.plugin.logTables?.() ?? []) tables.push(t)
    }
    return tables
  }

  /** 应用删除级联清理表：内置 + 插件声明（AppRepository.deleteCascade 事务内执行）。 */
  allCleanupTables(): CleanupTableSpec[] {
    const tables: CleanupTableSpec[] = []
    for (const loaded of this.registry.all()) {
      for (const t of loaded.plugin.cleanupTables?.() ?? []) tables.push(t)
    }
    return tables
  }

  /** 全部插件 schemaDdl（按注册顺序，SchemaBootstrapService 启动执行）。 */
  allSchemaDdl(): string[] {
    const ddl: string[] = []
    for (const loaded of this.registry.all()) {
      for (const stmt of loaded.plugin.schemaDdl?.() ?? []) ddl.push(stmt)
    }
    return ddl
  }

  /** 监控聚合：按插件资源类型解析显示名（非内置 DATASET/MODEL_FILE）。 */
  resolveResourceName(resourceType: string, resourceId: number): string | null {
    for (const loaded of this.registry.all()) {
      for (const resolver of loaded.plugin.resourceName?.() ?? []) {
        if (resolver.resourceType === resourceType) {
          try {
            return resolver.nameOf(resourceId) ?? null
          } catch {
            return null
          }
        }
      }
    }
    return null
  }

  /** 注册自定义监控指标（env.monitor().registerMetric()）。 */
  registerMetric(def: PluginMetricDef): void {
    if (def?.key) this.runtimeMetrics.set(def.key, def)
  }

  /** 全部自定义监控指标。 */
  metrics(): PluginMetricDef[] {
    return [...this.runtimeMetrics.values()]
  }
}