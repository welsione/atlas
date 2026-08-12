import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import type { App, AppStatus } from '@atlas/types'
import { now } from '../common/utils.js'
import { ExtensionRegistry } from '../spi/extension.registry.js'

/** 应用行（DB 下划线 → 驼峰映射在 service 层做）。 */
export interface AppRow {
  id: number
  app_id: string
  name: string
  description: string
  app_secret_hash: string
  status: string
  token_ttl_seconds: number
  created_at: string
  updated_at: string
}

@Injectable()
export class AppRepository {
  constructor(
    @Inject(DB) private readonly db: Database.Database,
    @Inject(ExtensionRegistry) private readonly extensions: ExtensionRegistry,
  ) {}

  insert(row: Omit<AppRow, 'id'>): number {
    const info = this.db
      .prepare(
        `INSERT INTO apps (app_id, name, description, app_secret_hash, status, token_ttl_seconds, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(row.app_id, row.name, row.description, row.app_secret_hash, row.status, row.token_ttl_seconds, row.created_at, row.updated_at)
    return Number(info.lastInsertRowid)
  }

  findAll(): AppRow[] {
    return this.db.prepare('SELECT * FROM apps ORDER BY id').all() as AppRow[]
  }

  findById(id: number): AppRow | undefined {
    return this.db.prepare('SELECT * FROM apps WHERE id = ?').get(id) as AppRow | undefined
  }

  findByAppId(appId: string): AppRow | undefined {
    return this.db.prepare('SELECT * FROM apps WHERE app_id = ?').get(appId) as AppRow | undefined
  }

  updateSecret(id: number, secretHash: string, now: string): void {
    this.db
      .prepare('UPDATE apps SET app_secret_hash = ?, updated_at = ? WHERE id = ?')
      .run(secretHash, now, id)
  }

  updateStatus(id: number, status: AppStatus, now: string): void {
    this.db.prepare('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  }

  /**
   * 级联删除应用的全部数据（事务）：插件实例、数据集及其子表、内置插件表数据、
   * 公开文件 token、各类访问/工作日志、凭证历史。防止孤儿数据（数据集 token 残留可消费）。
   */
  deleteCascade(appId: number): void {
    const db = this.db
    const tx = db.transaction(() => {
      // 插件声明的级联清理表（cleanupTables()）：DELETE FROM table WHERE column = appId
      for (const { table, column } of this.extensions.allCleanupTables()) {
        db.prepare(`DELETE FROM ${table} WHERE ${column ?? 'app_id'} = ?`).run(appId)
      }
      const dsIds = (db.prepare('SELECT id FROM datasets WHERE app_id = ?').all(appId) as Array<{ id: number }>).map((r) => r.id)
      for (const dsId of dsIds) {
        db.prepare('DELETE FROM secrets WHERE dataset_id = ?').run(dsId)
        db.prepare('DELETE FROM dataset_app_grants WHERE dataset_id = ?').run(dsId)
        db.prepare('DELETE FROM dataset_download_logs WHERE dataset_id = ?').run(dsId)
        db.prepare('DELETE FROM secret_access_logs WHERE dataset_id = ?').run(dsId)
      }
      // 被删应用作为消费方的授权（其他应用数据集上的 grant）一并清理
      db.prepare('DELETE FROM dataset_app_grants WHERE app_id = ?').run(appId)
      db.prepare('DELETE FROM datasets WHERE app_id = ?').run(appId)

      // 注：providers/prompts/prompt_versions/model_files/download_logs/upload_logs
      // 已迁出为插件表，由各插件 cleanupTables() 经上方 allCleanupTables() 清理。

      // 插件实例 + 其作用域通用存储（instance_id 语义=scopeKey：appId=独立 / 0=共享保留）
      db.prepare('DELETE FROM plugin_instances WHERE app_id = ?').run(appId)
      db.prepare('DELETE FROM plugin_store WHERE instance_id = ?').run(appId)

      db.prepare('DELETE FROM plugin_file_tokens WHERE scope_key = ?').run(appId)
      db.prepare('DELETE FROM api_access_logs WHERE owner_app_id = ?').run(appId)
      db.prepare('DELETE FROM ops_logs WHERE app_id = ?').run(appId)
      db.prepare('DELETE FROM auth_logs WHERE app_id = ?').run(appId)
      db.prepare('DELETE FROM app_credentials WHERE app_id = ?').run(appId)
      db.prepare('DELETE FROM apps WHERE id = ?').run(appId)
    })
    tx()
  }

  /** 历史凭证过久自动失效：由 LogCleanupService 定时清理（宽限+保留策略）。 */

  insertCredential(appId: number, secretHash: string, nowTs: string): void {
    this.db
      .prepare('INSERT INTO app_credentials (app_id, secret_hash, active, created_at, updated_at) VALUES (?,?,1,?,?)')
      .run(appId, secretHash, nowTs, nowTs)
  }

  findActiveCredentials(appId: number): string[] {
    const rows = this.db
      .prepare('SELECT secret_hash FROM app_credentials WHERE app_id = ? AND active = 1')
      .all(appId) as Array<{ secret_hash: string }>
    return rows.map((r) => r.secret_hash)
  }

  revokeAllCredentials(appId: number): void {
    this.db.prepare('UPDATE app_credentials SET active = 0 WHERE app_id = ?').run(appId)
  }
}
