import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AibasePlugin } from '@atlas/types'
import { PluginRegistry } from './plugin.registry.js'
import { PluginService } from './plugin.service.js'
import { CONFIG, type AIBaseConfig } from '../config.js'
import type { LoadedPlugin, PluginManifest } from './types.js'
import { createHash } from 'node:crypto'

/** 插件目录 manifest 文件名。 */
export const PLUGIN_MANIFEST = 'manifest.json'

/**
 * 插件加载器：
 * - 内置插件：core 直接 import（编译期类型检查），artifact='builtin'
 * - 外部插件：data/plugins/<type>/ 目录（manifest.json + index.ts|js|mjs），动态 import
 */
@Injectable()
export class PluginLoader implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginLoader.name)

  constructor(
    @Inject(CONFIG) private readonly config: AIBaseConfig,
    private readonly registry: PluginRegistry,
    private readonly service: PluginService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // 目录插件启动加载（无内置插件：全部插件统一走目录加载管线）
    await this.loadExternal()
    this.service.syncDefs()
    this.logger.log(`插件加载完成：${this.registry.types().length} 个`)
  }

  /** 扫描 data/plugins/ 全部目录插件（新增/更新/删除三态）。 */
  async scanExternal(known: Map<string, string>): Promise<Map<string, string>> {
    const dir = this.config.pluginsDir
    if (!existsSync(dir)) return known
    const current = new Map<string, string>()
    for (const name of readdirSync(dir)) {
      if (name === 'template') continue
      const pluginDir = join(dir, name)
      if (!statSync(pluginDir).isDirectory()) continue
      const manifestPath = join(pluginDir, PLUGIN_MANIFEST)
      if (!existsSync(manifestPath)) continue
      current.set(name, dirHash(pluginDir))
    }
    // 新增/更新
    for (const [name, hash] of current) {
      const knownHash = known.get(name)
      if (knownHash === undefined) {
        const loaded = await this.loadExternalDir(join(dir, name), name, hash)
        if (loaded) known.set(name, hash)
      } else if (knownHash !== hash) {
        this.logger.log(`插件目录已更新，热替换: ${name}`)
        for (const type of this.typesOfArtifact(name)) {
          this.registry.unregister(type)
        }
        const loaded = await this.loadExternalDir(join(dir, name), name, hash)
        if (loaded) known.set(name, hash)
        else known.delete(name)
      }
    }
    // 删除
    for (const name of [...known.keys()]) {
      if (!current.has(name)) {
        this.logger.log(`插件目录已删除，热卸载: ${name}`)
        for (const type of this.typesOfArtifact(name)) {
          this.registry.unregister(type)
          const def = this.service.defOf(type)
          if (def) this.service['repository'].markLoaded(type, false)
        }
        known.delete(name)
      }
    }
    return known
  }

  private typesOfArtifact(artifact: string): string[] {
    return this.registry
      .all()
      .filter((l) => l.artifact === artifact)
      .map((l) => l.plugin.type)
  }

  private async loadExternal(): Promise<void> {
    const dir = this.config.pluginsDir
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir)) {
      if (name === 'template') continue
      const pluginDir = join(dir, name)
      if (!statSync(pluginDir).isDirectory()) continue
      const manifestPath = join(pluginDir, PLUGIN_MANIFEST)
      if (!existsSync(manifestPath)) continue
      await this.loadExternalDir(pluginDir, name, dirHash(pluginDir))
    }
  }

  /** 当前外部插件目录清单（watcher 初始化 known 用，避免与启动加载重复）。 */
  externalHashes(): Map<string, string> {
    const dir = this.config.pluginsDir
    const result = new Map<string, string>()
    if (!existsSync(dir)) return result
    for (const name of readdirSync(dir)) {
      if (name === 'template') continue
      const pluginDir = join(dir, name)
      if (!statSync(pluginDir).isDirectory()) continue
      if (!existsSync(join(pluginDir, PLUGIN_MANIFEST))) continue
      result.set(name, dirHash(pluginDir))
    }
    return result
  }

  /** 手动全量重载（POST /api/plugins/reload）：卸载全部外部插件 → 重新加载 → 同步注册表。 */
  async reloadAll(): Promise<void> {
    for (const type of this.registry.types()) {
      const loaded = this.registry.byType(type)
      if (loaded && !loaded.builtin) this.registry.unregister(type)
    }
    await this.loadExternal()
    this.service.syncDefs()
    this.logger.log(`插件全量重载完成：${this.registry.types().length} 个`)
  }

  /** 加载单个外部插件目录：读 manifest → 动态 import entry → 注册。 */
  async loadExternalDir(pluginDir: string, artifact: string, hash: string): Promise<LoadedPlugin | null> {
    try {
      const manifest = JSON.parse(readFileSync(join(pluginDir, PLUGIN_MANIFEST), 'utf8')) as PluginManifest
      if (!manifest.pluginType || !manifest.entry) {
        this.logger.warn(`插件目录缺 manifest 字段，跳过: ${artifact}`)
        return null
      }
      const entryFile = resolve(pluginDir, manifest.entry)
      if (!existsSync(entryFile)) {
        this.logger.warn(`插件入口不存在，跳过: ${artifact}/${manifest.entry}`)
        return null
      }
      // cache-busting：URL 带目录 hash query —— Node import 缓存按 URL 键，热替换后强制加载新模块
      const entryUrl = `${pathToFileURL(entryFile).href}?v=${hash}`
      const mod = (await import(/* @vite-ignore */ entryUrl)) as {
        default?: AibasePlugin
      }
      const plugin = mod.default
      if (!plugin?.type) {
        this.logger.warn(`插件入口未导出 AibasePlugin，跳过: ${artifact}`)
        return null
      }
      if (plugin.type !== manifest.pluginType) {
        this.logger.warn(`插件 type 与 manifest 不一致，跳过: ${artifact}`)
        return null
      }
      const loaded: LoadedPlugin = {
        plugin,
        artifact,
        artifactHash: hash,
        version: manifest.version ?? '0.0.0',
        icon: manifest.icon ?? '',
        builtin: false,
        module: mod,
      }
      if (this.registry.register(loaded)) {
        this.service.recordExternal(loaded)
        return loaded
      }
      return null
    } catch (e) {
      this.logger.error(`插件加载失败（隔离，不影响平台）: ${artifact}，${(e as Error).message}`)
      return null
    }
  }
}

function hashOf(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16)
}

/** 插件目录内容哈希：manifest + 入口 + ui 目录（任何文件变化触发热替换）。
 *  递归排除 node_modules（依赖目录，避免全量哈希拖慢扫描）。 */
function dirHash(pluginDir: string): string {
  const hash = createHash('sha256')
  const walk = (dir: string, prefix: string): void => {
    for (const name of readdirSync(dir).sort()) {
      if (name === 'node_modules') continue
      const full = join(dir, name)
      const rel = prefix ? `${prefix}/${name}` : name
      if (statSync(full).isDirectory()) {
        walk(full, rel)
      } else if (!name.endsWith('.map')) {
        hash.update(rel)
        hash.update(readFileSync(full))
      }
    }
  }
  walk(pluginDir, '')
  return hash.digest('hex').slice(0, 16)
}

/**
 * 内置插件清单（workspace 包）：core 静态依赖，启动注册。
 * P4 填充业务实现；当前为骨架（类型保留字 + 数据范围声明）。
 */
