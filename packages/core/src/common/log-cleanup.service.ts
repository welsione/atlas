import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import { CONFIG, type AIBaseConfig } from '../config.js'

/**
 * 日志保留策略：各审计/访问日志表按各自时间列定期清理过期行（默认保留 30 天），
 * 防止 ops_logs / api_access_logs 等无限膨胀。
 */
@Injectable()
export class LogCleanupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LogCleanupService.name)
  private timer: NodeJS.Timeout | null = null

  /** 表名 + 时间列（各表列名不统一，逐表清理）。 */
  private static readonly LOG_TABLES: Array<{ table: string; column: string }> = [
    { table: 'api_access_logs', column: 'accessed_at' },
    { table: 'ops_logs', column: 'created_at' },
    { table: 'dataset_download_logs', column: 'downloaded_at' },
    { table: 'secret_access_logs', column: 'accessed_at' },
    { table: 'auth_logs', column: 'created_at' },
    { table: 'download_logs', column: 'downloaded_at' },
    { table: 'upload_logs', column: 'uploaded_at' },
  ]

  constructor(
    @Inject(DB) private readonly db: Database.Database,
    @Inject(CONFIG) private readonly config: AIBaseConfig,
  ) {}

  onApplicationBootstrap(): void {
    // 启动即清理一次 + 每小时定时
    this.runCleanup()
    this.timer = setInterval(() => this.runCleanup(), 60 * 60 * 1000)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  runCleanup(): void {
    const days = this.config.keepLogDays
    if (days <= 0) return
    const cutoff = `datetime('now', '-${days} days', 'localtime')`
    let total = 0
    for (const { table, column } of LogCleanupService.LOG_TABLES) {
      try {
        const info = this.db.prepare(`DELETE FROM ${table} WHERE ${column} < ${cutoff}`).run()
        total += Number(info.changes)
      } catch (e) {
        this.logger.warn(`日志清理失败：${table}，${(e as Error).message}`)
      }
    }
    if (total > 0) this.logger.log(`日志保留清理完成：删除 ${total} 行（保留 ${days} 天）`)
  }
}
