import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import type { App, AppStatus } from '@atlas/types'

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
  constructor(@Inject(DB) private readonly db: Database.Database) {}

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

  insertCredential(appId: number, secretHash: string, now: string): void {
    this.db
      .prepare('INSERT INTO app_credentials (app_id, secret_hash, active, created_at, updated_at) VALUES (?,?,1,?,?)')
      .run(appId, secretHash, now, now)
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
