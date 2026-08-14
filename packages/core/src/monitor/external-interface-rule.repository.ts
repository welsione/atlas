import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import { now } from '../common/utils.js'
import type { ExternalInterfaceSensitivity } from '@atlas/types'

export type ExternalInterfaceKind = 'DATASET' | 'PLUGIN_EP' | 'PUBLIC_FILE'

export interface ExternalInterfaceRule {
  id: number
  appId: number
  kind: ExternalInterfaceKind
  key: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ExternalInterfaceAccessLog {
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
 * 对外接口统一启停规则仓储：
 * - 覆盖三类对外接口（数据集 / 插件公开 ep / 文件公开下载）；
 * - 按应用维度 (app_id, kind, key)，无规则行 = 默认启用；
 * - 数据面消费时经 isAllowed 判定（enabled=false → 拦截，对外表现为 404 防探测）。
 */
@Injectable()
export class ExternalInterfaceRuleRepository {
  constructor(@Inject(DB) private readonly db: Database.Database) {}

  /** 是否放行（无规则行默认放行）。 */
  isAllowed(appId: number, kind: ExternalInterfaceKind, key: string): boolean {
    const row = this.db
      .prepare('SELECT enabled FROM external_interface_rules WHERE app_id = ? AND kind = ? AND key = ?')
      .get(appId, kind, key) as { enabled: number } | undefined
    return row === undefined || row.enabled === 1
  }

  /** 设置启停（upsert）。 */
  setEnabled(appId: number, kind: ExternalInterfaceKind, key: string, enabled: boolean): void {
    const ts = now()
    this.db
      .prepare(
        `INSERT INTO external_interface_rules (app_id, kind, key, enabled, created_at, updated_at)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(app_id, kind, key)
         DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
      )
      .run(appId, kind, key, enabled ? 1 : 0, ts, ts)
  }

  /** 删除规则，恢复默认放行。 */
  remove(appId: number, kind: ExternalInterfaceKind, key: string): void {
    this.db
      .prepare('DELETE FROM external_interface_rules WHERE app_id = ? AND kind = ? AND key = ?')
      .run(appId, kind, key)
  }

  /** 某应用全部规则。 */
  list(appId: number): ExternalInterfaceRule[] {
    const rows = this.db
      .prepare('SELECT * FROM external_interface_rules WHERE app_id = ? ORDER BY kind, key')
      .all(appId) as Array<{
      id: number
      app_id: number
      kind: string
      key: string
      enabled: number
      created_at: string
      updated_at: string
    }>
    return rows.map((r) => ({
      id: r.id,
      appId: r.app_id,
      kind: r.kind as ExternalInterfaceKind,
      key: r.key,
      enabled: r.enabled === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  /** 记录插件公开 ep 数据面调用（成功与失败都记）到 api_access_logs（PLUGIN_EP），供接口目录统计。 */
  logAccess(log: ExternalInterfaceAccessLog): void {
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
