import { Inject, Injectable, Logger } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import { ExtensionRegistry } from './extension.registry.js'

/**
 * 插件建表 DDL 执行器（框架级 schema.sql 约束）：
 * 插件目录放 schema.sql（幂等 CREATE TABLE/INDEX IF NOT EXISTS），加载器读取后
 * 由 PluginLoader 在插件加载完成（onApplicationBootstrap / reloadAll）后显式调用 execute()。
 * - 显式触发而非 OnApplicationBootstrap：保证执行时机在插件注册之后（模块 distance 顺序不可依赖）。
 * - 按 ';' 切分逐语句执行，单条失败隔离（logger.warn），不影响平台与其他插件。
 */
@Injectable()
export class SchemaBootstrapService {
  private readonly logger = new Logger(SchemaBootstrapService.name)

  constructor(
    @Inject(DB) private readonly db: Database.Database,
    @Inject(ExtensionRegistry) private readonly extensions: ExtensionRegistry,
  ) {}

  /** 执行全部已加载插件的 schema.sql（幂等，可重复调用）。 */
  execute(): void {
    for (const stmt of this.extensions.allSchemaDdl()) {
      try {
        this.db.exec(stmt)
      } catch (e) {
        this.logger.warn(`插件 DDL 执行失败（已隔离）: ${(e as Error).message}`)
      }
    }
  }
}
