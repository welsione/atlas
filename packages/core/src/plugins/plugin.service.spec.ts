import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import { Test } from '@nestjs/testing'
import type BetterSqlite3NS from 'better-sqlite3'
import BetterSqlite3 from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CONFIG } from '../config.js'
import { DB } from '../db/database.module.js'
import { SchemaInitializer } from '../db/schema-initializer.js'
import { PluginRegistry } from './plugin.registry.js'
import { PluginRepository } from './plugin.repository.js'
import { OpsLogService } from './ops-log.service.js'
import { PluginService } from './plugin.service.js'
import { AppRepository } from '../apps/app.repository.js'
import { AppService } from '../apps/app.service.js'
import { EnvelopeCrypto } from '../datasets/envelope-crypto.js'
import { DatasetRepository } from '../datasets/dataset.repository.js'
import { DatasetService } from '../datasets/dataset.service.js'
import type { AibasePlugin } from '@atlas/types'

/** 测试插件桩。 */
const sharedPlugin: AibasePlugin = {
  type: 'test-shared',
  name: '测试共享',
  describe: 'scope 测试：声明共享',
  defaultDataScope: 'GLOBAL_SHARED',
  scopeOverrideAllowed: true,
}

const localPlugin: AibasePlugin = {
  type: 'test-local',
  name: '测试独立',
  describe: 'scope 测试：声明独立',
  defaultDataScope: 'APP_LOCAL',
}

describe('PluginService', () => {
  let db: BetterSqlite3NS.Database
  let service: PluginService
  let appService: AppService
  let dir: string
  let registry: PluginRegistry

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'aibase-plugin-test-'))
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

    const pluginServiceMock = {
      environmentOrNull: () => null,
    }
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: DB, useValue: db },
        PluginRegistry,
        PluginRepository,
        OpsLogService,
        AppRepository,
        AppService,
        {
          provide: DatasetService,
          useValue: { publishFromPlugin: () => false, refreshByKey: () => false, upsertSecretFromPlugin: () => undefined, deactivateSecretFromPlugin: () => undefined },
        },
        {
          provide: PluginService,
          useFactory: (cfg, reg, repo, ops) => new PluginService(cfg, reg, repo, ops, pluginServiceMock as never),
          inject: [CONFIG, PluginRegistry, PluginRepository, OpsLogService],
        },
      ],
    }).compile()
    service = moduleRef.get(PluginService)
    appService = moduleRef.get(AppService)
    registry = moduleRef.get(PluginRegistry)

    registry.register({ plugin: sharedPlugin, artifact: 'builtin', artifactHash: '', version: '', builtin: true })
    registry.register({ plugin: localPlugin, artifact: 'builtin', artifactHash: '', version: '', builtin: true })
    service.syncDefs()
  })

  afterAll(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('声明共享的插件可单向覆盖为独立（SHARED→LOCAL）', () => {
    const inst = service.enableInstance(1, 'test-shared', 'APP_LOCAL')
    expect(inst.dataScope).toBe('APP_LOCAL')
  })

  it('声明独立的插件禁止覆盖为共享（LOCAL→SHARED 拒绝）', () => {
    expect(() => service.enableInstance(1, 'test-local', 'GLOBAL_SHARED')).toThrow(/禁止覆盖为共享/)
  })

  it('停用保留数据，启用恢复', () => {
    const inst = service.enableInstance(1, 'test-local')
    const disabled = service.disableInstance(1, 'test-local')
    expect(disabled.enabled).toBe(false)
    const restored = service.enableInstance(1, 'test-local')
    expect(restored.enabled).toBe(true)
    expect(restored.id).toBe(inst.id)
  })

  it('重复注册拒绝（type 唯一）', () => {
    const ok = registry.register({ plugin: sharedPlugin, artifact: 'dup', artifactHash: '', version: '', builtin: false })
    expect(ok).toBe(false)
  })

  it('插件实例概览包含运行时加载状态', () => {
    const overview = service.instanceOverview(1)
    expect(overview.length).toBe(2)
    expect(overview.every((r) => r.runtimeLoaded)).toBe(true)
  })

  it('autoInstantiate 支持指定插件集合（创建应用勾选）', () => {
    service.autoInstantiate(99, ['test-local'])
    expect(service.repository.findInstance(99, 'test-local')).toBeDefined()
    expect(service.repository.findInstance(99, 'test-shared')).toBeUndefined()
  })

  it('autoInstantiate 不传集合则实例化全部（默认行为）', () => {
    service.autoInstantiate(98)
    expect(service.repository.findInstance(98, 'test-local')).toBeDefined()
    expect(service.repository.findInstance(98, 'test-shared')).toBeDefined()
  })
})
