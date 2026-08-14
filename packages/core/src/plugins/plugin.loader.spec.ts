import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AtlasPlugin } from '@atlas/types'
import { PluginLoader } from './plugin.loader.js'
import type { PluginRegistry } from './plugin.registry.js'
import type { PluginService } from './plugin.service.js'
import type { LoadedPlugin, PluginManifest } from './types.js'
import type { AtlasConfig } from '../config.js'

/** 可注入入口模块的 loader 子类：动态 import 接缝替换为受控返回值。 */
class TestableLoader extends PluginLoader {
  entryModule: { default?: AtlasPlugin } | null = null
  importedUrls: string[] = []

  protected async importEntry(entryUrl: string): Promise<{ default?: AtlasPlugin }> {
    this.importedUrls.push(entryUrl)
    return this.entryModule ?? {}
  }
}

const demoPlugin: AtlasPlugin = {
  type: 'loader-demo',
  name: '加载器测试',
  describe: 'loader spec fixture',
  defaultDataScope: 'APP_LOCAL',
}

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    pluginType: 'loader-demo',
    name: '加载器测试',
    description: 'fixture',
    version: '1.0.0',
    defaultDataScope: 'APP_LOCAL',
    entry: 'src/index.ts',
    ...overrides,
  }
}

/** 创建插件目录 fixture（manifest + entry + 可选 schema.sql），返回目录路径。 */
function makePluginDir(base: string, name: string, manifest: PluginManifest | null, opts: { entry?: boolean; schemaSql?: string } = {}): string {
  const dir = join(base, name)
  mkdirSync(dir, { recursive: true })
  if (manifest) writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest))
  if (opts.entry !== false) {
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'index.ts'), 'export default { type: "x" }\n')
  }
  if (opts.schemaSql) writeFileSync(join(dir, 'schema.sql'), opts.schemaSql)
  return dir
}

describe('PluginLoader（目录插件加载器）', () => {
  let base: string
  let pluginsDir: string
  let loader: TestableLoader
  let registry: {
    register: jest.Mock
    unregister: jest.Mock
    all: jest.Mock
    types: jest.Mock
    byType: jest.Mock
  }
  let service: { recordExternal: jest.Mock; markDefUnloaded: jest.Mock }
  let config: AtlasConfig

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'atlas-loader-test-'))
    pluginsDir = join(base, 'plugins')
    config = {
      dataDir: base,
      dbPath: join(base, 'db.sqlite'),
      encKey: 'k',
      adminPassword: '',
      adminKey: '',
      authEnabled: false,
      pluginScanIntervalMs: 10000,
      datasetRefreshIntervalMs: 60000,
      pluginsDir,
      port: 0,
      trustProxy: false,
      devResetDb: false,
      corsOrigin: '*',
      keepLogDays: 30,
    }
    registry = {
      register: jest.fn(() => true),
      unregister: jest.fn(),
      all: jest.fn(() => []),
      types: jest.fn(() => []),
      byType: jest.fn(),
    }
    service = { recordExternal: jest.fn(), markDefUnloaded: jest.fn() }
    loader = new TestableLoader(config, registry as never, service as never, undefined as never)
  })

  afterEach(() => {
    // 每次用例独立临时目录，用例结束清理（jest 全局 afterEach 不在此文件，手动清理）
    rmSync(base, { recursive: true, force: true })
  })

  describe('loadExternalDir', () => {
    it('manifest 缺 pluginType/entry → 跳过返回 null', async () => {
      const dir = makePluginDir(pluginsDir, 'bad1', { name: 'x' } as PluginManifest)
      expect(await loader.loadExternalDir(dir, 'bad1', 'h1')).toBeNull()
      expect(registry.register).not.toHaveBeenCalled()
    })

    it('入口文件不存在 → 跳过返回 null', async () => {
      const dir = makePluginDir(pluginsDir, 'bad2', makeManifest(), { entry: false })
      expect(await loader.loadExternalDir(dir, 'bad2', 'h2')).toBeNull()
      expect(registry.register).not.toHaveBeenCalled()
    })

    it('入口未导出 default 插件 → 跳过返回 null', async () => {
      loader.entryModule = {}
      const dir = makePluginDir(pluginsDir, 'bad3', makeManifest())
      expect(await loader.loadExternalDir(dir, 'bad3', 'h3')).toBeNull()
    })

    it('插件 type 与 manifest.pluginType 不一致 → 跳过返回 null', async () => {
      loader.entryModule = { default: { ...demoPlugin, type: 'another-type' } }
      const dir = makePluginDir(pluginsDir, 'bad4', makeManifest())
      expect(await loader.loadExternalDir(dir, 'bad4', 'h4')).toBeNull()
      expect(registry.register).not.toHaveBeenCalled()
    })

    it('注册表拒绝重复注册 → 返回 null 且不 recordExternal', async () => {
      loader.entryModule = { default: demoPlugin }
      registry.register.mockReturnValue(false)
      const dir = makePluginDir(pluginsDir, 'dup', makeManifest())
      expect(await loader.loadExternalDir(dir, 'dup', 'h5')).toBeNull()
      expect(service.recordExternal).not.toHaveBeenCalled()
    })

    it('加载成功：cache-busting URL + 注册 + recordExternal + schemaSql', async () => {
      loader.entryModule = { default: demoPlugin }
      const dir = makePluginDir(pluginsDir, 'ok', makeManifest(), {
        schemaSql: 'CREATE TABLE IF NOT EXISTS t (id INTEGER);',
      })
      const loaded = await loader.loadExternalDir(dir, 'ok', 'hash123')
      expect(loaded).not.toBeNull()
      expect(loader.importedUrls[0]).toContain('?v=hash123')
      expect(registry.register).toHaveBeenCalledWith(
        expect.objectContaining({
          plugin: demoPlugin,
          artifact: 'ok',
          artifactHash: 'hash123',
          version: '1.0.0',
          schemaSql: 'CREATE TABLE IF NOT EXISTS t (id INTEGER);',
        }),
      )
      expect(service.recordExternal).toHaveBeenCalledWith(loaded)
    })

    it('manifest 解析失败（非法 JSON）→ 隔离返回 null 不抛出', async () => {
      const dir = join(pluginsDir, 'broken')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'manifest.json'), '{not-json')
      expect(await loader.loadExternalDir(dir, 'broken', 'h6')).toBeNull()
    })
  })

  describe('scanExternal（新增/更新/删除三态）', () => {
    it('新增：新目录出现 → 加载并记入 known', async () => {
      makePluginDir(pluginsDir, 'plug-a', makeManifest())
      loader.entryModule = { default: demoPlugin }
      const spy = jest.spyOn(loader, 'loadExternalDir')
      const known = new Map<string, string>()
      const next = await loader.scanExternal(known)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(next.has('plug-a')).toBe(true)
    })

    it('更新：hash 变化 → 卸载旧注册再热替换', async () => {
      const dir = makePluginDir(pluginsDir, 'plug-b', makeManifest())
      loader.entryModule = { default: demoPlugin }
      const known = new Map<string, string>([['plug-b', 'old-hash']])
      registry.all.mockReturnValue([{ plugin: demoPlugin, artifact: 'plug-b' } as LoadedPlugin])
      await loader.scanExternal(known)
      expect(registry.unregister).toHaveBeenCalledWith('loader-demo')
      expect(registry.register).toHaveBeenCalled()
      expect(known.get('plug-b')).not.toBe('old-hash')
    })

    it('更新失败：旧版已卸载 → known 移除 + markDefUnloaded（下次扫描重试）', async () => {
      const dir = makePluginDir(pluginsDir, 'plug-c', makeManifest())
      loader.entryModule = null // 导入失败（无 default）
      const known = new Map<string, string>([['plug-c', 'old-hash']])
      registry.all.mockReturnValue([{ plugin: demoPlugin, artifact: 'plug-c' } as LoadedPlugin])
      await loader.scanExternal(known)
      expect(registry.unregister).toHaveBeenCalledWith('loader-demo')
      expect(service.markDefUnloaded).toHaveBeenCalledWith('loader-demo')
      expect(known.has('plug-c')).toBe(false)
    })

    it('删除：目录消失 → 卸载 + markDefUnloaded + known 移除', async () => {
      mkdirSync(pluginsDir, { recursive: true }) // 目录存在才会进入扫描（不存在整体跳过）
      const known = new Map<string, string>([['ghost', 'h']])
      registry.all.mockReturnValue([{ plugin: demoPlugin, artifact: 'ghost' } as LoadedPlugin])
      const next = await loader.scanExternal(known)
      expect(registry.unregister).toHaveBeenCalledWith('loader-demo')
      expect(service.markDefUnloaded).toHaveBeenCalledWith('loader-demo')
      expect(next.has('ghost')).toBe(false)
    })

    it('pluginsDir 不存在 → 返回原 known（幂等）', async () => {
      const known = new Map<string, string>([['x', 'h']])
      rmSync(join(base, 'plugins'), { recursive: true, force: true })
      expect(await loader.scanExternal(known)).toBe(known)
    })
  })

  describe('externalHashes', () => {
    it('跳过 template 目录 / 非目录 / 缺 manifest 的目录', () => {
      makePluginDir(pluginsDir, 'template', makeManifest({ pluginType: 'tpl' }))
      makePluginDir(pluginsDir, 'valid', makeManifest())
      mkdirSync(join(pluginsDir, 'no-manifest'), { recursive: true })
      writeFileSync(join(pluginsDir, 'file.txt'), 'not a dir')
      const hashes = loader.externalHashes()
      expect(hashes.has('valid')).toBe(true)
      expect(hashes.has('template')).toBe(false)
      expect(hashes.has('no-manifest')).toBe(false)
    })
  })
})

describe('目录内容哈希驱动热替换', () => {
  it('入口内容变化 → dirHash 变化（触发更新分支）', async () => {
    const base = mkdtempSync(join(tmpdir(), 'atlas-loader-hash-'))
    try {
      const pluginsDir = join(base, 'plugins')
      const config: AtlasConfig = {
        dataDir: base, dbPath: join(base, 'd'), encKey: '', adminPassword: '', adminKey: '',
        authEnabled: false, pluginScanIntervalMs: 10000, datasetRefreshIntervalMs: 60000,
        pluginsDir, port: 0, trustProxy: false, devResetDb: false,
        corsOrigin: '*', keepLogDays: 30,
      }
      const registry = { register: jest.fn(() => true), unregister: jest.fn(), all: jest.fn(() => []), types: jest.fn(() => []), byType: jest.fn() }
      const service = { recordExternal: jest.fn(), markDefUnloaded: jest.fn() }
      const loader = new TestableLoader(config, registry as never, service as never, undefined as never)
      const dir = makePluginDir(pluginsDir, 'changing', makeManifest())
      const h1 = loader.externalHashes().get('changing')!
      // 修改入口内容 → 哈希变化
      writeFileSync(join(dir, 'src', 'index.ts'), 'export default { type: "x", extra: 1 }\n')
      const h2 = loader.externalHashes().get('changing')!
      expect(h1).toBeTruthy()
      expect(h2).not.toBe(h1)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  })
})
