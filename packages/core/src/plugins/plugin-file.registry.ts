import { Inject, Injectable } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import { NotFoundError, ValidationError } from '../common/response.js'
import { CONFIG, type AtlasConfig } from '../config.js'

export interface PluginFileTokenRow {
  id: number
  token: string
  scope_key: number
  plugin_type: string
  rel_path: string
  name: string
  content_hash: string
  total_size: number
  file_count: number
  created_at: string
  updated_at: string
}

/**
 * 插件文件公开托管（平台数据面基础设施）：
 * 插件经 env.files().publish 注册 → 平台生成防穷举 token，服务 /api/files/{token}/download|meta
 * （304 条件下载 / IP 限流 / api_access_logs 审计）。
 */
@Injectable()
export class PluginFileRegistry {
  constructor(
    @Inject(DB) private readonly db: Database.Database,
    @Inject(CONFIG) private readonly config: AtlasConfig,
  ) {}

  publish(
    scopeKey: number,
    pluginType: string,
    relPath: string,
    filePath: string,
    name: string,
  ): { token: string; relPath: string } {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new ValidationError(`文件不存在: ${relPath}`)
    }
    const data = readFileSync(filePath)
    const hash = createHash('sha256').update(data).digest('hex')
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const token = randomBytes(32).toString('hex')
    this.db
      .prepare(
        `INSERT INTO plugin_file_tokens (token, scope_key, plugin_type, rel_path, name, content_hash, total_size, file_count, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,1,?,?)`,
      )
      .run(token, scopeKey, pluginType, relPath, name, hash, data.length, now, now)
    return { token, relPath }
  }

  unpublish(token: string): void {
    this.db.prepare('DELETE FROM plugin_file_tokens WHERE token = ?').run(token)
  }

  findByToken(token: string): PluginFileTokenRow | undefined {
    return this.db.prepare('SELECT * FROM plugin_file_tokens WHERE token = ?').get(token) as PluginFileTokenRow | undefined
  }

  /** 某作用域下已公开的文件（scope_key = appId 或 0=GLOBAL_SHARED），供对外接口目录。 */
  listByScope(scopeKey: number): PluginFileTokenRow[] {
    return this.db
      .prepare('SELECT * FROM plugin_file_tokens WHERE scope_key = ? ORDER BY id')
      .all(scopeKey) as PluginFileTokenRow[]
  }

  /** 文件实际路径（与 env.files 同根：dataDir/plugin-files/{scopeKey}/{pluginType}/{relPath}）。 */
  filePathOf(row: PluginFileTokenRow): string {
    return resolve(this.config.dataDir, 'plugin-files', String(row.scope_key), row.plugin_type, row.rel_path)
  }

  touch(token: string): void {
    this.db
      .prepare('UPDATE plugin_file_tokens SET updated_at = ? WHERE token = ?')
      .run(new Date().toISOString().slice(0, 19).replace('T', ' '), token)
  }
}
