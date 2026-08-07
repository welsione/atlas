import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'

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
}
