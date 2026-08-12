import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
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

  endpoints(appId: number, range: MonitorRange): Array<Record<string, unknown>> {
    const since = this.since(range)
    const where = since
      ? 'WHERE owner_app_id = ? AND accessed_at >= ' + since
      : 'WHERE owner_app_id = ?'
    return this.db
      .prepare(
        `SELECT endpoint, COUNT(*) count, COALESCE(SUM(bytes),0) bytes,
           SUM(CASE WHEN http_status=304 THEN 1 ELSE 0 END) not_modified,
           SUM(CASE WHEN http_status>=400 THEN 1 ELSE 0 END) failures
         FROM api_access_logs ${where} GROUP BY endpoint ORDER BY count DESC`,
      )
      .all(appId) as Array<Record<string, unknown>>
  }

  /** Top 资源：JOIN datasets/model_files 名称；非内置资源类型经 ExtensionRegistry 解析显示名。 */
  topResources(appId: number, range: MonitorRange, limit: number): Array<Record<string, unknown>> {
    const since = this.since(range)
    const where = since
      ? 'WHERE l.owner_app_id = ? AND l.accessed_at >= ' + since
      : 'WHERE l.owner_app_id = ?'
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
         ${where} GROUP BY l.resource_type, l.resource_id ORDER BY count DESC LIMIT ?`,
      )
      .all(appId, limit) as Array<Record<string, unknown>>
    return rows.map((r) => this.resolveName(r))
  }

  topIps(appId: number, range: MonitorRange, limit: number): Array<Record<string, unknown>> {
    const since = this.since(range)
    const where = since
      ? 'WHERE owner_app_id = ? AND accessed_at >= ' + since
      : 'WHERE owner_app_id = ?'
    return this.db
      .prepare(
        `SELECT ip, COUNT(*) count, COALESCE(SUM(bytes),0) bytes,
           SUM(CASE WHEN http_status=304 THEN 1 ELSE 0 END) not_modified
         FROM api_access_logs ${where} GROUP BY ip ORDER BY count DESC LIMIT ?`,
      )
      .all(appId, limit) as Array<Record<string, unknown>>
  }

  topApps(appId: number, range: MonitorRange, limit: number): Array<Record<string, unknown>> {
    const since = this.since(range)
    const where = since
      ? 'WHERE owner_app_id = ? AND accessed_at >= ' + since
      : 'WHERE owner_app_id = ?'
    return this.db
      .prepare(
        `SELECT consumer_app_id app_id, COUNT(*) count, COALESCE(SUM(bytes),0) bytes
         FROM api_access_logs ${where} GROUP BY consumer_app_id ORDER BY count DESC LIMIT ?`,
      )
      .all(appId, limit) as Array<Record<string, unknown>>
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

  recent(appId: number, limit: number): Array<Record<string, unknown>> {
    const rows = this.db
      .prepare(
        `SELECT l.id, l.resource_type resource_type, l.resource_id resource_id,
           COALESCE(d.name, mf.name, '') name,
           l.endpoint, l.http_status http_status, l.bytes, l.ip, l.accessed_at accessed_at
         FROM api_access_logs l
         LEFT JOIN datasets d ON l.resource_type='DATASET' AND d.id = l.resource_id
         LEFT JOIN model_files mf ON l.resource_type='MODEL_FILE' AND mf.id = l.resource_id
         WHERE l.owner_app_id = ? ORDER BY l.id DESC LIMIT ?`,
      )
      .all(appId, limit) as Array<Record<string, unknown>>
    return rows.map((r) => this.resolveName(r))
  }

  /** 非内置资源类型（非 DATASET/MODEL_FILE）经插件 resourceName() 解析显示名，替换 LEFT JOIN 的空名。 */
  private resolveName(row: Record<string, unknown>): Record<string, unknown> {
    const type = row.resource_type as string
    if (type !== 'DATASET' && type !== 'MODEL_FILE' && !row.name) {
      const resolved = this.extensions.resolveResourceName(type, Number(row.resource_id))
      if (resolved) row.name = resolved
    }
    return row
  }
}
