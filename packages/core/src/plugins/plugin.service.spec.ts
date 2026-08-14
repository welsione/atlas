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
  let spiRegistry: PluginSpiRegistry

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
    const epTokensMock = {
      sync: () => undefined, removeByPlugin: () => undefined, matchToken: () => false,
      findByToken: () => undefined, listByApp: () => [],
    }
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
              cfg, reg, repo, ops, pluginServiceMock as never, fileRegistryMock as never, epTokensMock,
              eventBus,
              undefined as never, undefined as never, undefined as never, undefined as never, spiReg,
            ),
          inject: [CONFIG, PluginRegistry, PluginRepository, OpsLogService, PlatformEventEmitter, PluginSpiRegistry],
        },
      ],
    }).compile()
    service = moduleRef.get(PluginService)
    appService = moduleRef.get(AppService)
    registry = moduleRef.get(PluginRegistry)
    spiRegistry = moduleRef.get(PluginSpiRegistry)

    registry.register({ plugin: sharedPlugin, artifact: 'dir', artifactHash: '', version: '', })
    registry.register({ plugin: localPlugin, artifact: 'dir', artifactHash: '', version: '', })
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
    const ok = registry.register({ plugin: sharedPlugin, artifact: 'dup', artifactHash: '', version: '', })
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
    registry.register({ plugin: localPlugin2, artifact: 'dir', artifactHash: '', version: '', })
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

  it('plugin_store 乐观锁：版本匹配写入成功，冲突拒绝写入（L3）', async () => {
    const env = service.environment(97, 'test-local2')
    const store = env.store()
    // 初始：记录不存在 → version 0
    expect(await store.version('opt-key')).toBe(0)
    // 创建成功（expectedVersion=0 → 写入后 version=1）
    expect(await store.putIfVersion('opt-key', { v: 1 }, 0)).toBe(true)
    expect(await store.version('opt-key')).toBe(1)
    expect(await store.get('opt-key')).toEqual({ v: 1 })

    // 版本冲突：期望 0（已变成 1）→ 拒绝，值保持
    expect(await store.putIfVersion('opt-key', { v: 2 }, 0)).toBe(false)
    expect(await store.get('opt-key')).toEqual({ v: 1 })

    // 版本匹配（1）→ 写入成功，version 递增为 2
    expect(await store.putIfVersion('opt-key', { v: 3 }, 1)).toBe(true)
    expect(await store.version('opt-key')).toBe(2)
    expect(await store.get('opt-key')).toEqual({ v: 3 })

    // 普通 put 仍自动递增版本
    await store.put('opt-key', { v: 4 })
    expect(await store.version('opt-key')).toBe(3)
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
    registry.register({ plugin: subPlugin, artifact: 'dir', artifactHash: '', version: '', })
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
    registry.register({ plugin: gatewayPlugin, artifact: 'dir', artifactHash: '', version: '', })
    registry.register({ plugin: consumerPlugin, artifact: 'dir', artifactHash: '', version: '', })
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

  it('SPI resolve 本 app 本地覆盖优先于共享实例（M7 service 层回归）', () => {
    const p: AtlasPlugin = {
      type: 'test-m7',
      name: 'M7',
      describe: '验证本地优先解析',
      defaultDataScope: 'GLOBAL_SHARED',
      scopeOverrideAllowed: true,
      provides: () => ({
        ns: { describe: 'ns', create: (env) => ({ v: `app-${env.instance().appId}` }) },
      }),
    }
    registry.register({ plugin: p, artifact: 'dir', artifactHash: '', version: '', })
    service.syncDefs()
    service.enableInstance(70, 'test-m7', 'APP_LOCAL')      // 本 app 本地覆盖
    service.enableInstance(71, 'test-m7', 'GLOBAL_SHARED')  // 其他 app 共享实例

    // 本 app（70）命中本地覆盖；其他 app（71）无本地实例，回落共享
    const env70 = service.environment(70, 'test-m7')
    const env71 = service.environment(71, 'test-m7')
    expect(env70.spi<{ v: string }>('test-m7', 'ns')?.v).toBe('app-70')
    expect(env71.spi<{ v: string }>('test-m7', 'ns')?.v).toBe('app-71')

    // 删除本地覆盖后，本 app 回落共享实例
    service.deleteInstance(70, 'test-m7')
    expect(env70.spi<{ v: string }>('test-m7', 'ns')?.v).toBe('app-71')
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
    registry.register({ plugin: staleDepsPlugin, artifact: 'dir', artifactHash: '', version: '', })
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
    registry.register({ plugin: cycA, artifact: 'dir', artifactHash: '', version: '', })
    registry.register({ plugin: cycB, artifact: 'dir', artifactHash: '', version: '', })
    service.syncDefs()
    service.autoInstantiate(82, ['test-cyc-a', 'test-cyc-b'])
    // 环成员未被启用
    expect(service.repository.findInstance(82, 'test-cyc-a')).toBeUndefined()
    expect(service.repository.findInstance(82, 'test-cyc-b')).toBeUndefined()
  })

  it('dependsOn 多环：两个独立环全部报告并全部拒绝（P2-4 回归）', () => {
    const cycA: AtlasPlugin = {
      type: 'test-cyc2-a', name: '环2A', describe: '', defaultDataScope: 'APP_LOCAL',
      dependsOn: () => [{ pluginType: 'test-cyc2-b' }],
    }
    const cycB: AtlasPlugin = {
      type: 'test-cyc2-b', name: '环2B', describe: '', defaultDataScope: 'APP_LOCAL',
      dependsOn: () => [{ pluginType: 'test-cyc2-a' }],
    }
    const cycC: AtlasPlugin = {
      type: 'test-cyc2-c', name: '环2C', describe: '', defaultDataScope: 'APP_LOCAL',
      dependsOn: () => [{ pluginType: 'test-cyc2-d' }],
    }
    const cycD: AtlasPlugin = {
      type: 'test-cyc2-d', name: '环2D', describe: '', defaultDataScope: 'APP_LOCAL',
      dependsOn: () => [{ pluginType: 'test-cyc2-c' }],
    }
    registry.register({ plugin: cycA, artifact: 'dir', artifactHash: '', version: '', })
    registry.register({ plugin: cycB, artifact: 'dir', artifactHash: '', version: '', })
    registry.register({ plugin: cycC, artifact: 'dir', artifactHash: '', version: '', })
    registry.register({ plugin: cycD, artifact: 'dir', artifactHash: '', version: '', })
    service.syncDefs()

    const logger = (service as unknown as { logger: { error: (m: string) => void } }).logger
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {})
    service.autoInstantiate(84, ['test-cyc2-a', 'test-cyc2-b', 'test-cyc2-c', 'test-cyc2-d'])
    errorSpy.mockRestore()

    // 两个独立环成员均未被启用
    expect(service.repository.findInstance(84, 'test-cyc2-a')).toBeUndefined()
    expect(service.repository.findInstance(84, 'test-cyc2-b')).toBeUndefined()
    expect(service.repository.findInstance(84, 'test-cyc2-c')).toBeUndefined()
    expect(service.repository.findInstance(84, 'test-cyc2-d')).toBeUndefined()
  })

  it('删除单个实例不触发插件级 destroy（H1 回归）', () => {
    let destroyCalls = 0
    const sharedWithDestroy: AtlasPlugin = {
      type: 'test-destroy',
      name: '销毁隔离',
      describe: '验证删除单实例不销毁插件',
      defaultDataScope: 'GLOBAL_SHARED',
      destroy: () => { destroyCalls += 1 },
    }
    registry.register({ plugin: sharedWithDestroy, artifact: 'dir', artifactHash: '', version: '', })
    service.syncDefs()
    service.enableInstance(90, 'test-destroy')
    service.enableInstance(91, 'test-destroy')
    service.deleteInstance(90, 'test-destroy')
    // 删除单个实例不应调用插件级 destroy；另一应用实例仍可用
    expect(destroyCalls).toBe(0)
    expect(service.repository.findInstance(91, 'test-destroy')).toBeDefined()
  })

  it('autoInstantiate 跳过未加载插件，不抛错（H2 回归）', () => {
    const extPlugin: AtlasPlugin = {
      type: 'test-unloaded-ext',
      name: '已卸载外部插件',
      describe: '验证卸载后新建应用不被中断',
      defaultDataScope: 'APP_LOCAL',
    }
    registry.register({ plugin: extPlugin, artifact: 'external', artifactHash: '', version: '', })
    service.syncDefs()
    service.unload('test-unloaded-ext') // 卸载 → loaded=false，def 保留

    expect(() => service.autoInstantiate(89)).not.toThrow()
    expect(service.repository.findInstance(89, 'test-unloaded-ext')).toBeUndefined()
  })

  it('实例 scope 从共享改为独立时注销旧作用域 SPI（H4 回归）', () => {
    const gw: AtlasPlugin = {
      type: 'test-scope-switch',
      name: '作用域切换',
      describe: '验证 scope 变更注销旧 SPI',
      defaultDataScope: 'GLOBAL_SHARED',
      scopeOverrideAllowed: true,
      provides: () => ({ ns: { describe: 'ns', create: () => ({ ping: () => 'pong' }) } }),
    }
    registry.register({ plugin: gw, artifact: 'dir', artifactHash: '', version: '', })
    service.syncDefs()
    service.enableInstance(92, 'test-scope-switch', 'GLOBAL_SHARED')
    expect(spiRegistry.resolve('test-scope-switch', 'ns', 93)).not.toBeNull() // 其他 app 可解析（共享）

    service.enableInstance(92, 'test-scope-switch', 'APP_LOCAL') // scope 变更 → 注销 @0，注册 @92
    // 变更后其他 app 不再能解析（旧 @0 已注销），仅 app 92 可解析
    expect(spiRegistry.resolve('test-scope-switch', 'ns', 93)).toBeNull()
    expect(spiRegistry.resolve('test-scope-switch', 'ns', 92)).not.toBeNull()
  })

  it('热重载：卸载 dispose 实例 env，重载后对已启用实例 re-init（H3 回归）', async () => {
    let initCalls = 0
    let eventHits = 0
    const hotPlugin: AtlasPlugin = {
      type: 'test-hot',
      name: '热重载测试',
      describe: '验证卸载 dispose + 重载 re-init',
      defaultDataScope: 'APP_LOCAL',
      init(env) {
        initCalls += 1
        env.events().on('plugin.enabled', () => { eventHits += 1 })
      },
    }
    registry.register({ plugin: hotPlugin, artifact: 'hot', artifactHash: 'v1', version: '', })
    service.syncDefs()
    service.onApplicationBootstrap() // 激活 plugin.unloaded/plugin.loaded 事件处理器

    service.enableInstance(85, 'test-hot') // init 调用 1 次 + 订阅 plugin.enabled
    await new Promise((r) => setTimeout(r, 20))
    expect(initCalls).toBe(1)

    // 订阅生效：触发一次 plugin.enabled → 命中 +1
    let before = eventHits
    service.enableInstance(86, 'test-local')
    await new Promise((r) => setTimeout(r, 5))
    expect(eventHits - before).toBe(1)

    // 模拟热替换：卸载（dispose env）→ 重新注册（re-init）
    registry.unregister('test-hot')
    registry.register({ plugin: hotPlugin, artifact: 'hot', artifactHash: 'v2', version: '', })
    await new Promise((r) => setTimeout(r, 20))
    expect(initCalls).toBe(2) // 重载后对已启用实例 re-init

    // 旧 env 订阅已 dispose：再次触发只应命中 re-init 后的新订阅（+1，而非 +2 幽灵累积）
    before = eventHits
    service.enableInstance(87, 'test-local')
    await new Promise((r) => setTimeout(r, 5))
    expect(eventHits - before).toBe(1)
  })
})
