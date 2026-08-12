import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Logger } from '@nestjs/common'
import type { AtlasConfig } from '../config.js'
import type Database from 'better-sqlite3'

/**
 * 数据库结构初始化（幂等 + 版本化迁移）：
 * - schema.sql 全部 CREATE TABLE/INDEX IF NOT EXISTS，可直接幂等执行
 * - 结构变更走 user_version 迁移（migrations 按版本升序应用）
 * - 仅当 ATLAS_DEV_RESET_DB=1（开发重置）时 DROP 全表重建
 * 生产数据跨重启保留。
 */
export class SchemaInitializer {
  private readonly logger = new Logger(SchemaInitializer.name)

  constructor(private readonly config: AtlasConfig) {}

  /** 当前结构版本。 */
  static readonly SCHEMA_VERSION = 1

  /** 版本化迁移：每个 up(db) 在事务内执行，成功后 user_version 递增。 */
  private static readonly MIGRATIONS: Array<{ version: number; up: (db: Database.Database) => void }> = [
    {
      // v1：plugins 表补 icon 列（0.x 早期库结构演进）
      version: 1,
      up: (db) => {
        const cols = db.prepare('PRAGMA table_info(plugins)').all() as Array<{ name: string }>
        if (!cols.some((c) => c.name === 'icon')) {
          db.exec("ALTER TABLE plugins ADD COLUMN icon TEXT NOT NULL DEFAULT ''")
        }
      },
    },
    {
      // v2：plugin_store 加 plugin_type 维度，隔离不同插件（防跨插件同 key 碰撞 + 卸载误删兄弟数据）。
      // SQLite 无法直接改表内 UNIQUE 约束，需重建表；旧行 plugin_type 回填 ''（上线前库无生产数据可接受）。
      version: 2,
      up: (db) => {
        const cols = db.prepare('PRAGMA table_info(plugin_store)').all() as Array<{ name: string }>
        if (cols.some((c) => c.name === 'plugin_type')) return
        db.exec(`
          ALTER TABLE plugin_store RENAME TO plugin_store_old;
          CREATE TABLE plugin_store (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instance_id INTEGER NOT NULL,
            plugin_type TEXT NOT NULL DEFAULT '',
            entity_id TEXT NOT NULL DEFAULT '',
            entity_key TEXT NOT NULL,
            value_json TEXT NOT NULL DEFAULT '{}',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(instance_id, plugin_type, entity_id, entity_key)
          );
          INSERT INTO plugin_store (id, instance_id, plugin_type, entity_id, entity_key, value_json, version, created_at, updated_at)
            SELECT id, instance_id, '', entity_id, entity_key, value_json, version, created_at, updated_at FROM plugin_store_old;
          DROP TABLE plugin_store_old;
        `)
      },
    },
  ]

  /** 打开（或创建）数据库并完成结构初始化。 */
  async initialize(db: Database.Database): Promise<void> {
    const dataDir = this.config.dataDir
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }
    if (this.config.devResetDb) {
      for (const table of SchemaInitializer.LEGACY_TABLES) {
        db.exec(`DROP TABLE IF EXISTS ${table}`)
      }
      db.pragma('user_version = 0')
      this.logger.warn('ATLAS_DEV_RESET_DB=1：已清空全部表（开发重置）')
    }
    const schemaPath = resolve(__dirname, 'schema.sql')
    const sql = readFileSync(schemaPath, 'utf8')
    // schema.sql 含 CREATE TABLE IF NOT EXISTS 与索引；逐语句执行
    for (const statement of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      db.exec(statement)
    }
    const current = (db.pragma('user_version') as { user_version: number })?.user_version ?? 0
    for (const migration of SchemaInitializer.MIGRATIONS) {
      if (migration.version > current) {
        migration.up(db)
        db.pragma(`user_version = ${migration.version}`)
        this.logger.log(`数据库迁移应用：v${migration.version}`)
      }
    }
    this.logger.log(`数据库结构初始化完成（data-dir=${dataDir}，schema-v=${Math.max(current, ...SchemaInitializer.MIGRATIONS.map((m) => m.version))}）`)
  }

  private static readonly LEGACY_TABLES = [
    'apps', 'app_credentials', 'plugins', 'plugin_instances', 'plugin_store',
    'datasets', 'secrets', 'dataset_app_grants',
    'dataset_download_logs', 'secret_access_logs', 'auth_logs',
    'api_access_logs', 'ops_logs', 'plugin_file_tokens',
    'providers', 'prompts', 'prompt_versions', 'model_files',
    'download_logs', 'upload_logs',
  ]
}
