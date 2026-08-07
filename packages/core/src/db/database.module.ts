import { Global, Module, Inject } from '@nestjs/common'
import BetterSqlite3 from 'better-sqlite3'
import type BetterSqlite3NS from 'better-sqlite3'
import { CONFIG, configProvider, type AIBaseConfig } from '../config.js'
import { SchemaInitializer } from './schema-initializer.js'

/** SQLite 连接（better-sqlite3 同步 API，全局单例）。 */
export const DB = Symbol('SQLiteDB')

@Global()
@Module({
  providers: [
    configProvider,
    {
      provide: DB,
      useFactory: async (config: AIBaseConfig) => {
        const db = new BetterSqlite3(config.dbPath)
        db.pragma('journal_mode = WAL')
        db.pragma('foreign_keys = ON')
        await new SchemaInitializer(config).initialize(db)
        return db
      },
      inject: [CONFIG],
    },
  ],
  exports: [CONFIG, DB],
})
export class DatabaseModule {
  constructor(@Inject(DB) private readonly db: BetterSqlite3NS.Database) {}

  async onApplicationShutdown() {
    this.db.close()
  }
}

/** 便捷注入装饰器：@InjectDb() db: BetterSqlite3NS.Database */
export const InjectDb = () => Inject(DB)
