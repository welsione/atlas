import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import { CONFIG, type AtlasConfig } from '../config.js'
import { ExtensionRegistry } from '../spi/extension.registry.js'

/**
 * 日志保留策略：各审计/访问日志表按各自时间列定期清理过期行（默认保留 30 天），
 * 防止 ops_logs / api_access_logs 等无限膨胀。表清单由 ExtensionRegistry 聚合（内置 + 插件 logTables()）。
 */
@Injectable()
export class LogCleanupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LogCleanupService.name)
  private timer: NodeJS.Timeout | null = null

  /** 轮换后旧 secret 的宽限期（天）：过期后自动失活，不再可校验。 */
  private static readonly CREDENTIAL_GRACE_DAYS = 7

  constructor(
    @Inject(DB) private readonly db: Database.Database,
    @Inject(CONFIG) private readonly config: AtlasConfig,
    @Inject(ExtensionRegistry) private readonly extensions: ExtensionRegistry,
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
    this.cleanupLogs()
    this.cleanupCredentials()
  }

  private cleanupLogs(): void {
    const days = this.config.keepLogDays
    if (days <= 0) return
    const cutoff = `datetime('now', '-${days} days', 'localtime')`
    let total = 0
    for (const { table, column } of this.extensions.allLogTables()) {
      try {
        const info = this.db.prepare(`DELETE FROM ${table} WHERE ${column} < ${cutoff}`).run()
        total += Number(info.changes)
      } catch (e) {
        this.logger.warn(`日志清理失败：${table}，${(e as Error).message}`)
      }
    }
    if (total > 0) this.logger.log(`日志保留清理完成：删除 ${total} 行（保留 ${days} 天）`)
  }

  /**
   * 凭证保留策略：轮换后的旧 secret 仅保留宽限期（默认 7 天）内有效，
   * 过期后失活（不可再校验），再按保留期清理，防止历史凭证永久有效 + 表无限膨胀。
   * 最新凭证（当前使用中）永不失活。
   */
  private cleanupCredentials(): void {
    const graceDays = LogCleanupService.CREDENTIAL_GRACE_DAYS
    const expired = this.db
      .prepare(
        `UPDATE app_credentials SET active = 0
         WHERE active = 1 AND updated_at < datetime('now', '-${graceDays} days', 'localtime')
           AND id != (SELECT id FROM app_credentials a2 WHERE a2.app_id = app_credentials.app_id ORDER BY id DESC LIMIT 1)`,
      )
      .run()
    const days = this.config.keepLogDays
    if (days > 0) {
      const deleted = this.db
        .prepare(`DELETE FROM app_credentials WHERE active = 0 AND updated_at < datetime('now', '-${days} days', 'localtime')`)
        .run()
      if (Number(deleted.changes) > 0 || Number(expired.changes) > 0) {
        this.logger.log(`凭证保留清理完成：失活 ${Number(expired.changes)} 个过期凭证，删除 ${Number(deleted.changes)} 个历史凭证（宽限 ${graceDays} 天 / 保留 ${days} 天）`)
      }
    }
  }
}
