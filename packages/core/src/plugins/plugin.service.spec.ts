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
import { PluginRegistry } from './plugin.registry.js'
import { PluginRepository } from './plugin.repository.js'
import { OpsLogService } from './ops-log.service.js'
import { PluginService } from './plugin.service.js'
import { AppRepository } from '../apps/app.repository.js'
import { AppService } from '../apps/app.service.js'
import { EnvelopeCrypto } from '../datasets/envelope-crypto.js'
import { DatasetRepository } from '../datasets/dataset.repository.js'
import { DatasetService } from '../datasets/dataset.service.js'
import { PlatformEventEmitter } from '../spi/platform-event-emitter.js'
import { ExtensionRegistry } from '../spi/extension.registry.js'
import { PluginSpiRegistry } from '../spi/plugin-spi.registry.js'
import type { AtlasPlugin } from '@atlas/types'

/** 测试插件桩。 */
const sharedPlugin: AtlasPlugin = {
  type: 'test-shared',
  name: '测试共享',
  describe: 'scope 测试：声明共享',
  defaultDataScope: 'GLOBAL_SHARED',
  scopeOverrideAllowed: true,
}

const localPlugin: AtlasPlugin = {
  type: 'test-local',
  name: '测试独立',
  describe: 'scope 测试：声明独立',
  defaultDataScope: 'APP_LOCAL',
}

const localPlugin2: AtlasPlugin = {
  type: 'test-local2',
  name: '测试独立2',
  describe: 'store 分区测试：同 app 第二个独立插件',
  defaultDataScope: 'APP_LOCAL',
}

/** 双向 SPI 测试：网关提供方（GLOBAL_SHARED，暴露 gw 命名空间）。 */
const gatewayPlugin: AtlasPlugin = {
  type: 'test-gateway',
  name: '测试网关',
  describe: 'SPI 提供方',
  defaultDataScope: 'GLOBAL_SHARED',
  provides: () => ({
    gw: { describe: 'gw', create: () => ({ ping: () => 'pong' }) },
  }),
}

/** 双向 SPI 测试：消费方（依赖 test-gateway）。 */
const consumerPlugin: AtlasPlugin = {
  type: 'test-consumer',
  name: '测试消费方',
  describe: 'SPI 消费方',
  defaultDataScope: 'APP_LOCAL',
  dependsOn: () => [{ pluginType: 'test-gateway' }],
}

describe('PluginService', () => {
  let db: BetterSqlite3NS.Database
  let service: PluginService
  let appService: AppService
  let dir: string
  let registry: PluginRegistry

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'atlas-plugin-test-'))
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
    const fileRegistryMock = { publish: () => ({ token: '', relPath: '' }), unpublish: () => undefined }
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: DB, useValue: db },
        PluginRegistry,
        PluginRepository,
        OpsLogService,
        PlatformEventEmitter,
        ExtensionRegistry,
        PluginSpiRegistry,
        AppRepository,
        AppService,
        {
          provide: DatasetService,
          useValue: { publishFromPlugin: () => false, refreshByKey: () => false, upsertSecretFromPlugin: () => undefined, deactivateSecretFromPlugin: () => undefined },
        },
        {
          provide: PluginService,
          useFactory: (cfg, reg, repo, ops, eventBus, spiReg) =>
            new PluginService(
              cfg, reg, repo, ops, pluginServiceMock as never, fileRegistryMock as never, eventBus,
              undefined as never, undefined as never, undefined as never, undefined as never, spiReg,
            ),
          inject: [CONFIG, PluginRegistry, PluginRepository, OpsLogService, PlatformEventEmitter, PluginSpiRegistry],
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

  it('plugin_store 按插件类型分区：同应用同 key 不碰撞，删除一实例不清另一实例数据', async () => {
    registry.register({ plugin: localPlugin2, artifact: 'builtin', artifactHash: '', version: '', builtin: true })
    service.syncDefs()
    service.autoInstantiate(97, ['test-local', 'test-local2'])
    expect(service.repository.findInstance(97, 'test-local')).toBeDefined()
    expect(service.repository.findInstance(97, 'test-local2')).toBeDefined()

    const envA = service.environment(97, 'test-local')
    const envB = service.environment(97, 'test-local2')
    await envA.store().put('colliding-key', { owner: 'A' })
    await envB.store().put('colliding-key', { owner: 'B' })

    // 同 app 两个独立插件用同一 entityKey 不互相覆盖
    expect(await envA.store().get('colliding-key')).toEqual({ owner: 'A' })
    expect(await envB.store().get('colliding-key')).toEqual({ owner: 'B' })

    // 删除 test-local 实例：仅清其自身 store，兄弟插件 test-local2 数据保留
    service.deleteInstance(97, 'test-local')
    expect(await envB.store().get('colliding-key')).toEqual({ owner: 'B' })
    expect(service.repository.findInstance(97, 'test-local')).toBeUndefined()
    expect(service.repository.findInstance(97, 'test-local2')).toBeDefined()
  })

  it('plugin_store 共享与独立作用域隔离', async () => {
    const envLocal = service.environment(97, 'test-local2')
    const envShared = service.environment(1, 'test-shared')
    await envLocal.store().put('scope-key', { s: 'local' })
    await envShared.store().put('scope-key', { s: 'shared' })
    expect(await envLocal.store().get('scope-key')).toEqual({ s: 'local' })
    expect(await envShared.store().get('scope-key')).toEqual({ s: 'shared' })
  })

  it('env.events() 订阅/退订平台生命周期事件（返回退订函数）', async () => {
    const received: Array<{ pluginType: string }> = []
    service.autoInstantiate(95, ['test-local'])
    const env = service.environment(95, 'test-local')
    const unsub = env.events().on('plugin.enabled', (p) => received.push(p))

    service.autoInstantiate(96, ['test-local']) // 触发 plugin.enabled
    expect(received.length).toBeGreaterThan(0)
    const before = received.length

    unsub() // 手动退订后不再收到
    service.enableInstance(96, 'test-local')
    expect(received.length).toBe(before)
  })

  it('env.events() 订阅随实例销毁自动退订（init env 由平台追踪）', async () => {
    const received: string[] = []
    const subPlugin: AtlasPlugin = {
      type: 'test-events',
      name: '事件测试',
      describe: '订阅事件并记录',
      defaultDataScope: 'GLOBAL_SHARED',
      init(env) {
        env.events().on('plugin.enabled', () => received.push('x'))
      },
    }
    registry.register({ plugin: subPlugin, artifact: 'builtin', artifactHash: '', version: '', builtin: true })
    service.enableInstance(96, 'test-events') // init 订阅（env 由平台 activeEnvs 追踪）
    await new Promise((r) => setTimeout(r, 20))
    service.enableInstance(95, 'test-local') // 触发事件
    await new Promise((r) => setTimeout(r, 5))
    expect(received.length).toBeGreaterThan(0)
    const before = received.length

    service.deleteInstance(96, 'test-events') // dispose → 自动退订
    service.enableInstance(95, 'test-local') // 再触发，不应新增
    await new Promise((r) => setTimeout(r, 5))
    expect(received.length).toBe(before)
  })

  it('env.spi() 解析其他插件暴露的能力（双向 SPI）', () => {
    registry.register({ plugin: gatewayPlugin, artifact: 'builtin', artifactHash: '', version: '', builtin: true })
    registry.register({ plugin: consumerPlugin, artifact: 'builtin', artifactHash: '', version: '', builtin: true })
    service.syncDefs()
    service.autoInstantiate(80, ['test-consumer', 'test-gateway'])

    const env = service.environment(80, 'test-consumer')
    const gw = env.spi<{ ping: () => string }>('test-gateway', 'gw')
    expect(gw).not.toBeNull()
    expect(gw!.ping()).toBe('pong')

    // 未暴露的命名空间 -> null
    expect(env.spi('test-gateway', 'nope')).toBeNull()
  })

  it('env.spi() 在提供方删除后返回 null', () => {
    service.deleteInstance(80, 'test-gateway')
    const env = service.environment(80, 'test-consumer')
    expect(env.spi('test-gateway', 'gw')).toBeNull()
  })

  it('autoInstantiate 按 dependsOn 拓扑排序（被依赖方先启用）', () => {
    const order: string[] = []
    const eventBus = (service as unknown as { eventBus: { on: (n: string, h: (p: { pluginType: string }) => void) => () => void } }).eventBus
    const off = eventBus.on('plugin.enabled', (p) => order.push(p.pluginType))
    service.autoInstantiate(81, ['test-consumer', 'test-gateway'])
    off()
    const gwIdx = order.indexOf('test-gateway')
    const consumerIdx = order.indexOf('test-consumer')
    expect(gwIdx).toBeGreaterThanOrEqual(0)
    expect(consumerIdx).toBeGreaterThan(gwIdx) // 网关先于消费方
  })

  it('dependsOn 带 spi 字段：提供方未暴露该能力时 warn（不抛错，不影响排序）（P0-2 回归）', () => {
    const staleDepsPlugin: AtlasPlugin = {
      type: 'test-stale-deps',
      name: '依赖缺口',
      describe: 'spi 契约缺口回归',
      defaultDataScope: 'APP_LOCAL',
      dependsOn: () => [
        { pluginType: 'test-gateway', spi: 'missing-ns' }, // 已加载但未暴露该命名空间
        { pluginType: 'not-loaded', spi: 'anything' }, // 提供方未加载
      ],
    }
    registry.register({ plugin: staleDepsPlugin, artifact: 'builtin', artifactHash: '', version: '', builtin: true })
    service.syncDefs()

    const logger = (service as unknown as { logger: { warn: (m: string) => void } }).logger
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const order: string[] = []
    const eventBus = (service as unknown as { eventBus: { on: (n: string, h: (p: { pluginType: string }) => void) => () => void } }).eventBus
    const off = eventBus.on('plugin.enabled', (p) => order.push(p.pluginType))

    expect(() => service.autoInstantiate(83, ['test-stale-deps', 'test-gateway'])).not.toThrow()
    off()

    const warned = warnSpy.mock.calls.map((c) => String(c[0]))
    expect(warned.some((m) => m.includes('missing-ns'))).toBe(true)
    expect(warned.some((m) => m.includes('not-loaded'))).toBe(true)
    warnSpy.mockRestore()

    // 校验只 warn，不抛错、不影响插件级排序与启用
    const gwIdx = order.indexOf('test-gateway')
    const staleIdx = order.indexOf('test-stale-deps')
    expect(gwIdx).toBeGreaterThanOrEqual(0)
    expect(staleIdx).toBeGreaterThan(gwIdx) // 网关先于依赖缺口插件
    expect(service.repository.findInstance(83, 'test-gateway')).toBeDefined()
    expect(service.repository.findInstance(83, 'test-stale-deps')).toBeDefined()
  })

  it('dependsOn 环检测：环形依赖拒绝启用', () => {
    const cycA: AtlasPlugin = {
      type: 'test-cyc-a', name: '环A', describe: '', defaultDataScope: 'APP_LOCAL',
      dependsOn: () => [{ pluginType: 'test-cyc-b' }],
    }
    const cycB: AtlasPlugin = {
      type: 'test-cyc-b', name: '环B', describe: '', defaultDataScope: 'APP_LOCAL',
      dependsOn: () => [{ pluginType: 'test-cyc-a' }],
    }
    registry.register({ plugin: cycA, artifact: 'builtin', artifactHash: '', version: '', builtin: true })
    registry.register({ plugin: cycB, artifact: 'builtin', artifactHash: '', version: '', builtin: true })
    service.syncDefs()
    service.autoInstantiate(82, ['test-cyc-a', 'test-cyc-b'])
    // 环成员未被启用
    expect(service.repository.findInstance(82, 'test-cyc-a')).toBeUndefined()
    expect(service.repository.findInstance(82, 'test-cyc-b')).toBeUndefined()
  })
})
