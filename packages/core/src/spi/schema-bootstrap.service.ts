import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import { ExtensionRegistry } from './extension.registry.js'

/**
 * 插件 schemaDdl 启动执行器：平台启动后按插件注册顺序执行各插件声明的幂等建表 DDL。
 * - 依赖插件已注册（PluginLoader.onApplicationBootstrap 之后 / 或作为其后续步骤）。
 * - 单条 DDL 失败隔离（logger.warn），不影响平台与其他插件。
 * - 约定插件 DDL 必须幂等（CREATE TABLE IF NOT EXISTS …）。
 */
@Injectable()
export class SchemaBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaBootstrapService.name)

  constructor(
    @Inject(DB) private readonly db: Database.Database,
    @Inject(ExtensionRegistry) private readonly extensions: ExtensionRegistry,
  ) {}

  onApplicationBootstrap(): void {
    for (const stmt of this.extensions.allSchemaDdl()) {
      try {
        this.db.exec(stmt)
      } catch (e) {
        this.logger.warn(`插件 DDL 执行失败（已隔离）: ${(e as Error).message}`)
      }
    }
  }
}