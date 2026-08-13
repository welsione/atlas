import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import { now } from '../common/utils.js'

export interface EndpointRule {
  id: number
  appId: number
  pluginType: string
  method: string
  endpointPath: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface EndpointAccessLog {
  ownerAppId: number
  consumerAppId: number
  pluginType: string
  method: string
  endpointPath: string
  httpStatus: number
  bytes: number
  ip: string
  ua: string
}

/**
 * 接口启停规则仓储（接口监控管理面）：
 * - 规则按应用维度（app_id, plugin_type, method, endpoint_path），无规则行 = 默认启用。
 * - logAccess 记录插件 ep 数据面调用到 api_access_logs（resource_type='PLUGIN_EP'），供接口目录统计。
 */
@Injectable()
export class EndpointRuleRepository {
  constructor(@Inject(DB) private readonly db: Database.Database) {}

  /** 是否允许调用（无规则行默认允许）。 */
  isAllowed(appId: number, pluginType: string, method: string, endpointPath: string): boolean {
    const row = this.db
      .prepare('SELECT enabled FROM endpoint_rules WHERE app_id = ? AND plugin_type = ? AND method = ? AND endpoint_path = ?')
      .get(appId, pluginType, method, endpointPath) as { enabled: number } | undefined
    return row === undefined || row.enabled === 1
  }

  /** 设置启停（upsert）。 */
  setEnabled(appId: number, pluginType: string, method: string, endpointPath: string, enabled: boolean): void {
    const ts = now()
    this.db
      .prepare(
        `INSERT INTO endpoint_rules (app_id, plugin_type, method, endpoint_path, enabled, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(app_id, plugin_type, method, endpoint_path)
         DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
      )
      .run(appId, pluginType, method, endpointPath, enabled ? 1 : 0, ts, ts)
  }

  /** 删除规则，恢复默认启用。 */
  remove(appId: number, pluginType: string, method: string, endpointPath: string): void {
    this.db
      .prepare('DELETE FROM endpoint_rules WHERE app_id = ? AND plugin_type = ? AND method = ? AND endpoint_path = ?')
      .run(appId, pluginType, method, endpointPath)
  }

  /** 某应用的全部规则。 */
  list(appId: number): EndpointRule[] {
    const rows = this.db
      .prepare('SELECT * FROM endpoint_rules WHERE app_id = ? ORDER BY plugin_type, method, endpoint_path')
      .all(appId) as Array<{
      id: number
      app_id: number
      plugin_type: string
      method: string
      endpoint_path: string
      enabled: number
      created_at: string
      updated_at: string
    }>
    return rows.map((r) => ({
      id: r.id,
      appId: r.app_id,
      pluginType: r.plugin_type,
      method: r.method,
      endpointPath: r.endpoint_path,
      enabled: r.enabled === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  /** 记录插件 ep 数据面调用（成功与失败都记）。 */
  logAccess(log: EndpointAccessLog): void {
    this.db
      .prepare(
        `INSERT INTO api_access_logs (owner_app_id, consumer_app_id, resource_type, resource_id, plugin_type, token,
           endpoint, http_status, bytes, ip, user_agent, accessed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        log.ownerAppId, log.consumerAppId, 'PLUGIN_EP', 0, log.pluginType, '',
        `${log.method} ${log.endpointPath}`, log.httpStatus, log.bytes, log.ip ?? '', log.ua ?? '',
        now(),
      )
  }
}
