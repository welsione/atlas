import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import type { PluginEnvironment } from '@atlas/types'
import { PluginSpiRegistry } from './plugin-spi.registry.js'

describe('PluginSpiRegistry', () => {
  let registry: PluginSpiRegistry
  const makeEnv = (): PluginEnvironment =>
    ({ store: () => ({ get: async () => null, put: async () => undefined }) } as never) as PluginEnvironment

  beforeAll(() => {
    registry = new PluginSpiRegistry()
  })

  it('register/resolve：GLOBAL_SHARED 任意 app 可解析', () => {
    registry.register(
      'providers', 1, 'GLOBAL_SHARED',
      { 'model-gateway': { describe: 'gw', create: () => ({ chat: () => 'ok' }) } },
      makeEnv,
    )
    const obj = registry.resolve<{ chat: () => string }>('providers', 'model-gateway', 99)
    expect(obj?.chat()).toBe('ok')
  })

  it('resolve 缓存：同一 namespace 二次解析返回同一对象', () => {
    let calls = 0
    registry.register(
      'cache-test', 1, 'GLOBAL_SHARED',
      { ns: { describe: 'c', create: () => { calls += 1; return { n: calls } } } },
      makeEnv,
    )
    const a = registry.resolve<{ n: number }>('cache-test', 'ns', 1)
    const b = registry.resolve<{ n: number }>('cache-test', 'ns', 1)
    expect(a).toBe(b)
    expect(calls).toBe(1)
  })

  it('APP_LOCAL 仅同 app 可解析，跨 app 返回 null', () => {
    registry.register(
      'local-only', 7, 'APP_LOCAL',
      { ns: { describe: 'l', create: () => ({ x: 1 }) } },
      makeEnv,
    )
    expect(registry.resolve('local-only', 'ns', 7)).not.toBeNull()
    expect(registry.resolve('local-only', 'ns', 8)).toBeNull()
  })

  it('未注册 / namespace 不存在 -> null', () => {
    expect(registry.resolve('not-exist', 'ns', 1)).toBeNull()
    expect(registry.resolve('providers', 'wrong-ns', 1)).toBeNull()
  })

  it('buildEnv 返回 null（实例未启用）-> resolve null', () => {
    registry.register(
      'disabled', 1, 'GLOBAL_SHARED',
      { ns: { describe: 'd', create: () => ({}) } },
      () => null,
    )
    expect(registry.resolve('disabled', 'ns', 1)).toBeNull()
  })

  it('create 抛错 -> resolve null（隔离）', () => {
    registry.register(
      'broken', 1, 'GLOBAL_SHARED',
      { ns: { describe: 'b', create: () => { throw new Error('boom') } } },
      makeEnv,
    )
    expect(registry.resolve('broken', 'ns', 1)).toBeNull()
  })

  it('unregister(pluginType, appId, scope)：APP_LOCAL 精确注销', () => {
    registry.register('to-remove', 5, 'APP_LOCAL', { ns: { describe: 'r', create: () => ({}) } }, makeEnv)
    expect(registry.resolve('to-remove', 'ns', 5)).not.toBeNull()
    registry.unregister('to-remove', 5, 'APP_LOCAL')
    expect(registry.resolve('to-remove', 'ns', 5)).toBeNull()
  })

  it('GLOBAL_SHARED 引用计数：多应用启用，单应用注销不丢', () => {
    registry.register('shared-rc', 1, 'GLOBAL_SHARED', { ns: { describe: 's', create: () => ({}) } }, makeEnv)
    registry.register('shared-rc', 2, 'GLOBAL_SHARED', { ns: { describe: 's', create: () => ({}) } }, makeEnv) // refcount=2
    expect(registry.resolve('shared-rc', 'ns', 1)).not.toBeNull()
    registry.unregister('shared-rc', 1, 'GLOBAL_SHARED') // refcount=1，仍可用
    expect(registry.resolve('shared-rc', 'ns', 1)).not.toBeNull()
    registry.unregister('shared-rc', 2, 'GLOBAL_SHARED') // refcount=0，移除
    expect(registry.resolve('shared-rc', 'ns', 1)).toBeNull()
  })

  it('同 type 混合 scope：注销 APP_LOCAL 不误伤 GLOBAL_SHARED（P0-1 回归）', () => {
    // 共享实例暴露 shared，本地实例暴露 local：用不同 namespace 区分，避免共享兜底遮蔽本地实例的移除
    registry.register('mixed', 1, 'GLOBAL_SHARED', {
      shared: { describe: 'm', create: () => ({ v: 'shared' }) },
    }, makeEnv)
    registry.register('mixed', 2, 'APP_LOCAL', {
      local: { describe: 'm', create: () => ({ v: 'local' }) },
    }, makeEnv)
    // 注销 app2 的本地实例：只应移除 @app2，@0 共享引用不受影响
    registry.unregister('mixed', 2, 'APP_LOCAL')
    // @0 保留：共享实例仍启用，SPI 不丢（旧实现误减共享 refs 时此处为 null）
    expect(registry.resolve('mixed', 'shared', 1)).not.toBeNull()
    // @app2 已移除：本地实例的 namespace 不再可解析（旧实现从未处理 @app2，此处仍非 null）
    expect(registry.resolve('mixed', 'local', 2)).toBeNull()
  })

  it('unregister 后已缓存能力对象不残留：重新启用重新构建（P1）', () => {
    let builds = 0
    const factory = () => { builds += 1; return { n: builds } }
    registry.register('cache-purge', 1, 'GLOBAL_SHARED', { ns: { describe: 'c', create: factory } }, makeEnv)
    const first = registry.resolve<{ n: number }>('cache-purge', 'ns', 1) // 构建 #1 并缓存
    expect(first?.n).toBe(1)
    registry.unregister('cache-purge', 1, 'GLOBAL_SHARED') // refs=0 → 条目删除（含缓存）
    registry.register('cache-purge', 2, 'GLOBAL_SHARED', { ns: { describe: 'c', create: factory } }, makeEnv) // 重新启用
    const second = registry.resolve<{ n: number }>('cache-purge', 'ns', 2)
    expect(second?.n).toBe(2) // 重新 create，而非复用旧缓存对象
  })

  it('unregister(pluginType) 全部作用域清除', () => {
    registry.register('purge', 1, 'GLOBAL_SHARED', { ns: { describe: 'p', create: () => ({}) } }, makeEnv)
    registry.register('purge', 9, 'APP_LOCAL', { ns: { describe: 'p', create: () => ({}) } }, makeEnv)
    registry.unregister('purge')
    expect(registry.resolve('purge', 'ns', 1)).toBeNull()
    expect(registry.resolve('purge', 'ns', 9)).toBeNull()
  })

  it('namespacesOf 汇总某插件全部命名空间', () => {
    registry.register('multi-ns', 1, 'GLOBAL_SHARED', {
      a: { describe: 'a', create: () => ({}) },
      b: { describe: 'b', create: () => ({}) },
    }, makeEnv)
    expect(registry.namespacesOf('multi-ns').sort()).toEqual(['a', 'b'])
  })
})
