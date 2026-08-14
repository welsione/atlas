import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { now } from '../common/utils.js'
import type { ExternalInterfaceSensitivity } from '@atlas/types'

/** 插件公开端点 token 行。 */
export interface PluginEpTokenRow {
  id: number
  appId: number
  pluginType: string
  method: string
  endpointPath: string
  token: string
  sensitivity: ExternalInterfaceSensitivity
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 插件公开端点（public:true）token 仓储：
 * - 实例启用时按 (appId, pluginType, method, endpointPath) 生成/复用防穷举 token；
 * - 作为「对外接口」统一寻址句柄，供数据面消费与接口管理目录引用；
 * - 实例停用/卸载时注销对应行（公开 ep 立即失效）。
 */
@Injectable()
export class PluginEpTokenRepository {
  constructor(@Inject(DB) private readonly db: Database.Database) {}

  /** 同步单个插件的公开端点 token 集合：按声明 upsert，未在声明中的旧 token 注销。 */
  sync(
    appId: number,
    pluginType: string,
    declared: Array<{ method: string; endpointPath: string; sensitivity: ExternalInterfaceSensitivity }>,
  ): void {
    const ts = now()
    const tx = this.db.transaction(() => {
      for (const ep of declared) {
        const existing = this.db
          .prepare('SELECT id FROM plugin_ep_tokens WHERE app_id = ? AND plugin_type = ? AND method = ? AND endpoint_path = ?')
          .get(appId, pluginType, ep.method, ep.endpointPath) as { id: number } | undefined
        if (existing) {
          this.db
            .prepare(
              'UPDATE plugin_ep_tokens SET sensitivity = ?, updated_at = ? WHERE id = ?',
            )
            .run(ep.sensitivity, ts, existing.id)
        } else {
          const token = randomBytes(32).toString('hex')
          this.db
            .prepare(
              `INSERT INTO plugin_ep_tokens (app_id, plugin_type, method, endpoint_path, token, sensitivity, enabled, created_at, updated_at)
               VALUES (?,?,?,?,?,?,1,?,?)`,
            )
            .run(appId, pluginType, ep.method, ep.endpointPath, token, ep.sensitivity, ts, ts)
        }
      }
      // 注销不再公开声明的旧 token
      const known = new Set(declared.map((d) => `${d.method} ${d.endpointPath}`))
      const rows = this.db
        .prepare('SELECT id, method, endpoint_path FROM plugin_ep_tokens WHERE app_id = ? AND plugin_type = ?')
        .all(appId, pluginType) as Array<{ id: number; method: string; endpoint_path: string }>
      for (const row of rows) {
        if (!known.has(`${row.method} ${row.endpoint_path}`)) {
          this.db.prepare('DELETE FROM plugin_ep_tokens WHERE id = ?').run(row.id)
        }
      }
    })
    tx()
  }

  /** 注销某应用下某插件的全部公开端点 token（实例停用/卸载）。 */
  removeByPlugin(appId: number, pluginType: string): void {
    this.db.prepare('DELETE FROM plugin_ep_tokens WHERE app_id = ? AND plugin_type = ?').run(appId, pluginType)
  }

  /** 按 token 解析公开端点（返回 null 表示无此 token 或已注销）。 */
  findByToken(token: string): PluginEpTokenRow | undefined {
    const row = this.db
      .prepare('SELECT * FROM plugin_ep_tokens WHERE token = ?')
      .get(token) as
      | {
          id: number
          app_id: number
          plugin_type: string
          method: string
          endpoint_path: string
          token: string
          sensitivity: string
          enabled: number
          created_at: string
          updated_at: string
        }
      | undefined
    if (!row) return undefined
    return this.map(row)
  }

  /** 某插件在指定路径是否匹配某 token（校验属主 + 路径）。 */
  matchToken(appId: number, pluginType: string, method: string, endpointPath: string, token: string): boolean {
    const row = this.db
      .prepare(
        'SELECT 1 FROM plugin_ep_tokens WHERE app_id = ? AND plugin_type = ? AND method = ? AND endpoint_path = ? AND token = ?',
      )
      .get(appId, pluginType, method, endpointPath, token)
    return !!row
  }

  /** 某应用的公开端点 token 行（供接口目录）。 */
  listByApp(appId: number): PluginEpTokenRow[] {
    const rows = this.db
      .prepare('SELECT * FROM plugin_ep_tokens WHERE app_id = ? ORDER BY plugin_type, method, endpoint_path')
      .all(appId) as Array<Record<string, unknown>>
    return rows.map((r) => this.map(r))
  }

  private map(r: Record<string, unknown>): PluginEpTokenRow {
    return {
      id: Number(r.id),
      appId: Number(r.app_id),
      pluginType: r.plugin_type as string,
      method: r.method as string,
      endpointPath: r.endpoint_path as string,
      token: r.token as string,
      sensitivity: (r.sensitivity as ExternalInterfaceSensitivity) || 'PUBLIC',
      enabled: Number(r.enabled) === 1,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }
  }
}
