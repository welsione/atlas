import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import { Test } from '@nestjs/testing'
import { EventEmitterModule } from '@nestjs/event-emitter'
import type BetterSqlite3NS from 'better-sqlite3'
import BetterSqlite3 from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CONFIG } from '../config.js'
import { DB } from '../db/database.module.js'
import { SchemaInitializer } from '../db/schema-initializer.js'
import { AppRepository } from '../apps/app.repository.js'
import { AppService } from '../apps/app.service.js'
import { PluginService } from '../plugins/plugin.service.js'
import { IpRuleRepository } from '../security/ip-rule.repository.js'
import { MonitorRepository } from '../monitor/monitor.repository.js'
import { PlatformEventEmitter } from './platform-event-emitter.js'
import { ExtensionRegistry } from './extension.registry.js'
import { AppFacade } from './app.facade.js'
import { MonitorFacade } from './monitor.facade.js'
import { SecurityFacade } from './security.facade.js'
import { PlatformFacade } from './platform.facade.js'
import { PluginRegistry } from '../plugins/plugin.registry.js'
import { SchemaBootstrapService } from './schema-bootstrap.service.js'

describe('SPI 门面', () => {
  let db: BetterSqlite3NS.Database
  let dir: string
  let appFacade: AppFacade
  let monitorFacade: MonitorFacade
  let securityFacade: SecurityFacade
  let platformFacade: PlatformFacade
  let registry: PluginRegistry
  let extensions: ExtensionRegistry

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'atlas-spi-facade-'))
    db = new BetterSqlite3(join(dir, 'test.db'))
    const config = {
      dataDir: dir,
      dbPath: join(dir, 'test.db'),
      encKey: 'test-key',
      adminPassword: '',
      adminKey: '',
      authEnabled: false,
      pluginScanIntervalMs: 10000,
      datasetRefreshIntervalMs: 60000,
      pluginsDir: join(dir, 'plugins'),
      port: 0,
      trustProxy: false,
      devResetDb: false,
      corsOrigin: '*',
      keepLogDays: 30,
    }
    await new SchemaInitializer(config).initialize(db)
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: DB, useValue: db },
        AppRepository,
        AppService,
        IpRuleRepository,
        MonitorRepository,
        PluginRegistry,
        { provide: PluginService, useValue: { autoInstantiate: () => undefined } },
        PlatformEventEmitter,
        ExtensionRegistry,
        AppFacade,
        MonitorFacade,
        SecurityFacade,
        PlatformFacade,
      ],
    }).compile()
    appFacade = moduleRef.get(AppFacade)
    monitorFacade = moduleRef.get(MonitorFacade)
    securityFacade = moduleRef.get(SecurityFacade)
    platformFacade = moduleRef.get(PlatformFacade)
    registry = moduleRef.get(PluginRegistry)
    extensions = moduleRef.get(ExtensionRegistry)
  })

  afterAll(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('AppFacade.list/get/create 委托应用服务', () => {
    const { app, secret } = appFacade.create('SPI 应用', 'desc')
    expect(secret.length).toBe(64)
    expect(appFacade.list().some((a) => a.id === app.id)).toBe(true)
    expect(appFacade.get(app.id).name).toBe('SPI 应用')
  })

  it('MonitorFacade.overview 返回数据面聚合', () => {
    const overview = monitorFacade.overview(1, 'all')
    expect(typeof overview.total).toBe('number')
  })

  it('SecurityFacade 管理 IP 规则', () => {
    securityFacade.blockIp('10.0.0.1')
    expect(securityFacade.isBlocked('10.0.0.1')).toBe(true)
    securityFacade.unblockIp('10.0.0.1')
    expect(securityFacade.isBlocked('10.0.0.1')).toBe(false)
  })

  it('SecurityFacade.publicUrl 注册公开前缀', () => {
    const registry = (securityFacade as unknown as { extensions: ExtensionRegistry }).extensions
    securityFacade.publicUrl('/api/health/')
    expect(registry.allPublicUrls()).toContain('/api/health/')
  })

  it('PlatformFacade.meta 返回平台元信息（不含密钥）', () => {
    const meta = platformFacade.meta()
    expect(meta.platform).toBe('atlas')
    expect(typeof meta.version).toBe('string')
    expect(meta).not.toHaveProperty('encKey')
  })

  it('ExtensionRegistry 聚合插件声明式扩展点（schema.sql/cleanupTables/logTables/publicUrls/resourceName）', () => {
    registry.register({
      plugin: {
        type: 'test-spi-decl',
        name: 'SPI 声明',
        describe: '声明式扩展点测试',
        defaultDataScope: 'GLOBAL_SHARED',
        cleanupTables: () => [{ table: 'spi_item', column: 'app_id' }],
        logTables: () => [{ table: 'spi_item_log', column: 'created_at' }],
        publicUrls: () => ['/api/deep/'],
        resourceName: () => [{ resourceType: 'CUSTOM_RES', nameOf: (id) => `资源#${id}` }],
      },
      artifact: 'spi-test',
      artifactHash: '',
      version: '',
      schemaSql: 'CREATE TABLE IF NOT EXISTS spi_item (id INTEGER PRIMARY KEY, app_id INTEGER);',
    })

    expect(extensions.allSchemaDdl()).toContain('CREATE TABLE IF NOT EXISTS spi_item (id INTEGER PRIMARY KEY, app_id INTEGER)')
    expect(extensions.allCleanupTables()).toContainEqual({ table: 'spi_item', column: 'app_id' })
    expect(extensions.allLogTables()).toContainEqual({ table: 'spi_item_log', column: 'created_at' })
    expect(extensions.allPublicUrls()).toContain('/api/deep/')
    expect(extensions.resolveResourceName('CUSTOM_RES', 42)).toBe('资源#42')
    expect(extensions.resolveResourceName('DATASET', 1)).toBeNull()
  })

  it('SchemaBootstrapService 执行插件 schema.sql（幂等）', () => {
    registry.register({
      plugin: {
        type: 'test-schema',
        name: 'Schema 测试',
        describe: '建表测试',
        defaultDataScope: 'GLOBAL_SHARED',
      },
      artifact: 'spi-boot',
      artifactHash: '',
      version: '',
      schemaSql: 'CREATE TABLE IF NOT EXISTS spi_boot (id INTEGER PRIMARY KEY, app_id INTEGER);',
    })
    const svc = new SchemaBootstrapService(db, extensions)
    svc.execute()
    svc.execute() // 幂等：执行两次不报错
    const cols = db.prepare("SELECT name FROM pragma_table_info('spi_boot')").all() as Array<{ name: string }>
    expect(cols.some((c) => c.name === 'app_id')).toBe(true)
  })
})