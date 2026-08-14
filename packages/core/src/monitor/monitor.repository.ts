import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import type { Page } from '@atlas/types'
import { ExtensionRegistry } from '../spi/extension.registry.js'

export type MonitorRange = '24h' | '7d' | 'all'

/** monitor 插件聚合仓储：基于 api_access_logs（数据集 + 模型文件全部数据面调用）。 */
@Injectable()
export class MonitorRepository {
  constructor(
    @Inject(DB) private readonly db: Database.Database,
    @Inject(ExtensionRegistry) private readonly extensions: ExtensionRegistry,
  ) {}

  private since(range: MonitorRange): string | null {
    if (range === '24h') return "datetime('now', '-1 day', 'localtime')"
    if (range === '7d') return "datetime('now', '-7 day', 'localtime')"
    return null
  }

  private pageOf<T>(rows: T[], total: number, page: number, size: number): Page<T> {
    return { rows, total, page, size }
  }

  /** 分组聚合查询的总行数（endpoints/topIps/topApps 共用）。 */
  private groupedCount(sql: string, params: Array<string | number>): number {
    return (this.db.prepare(`SELECT COUNT(*) c FROM (${sql})`).get(...params) as { c: number }).c
  }

  overview(appId: number, range: MonitorRange): Record<string, number> {
    const since = this.since(range)
    const where = since
      ? 'WHERE owner_app_id = ? AND accessed_at >= ' + since
      : 'WHERE owner_app_id = ?'
    const row = this.db
      .prepare(
        `SELECT COUNT(*) total, COALESCE(SUM(bytes),0) total_bytes,
           SUM(CASE WHEN http_status=304 THEN 1 ELSE 0 END) not_modified,
           SUM(CASE WHEN http_status>=400 THEN 1 ELSE 0 END) failures,
           COUNT(DISTINCT consumer_app_id) active_apps,
           COUNT(DISTINCT ip) active_ips
         FROM api_access_logs ${where}`,
      )
      .get(appId) as Record<string, number>
    return {
      total: row.total ?? 0,
      totalBytes: row.total_bytes ?? 0,
      notModified: row.not_modified ?? 0,
      failures: row.failures ?? 0,
      activeApps: row.active_apps ?? 0,
      activeIps: row.active_ips ?? 0,
    }
  }

  endpoints(appId: number, range: MonitorRange, page: number, size: number): Page<Record<string, unknown>> {
    const since = this.since(range)
    const where = since
      ? 'WHERE owner_app_id = ? AND accessed_at >= ' + since
      : 'WHERE owner_app_id = ?'
    const rows = this.db
      .prepare(
        `SELECT endpoint, plugin_type, COUNT(*) count, COALESCE(SUM(bytes),0) bytes,
           SUM(CASE WHEN http_status=304 THEN 1 ELSE 0 END) not_modified,
           SUM(CASE WHEN http_status>=400 THEN 1 ELSE 0 END) failures
         FROM api_access_logs ${where} GROUP BY endpoint, plugin_type ORDER BY count DESC LIMIT ? OFFSET ?`,
      )
      .all(appId, size, (page - 1) * size) as Array<Record<string, unknown>>
    const total = this.groupedCount(
      `SELECT 1 FROM api_access_logs ${where} GROUP BY endpoint, plugin_type`,
      [appId],
    )
    // PLUGIN_EP 端点跨插件同 path 可能重名（如 status），前缀插件名消歧
    return this.pageOf(
      rows.map((r) => ({
        ...r,
        endpoint: r.plugin_type ? `${r.plugin_type}/${r.endpoint}` : r.endpoint,
        plugin_type: undefined,
      })),
      total,
      page,
      size,
    )
  }

  /** 插件 ep 端点调用统计（接口目录数据源）：按 (plugin_type, endpoint) 聚合。 */
  interfaceStats(appId: number, range: MonitorRange): Array<Record<string, unknown>> {
    const since = this.since(range)
    const where = since
      ? 'WHERE l.owner_app_id = ? AND l.resource_type = \'PLUGIN_EP\' AND l.accessed_at >= ' + since
      : 'WHERE l.owner_app_id = ? AND l.resource_type = \'PLUGIN_EP\''
    return this.db
      .prepare(
        `SELECT l.plugin_type plugin_type, l.endpoint endpoint, COUNT(*) count,
           COALESCE(SUM(l.bytes),0) bytes,
           SUM(CASE WHEN l.http_status>=400 THEN 1 ELSE 0 END) failures,
           MAX(l.accessed_at) last_access
         FROM api_access_logs l ${where}
         GROUP BY l.plugin_type, l.endpoint`,
      )
      .all(appId) as Array<Record<string, unknown>>
  }

  /** 非插件对外接口调用统计：数据集/文件按 (kind, key) 聚合（统一对外接口目录数据源）。 */
  externalStats(appId: number, range: MonitorRange): Array<Record<string, unknown>> {
    const since = this.since(range)
    const where = since
      ? 'WHERE l.owner_app_id = ? AND l.resource_type IN (\'DATASET\',\'MODEL_FILE\') AND l.accessed_at >= ' + since
      : 'WHERE l.owner_app_id = ? AND l.resource_type IN (\'DATASET\',\'MODEL_FILE\')'
    return this.db
      .prepare(
        `SELECT l.resource_type resource_type,
           CASE WHEN l.resource_type='DATASET' THEN CAST(l.resource_id AS TEXT) ELSE l.token END key,
           COUNT(*) count, COALESCE(SUM(l.bytes),0) bytes,
           SUM(CASE WHEN l.http_status>=400 THEN 1 ELSE 0 END) failures,
           MAX(l.accessed_at) last_access
         FROM api_access_logs l ${where}
         GROUP BY l.resource_type, key`,
      )
      .all(appId) as Array<Record<string, unknown>>
  }

  /** Top 资源：JOIN datasets/model_files 名称；非内置资源类型经 ExtensionRegistry 解析显示名。不含 PLUGIN_EP（接口目录单独展示）。 */
  topResources(appId: number, range: MonitorRange, page: number, size: number): Page<Record<string, unknown>> {
    const since = this.since(range)
    const where = since
      ? "WHERE l.owner_app_id = ? AND l.resource_type <> 'PLUGIN_EP' AND l.accessed_at >= " + since
      : "WHERE l.owner_app_id = ? AND l.resource_type <> 'PLUGIN_EP'"
    const rows = this.db
      .prepare(
        `SELECT l.resource_type resource_type, l.resource_id resource_id,
           COALESCE(d.name, mf.name, '') name,
           COUNT(*) count, COALESCE(SUM(l.bytes),0) bytes,
           SUM(CASE WHEN l.http_status=304 THEN 1 ELSE 0 END) not_modified,
           SUM(CASE WHEN l.http_status>=400 THEN 1 ELSE 0 END) failures
         FROM api_access_logs l
         LEFT JOIN datasets d ON l.resource_type='DATASET' AND d.id = l.resource_id
         LEFT JOIN model_files mf ON l.resource_type='MODEL_FILE' AND mf.id = l.resource_id
         ${where} GROUP BY l.resource_type, l.resource_id ORDER BY count DESC LIMIT ? OFFSET ?`,
      )
      .all(appId, size, (page - 1) * size) as Array<Record<string, unknown>>
    const total = this.groupedCount(
      `SELECT 1 FROM api_access_logs l
         LEFT JOIN datasets d ON l.resource_type='DATASET' AND d.id = l.resource_id
         LEFT JOIN model_files mf ON l.resource_type='MODEL_FILE' AND mf.id = l.resource_id
         ${where} GROUP BY l.resource_type, l.resource_id`,
      [appId],
    )
    return this.pageOf(rows.map((r) => this.resolveName(r)), total, page, size)
  }

  topIps(appId: number, range: MonitorRange, page: number, size: number): Page<Record<string, unknown>> {
    const since = this.since(range)
    const where = since
      ? 'WHERE owner_app_id = ? AND accessed_at >= ' + since
      : 'WHERE owner_app_id = ?'
    const rows = this.db
      .prepare(
        `SELECT ip, COUNT(*) count, COALESCE(SUM(bytes),0) bytes,
           SUM(CASE WHEN http_status=304 THEN 1 ELSE 0 END) not_modified
         FROM api_access_logs ${where} GROUP BY ip ORDER BY count DESC LIMIT ? OFFSET ?`,
      )
      .all(appId, size, (page - 1) * size) as Array<Record<string, unknown>>
    const total = this.groupedCount(`SELECT 1 FROM api_access_logs ${where} GROUP BY ip`, [appId])
    return this.pageOf(rows, total, page, size)
  }

  topApps(appId: number, range: MonitorRange, page: number, size: number): Page<Record<string, unknown>> {
    const since = this.since(range)
    const where = since
      ? 'WHERE owner_app_id = ? AND accessed_at >= ' + since
      : 'WHERE owner_app_id = ?'
    const rows = this.db
      .prepare(
        `SELECT consumer_app_id app_id, COUNT(*) count, COALESCE(SUM(bytes),0) bytes
         FROM api_access_logs ${where} GROUP BY consumer_app_id ORDER BY count DESC LIMIT ? OFFSET ?`,
      )
      .all(appId, size, (page - 1) * size) as Array<Record<string, unknown>>
    const total = this.groupedCount(`SELECT 1 FROM api_access_logs ${where} GROUP BY consumer_app_id`, [appId])
    return this.pageOf(rows, total, page, size)
  }

  series(appId: number, range: MonitorRange): Array<Record<string, unknown>> {
    const since = this.since(range) ?? "datetime('now', '-30 day', 'localtime')"
    return this.db
      .prepare(
        `SELECT strftime('%Y-%m-%d %H:00', accessed_at) bucket, COUNT(*) count,
           COALESCE(SUM(bytes),0) bytes,
           SUM(CASE WHEN http_status=304 THEN 1 ELSE 0 END) not_modified
         FROM api_access_logs WHERE owner_app_id = ? AND accessed_at >= ${since}
         GROUP BY bucket ORDER BY bucket`,
      )
      .all(appId) as Array<Record<string, unknown>>
  }

  recent(appId: number, page: number, size: number): Page<Record<string, unknown>> {
    const rows = this.db
      .prepare(
        `SELECT l.id, l.resource_type resource_type, l.resource_id resource_id,
           l.plugin_type plugin_type,
           COALESCE(d.name, mf.name, '') name,
           l.endpoint, l.http_status http_status, l.bytes, l.ip, l.accessed_at accessed_at
         FROM api_access_logs l
         LEFT JOIN datasets d ON l.resource_type='DATASET' AND d.id = l.resource_id
         LEFT JOIN model_files mf ON l.resource_type='MODEL_FILE' AND mf.id = l.resource_id
         WHERE l.owner_app_id = ? ORDER BY l.id DESC LIMIT ? OFFSET ?`,
      )
      .all(appId, size, (page - 1) * size) as Array<Record<string, unknown>>
    const total = (this.db.prepare('SELECT COUNT(*) c FROM api_access_logs WHERE owner_app_id = ?').get(appId) as { c: number }).c
    return this.pageOf(rows.map((r) => this.resolveName(r)), total, page, size)
  }

  /** 非内置资源类型（非 DATASET/MODEL_FILE）经插件 resourceName() 解析显示名；PLUGIN_EP 显示插件名。 */
  private resolveName(row: Record<string, unknown>): Record<string, unknown> {
    const type = row.resource_type as string
    if (type === 'PLUGIN_EP') {
      row.name = (row.plugin_type as string) || 'PLUGIN_EP'
      return row
    }
    if (type !== 'DATASET' && type !== 'MODEL_FILE' && !row.name) {
      const resolved = this.extensions.resolveResourceName(type, Number(row.resource_id))
      if (resolved) row.name = resolved
    }
    return row
  }
}
