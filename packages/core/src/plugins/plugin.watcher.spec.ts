import { describe, expect, it, jest, afterEach } from '@jest/globals'
import { PluginWatcher } from './plugin.watcher.js'
import type { PluginLoader } from './plugin.loader.js'
import type { AtlasConfig } from '../config.js'

function makeConfig(intervalMs = 10000): AtlasConfig {
  return {
    dataDir: '/tmp/x', dbPath: '/tmp/x/d', encKey: '', adminPassword: '', adminKey: '',
    authEnabled: false, pluginScanIntervalMs: intervalMs, datasetRefreshIntervalMs: 60000,
    pluginsDir: '/tmp/x/plugins', port: 0, trustProxy: false, devResetDb: false,
    corsOrigin: '*', keepLogDays: 30,
  }
}

describe('PluginWatcher（插件目录热扫描）', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('启动：known 以 externalHashes 初始化，周期调用 scanExternal（新增/更新/删除交给 loader 三态逻辑）', () => {
    jest.useFakeTimers()
    const scan = jest.fn().mockResolvedValue(new Map<string, string>())
    const loader = {
      externalHashes: () => new Map<string, string>([['p1', 'h1'], ['p2', 'h2']]),
      scanExternal: scan,
    } as unknown as PluginLoader
    const watcher = new PluginWatcher(makeConfig(5000), loader)
    watcher.onApplicationBootstrap()

    // 首轮定时未触发时 known 已初始化
    expect(scan).not.toHaveBeenCalled()
    jest.advanceTimersByTime(5000)
    expect(scan).toHaveBeenCalledTimes(1)
    expect(scan.mock.calls[0][0]).toEqual(new Map([['p1', 'h1'], ['p2', 'h2']]))
    jest.advanceTimersByTime(5000)
    expect(scan).toHaveBeenCalledTimes(2)
    watcher.onModuleDestroy()
  })

  it('扫描异常被捕获（不中断定时器）', async () => {
    jest.useFakeTimers()
    const scan = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(new Map())
    const loader = { externalHashes: () => new Map(), scanExternal: scan } as unknown as PluginLoader
    const watcher = new PluginWatcher(makeConfig(1000), loader)
    watcher.onApplicationBootstrap()
    jest.advanceTimersByTime(1000)
    await Promise.resolve() // 让 rejection 分支执行
    jest.advanceTimersByTime(1000)
    expect(scan).toHaveBeenCalledTimes(2)
    watcher.onModuleDestroy()
  })

  it('resyncKnown：手动 reload 后重置基线，下次扫描从新 hash 起步', () => {
    jest.useFakeTimers()
    const scan = jest.fn().mockResolvedValue(new Map())
    let hashes = new Map<string, string>([['p1', 'h-old']])
    const loader = {
      externalHashes: () => hashes,
      scanExternal: scan,
    } as unknown as PluginLoader
    const watcher = new PluginWatcher(makeConfig(1000), loader)
    watcher.onApplicationBootstrap()

    hashes = new Map<string, string>([['p1', 'h-new']])
    watcher.resyncKnown()
    jest.advanceTimersByTime(1000)
    expect(scan.mock.calls[0][0]).toEqual(new Map([['p1', 'h-new']]))
    watcher.onModuleDestroy()
  })

  it('onModuleDestroy：清除定时器，不再扫描', () => {
    jest.useFakeTimers()
    const scan = jest.fn().mockResolvedValue(new Map())
    const loader = { externalHashes: () => new Map(), scanExternal: scan } as unknown as PluginLoader
    const watcher = new PluginWatcher(makeConfig(1000), loader)
    watcher.onApplicationBootstrap()
    watcher.onModuleDestroy()
    jest.advanceTimersByTime(10000)
    expect(scan).not.toHaveBeenCalled()
  })
})
