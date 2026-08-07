import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Logger } from '@nestjs/common'
import type { AIBaseConfig } from '../config.js'

/**
 * 数据库结构初始化：清理旧版结构（无生产数据，全量重建）→ 执行 schema.sql。
 * 与 Java 版语义一致：开发期每次启动 DROP 重建，避免结构残留。
 */
export class SchemaInitializer {
  private readonly logger = new Logger(SchemaInitializer.name)

  private static readonly LEGACY_TABLES = [
    'apps', 'app_credentials', 'plugins', 'plugin_instances', 'plugin_store',
    'datasets', 'secrets', 'dataset_app_grants',
    'dataset_download_logs', 'secret_access_logs', 'auth_logs',
    'api_access_logs', 'ops_logs', 'plugin_file_tokens',
    'providers', 'prompts', 'prompt_versions', 'model_files',
    'download_logs', 'upload_logs',
  ]

  constructor(private readonly config: AIBaseConfig) {}

  /** 打开（或创建）数据库并完成结构初始化。 */
  async initialize(db: {
    exec: (sql: string) => void
    close: () => void
  }): Promise<void> {
    const dataDir = this.config.dataDir
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }
    for (const table of SchemaInitializer.LEGACY_TABLES) {
      db.exec(`DROP TABLE IF EXISTS ${table}`)
    }
    const schemaPath = resolve(__dirname, 'schema.sql')
    const sql = readFileSync(schemaPath, 'utf8')
    // schema.sql 含 CREATE TABLE IF NOT EXISTS 与索引；逐语句执行
    for (const statement of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      db.exec(statement)
    }
    this.logger.log(`数据库结构初始化完成（data-dir=${dataDir}）`)
  }
}
