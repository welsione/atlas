import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import { now } from '../common/utils.js'

/** IP 规则仓储：黑名单（BLOCK / AUTO_BLOCK）。 */
@Injectable()
export class IpRuleRepository {
  constructor(@Inject(DB) private readonly db: Database.Database) {}

  isBlocked(ip: string): boolean {
    if (!ip) return false
    const row = this.db
      .prepare('SELECT type FROM ip_rules WHERE ip = ?')
      .get(ip) as { type: string } | undefined
    return row !== undefined
  }

  /** 封禁 IP（存在则保留原类型，更新 reason）。 */
  block(ip: string, reason = 'manual', type = 'BLOCK'): void {
    if (!ip) return
    this.db.prepare('DELETE FROM ip_rules WHERE ip = ?').run(ip)
    this.db
      .prepare('INSERT INTO ip_rules (ip, type, reason, created_at) VALUES (?,?,?,?)')
      .run(ip, type, reason, now())
  }

  /** 解封 IP。 */
  unblock(ip: string): void {
    if (!ip) return
    this.db.prepare('DELETE FROM ip_rules WHERE ip = ?').run(ip)
  }
}
