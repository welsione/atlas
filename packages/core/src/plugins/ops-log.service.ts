import { Injectable } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import { now } from '../common/utils.js'
import type Database from 'better-sqlite3'

/**
 * 运维工作日志（平台运维台跨应用查看）：插件经 env.ops() 写入。
 */
@Injectable()
export class OpsLogService {
  constructor(@Inject(DB) private readonly db: Database.Database) {}

  write(appId: number | null, pluginType: string, level: string, message: string, detail?: Record<string, unknown>): void {
    const upper = level?.toUpperCase() ?? 'INFO'
    const normalized = upper === 'WARN' || upper === 'ERROR' || upper === 'DEBUG' ? upper : 'INFO'
    let detailJson = '{}'
    if (detail && Object.keys(detail).length > 0) {
      try {
        detailJson = JSON.stringify(detail)
      } catch {
        detailJson = '{}'
      }
    }
    this.db
      .prepare(
        'INSERT INTO ops_logs (app_id, plugin_type, level, message, detail_json, created_at) VALUES (?,?,?,?,?,?)',
      )
      .run(appId ?? 0, pluginType ?? '', normalized, message, detailJson, now())
  }

  query(
    filter: { appId?: number; pluginType?: string; level?: string; page?: number; size?: number },
  ): { total: number; page: number; size: number; rows: Record<string, unknown>[] } {
    const size = Math.max(1, Math.min(filter.size && filter.size > 0 ? filter.size : 20, 100))
    const page = Math.max(1, filter.page && filter.page > 0 ? filter.page : 1)
    const where: string[] = []
    const args: unknown[] = []
    if (filter.appId !== undefined) {
      where.push('app_id = ?')
      args.push(filter.appId)
    }
    if (filter.pluginType) {
      where.push('plugin_type = ?')
      args.push(filter.pluginType)
    }
    if (filter.level) {
      where.push('level = ?')
      args.push(filter.level)
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : ''
    const totalRow = this.db
      .prepare(`SELECT COUNT(*) c FROM ops_logs${whereSql}`)
      .get(...args) as { c: number }
    const rows = this.db
      .prepare(`SELECT id, app_id, plugin_type, level, message, detail_json, created_at FROM ops_logs${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...args, size, (page - 1) * size) as Array<Record<string, unknown>>
    return {
      total: totalRow.c,
      page,
      size,
      rows: rows.map((r) => ({
        id: r.id,
        appId: r.app_id,
        pluginType: r.plugin_type,
        level: r.level,
        message: r.message,
        detailJson: r.detail_json,
        createdAt: r.created_at,
      })),
    }
  }

  overview(): { levels: Record<string, number>; byPlugin: Array<Record<string, unknown>>; hourly: Array<Record<string, unknown>> } {
    const levels: Record<string, number> = { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 }
    for (const row of this.db.prepare('SELECT level, COUNT(*) c FROM ops_logs GROUP BY level').all() as Array<{ level: string; c: number }>) {
      levels[row.level] = row.c
    }
    const byPlugin = this.db
      .prepare(
        `SELECT plugin_type, COUNT(*) count, SUM(CASE WHEN level='ERROR' THEN 1 ELSE 0 END) errors
         FROM ops_logs WHERE created_at >= datetime('now', '-7 day', 'localtime')
         GROUP BY plugin_type ORDER BY count DESC`,
      )
      .all() as Array<Record<string, unknown>>
    const hourly = this.db
      .prepare(
        `SELECT strftime('%Y-%m-%d %H:00', created_at) bucket, COUNT(*) count,
           SUM(CASE WHEN level='ERROR' THEN 1 ELSE 0 END) errors
         FROM ops_logs WHERE created_at >= datetime('now', '-24 hours', 'localtime')
         GROUP BY bucket ORDER BY bucket`,
      )
      .all() as Array<Record<string, unknown>>
    return { levels, byPlugin, hourly }
  }
}
