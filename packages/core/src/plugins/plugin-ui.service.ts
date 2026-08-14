import { Inject, Injectable, Logger } from '@nestjs/common'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PluginRegistry } from './plugin.registry.js'
import { CONFIG, type AtlasConfig } from '../config.js'
import type { PluginUiManifest } from '@atlas/types'

/**
 * 插件 UI 资源服务：全部插件统一目录加载，ui/ 目录位于插件目录内（plugins/{type}/ui/）。
 * 统一约定 ui/ 目录含 manifest.json + entry.{hash}.js + assets。
 */
@Injectable()
export class PluginUiService {
  private readonly logger = new Logger(PluginUiService.name)

  constructor(
    @Inject(CONFIG) private readonly config: AtlasConfig,
    @Inject(PluginRegistry) private readonly registry: PluginRegistry,
  ) {}

  /** 全量 UI 清单（无 UI 的插件不出现）。 */
  allManifests(): PluginUiManifest[] {
    const result: PluginUiManifest[] = []
    for (const loaded of this.registry.all()) {
      const manifest = this.manifestOf(loaded.plugin.type)
      if (manifest) result.push(manifest)
    }
    return result
  }

  manifestOf(pluginType: string): PluginUiManifest | null {
    const raw = this.readUiFile(pluginType, 'manifest.json')
    if (!raw) return null
    try {
      const manifest = JSON.parse(raw) as PluginUiManifest
      if (manifest.pluginType !== pluginType) return null
      if (!Array.isArray(manifest.slots)) return null
      return manifest
    } catch (e) {
      this.logger.warn(`插件 ${pluginType} 的 manifest.json 解析失败，按无 UI 处理`)
      return null
    }
  }

  /** 读取 UI 资源；不存在返回 null。防穿越：仅允许相对扁平路径。 */
  readUiFile(pluginType: string, path: string): string | null {
    if (!isSafePath(path)) return null
    const uiDir = this.uiDirOf(pluginType)
    if (!uiDir) return null
    const file = resolve(uiDir, path)
    if (!file.startsWith(resolve(uiDir)) || !existsSync(file)) return null
    try {
      return readFileSync(file, 'utf8')
    } catch {
      return null
    }
  }

  /** 读取插件图标（icons/ 目录，独立于 ui 构建产物）。 */
  readIconFile(pluginType: string, path: string): string | null {
    if (!isSafePath(path)) return null
    const loaded = this.registry.byType(pluginType)
    if (!loaded) return null
    const iconsDir = join(this.config.pluginsDir, loaded.artifact, 'icons')
    if (!existsSync(iconsDir)) return null
    const file = resolve(iconsDir, path)
    if (!file.startsWith(resolve(iconsDir)) || !existsSync(file)) return null
    try {
      return readFileSync(file, 'utf8')
    } catch {
      return null
    }
  }

  private uiDirOf(pluginType: string): string | null {
    const loaded = this.registry.byType(pluginType)
    if (!loaded) return null
    const dir = join(this.config.pluginsDir, loaded.artifact, 'ui')
    return existsSync(dir) ? dir : null
  }
}

/** 防穿越：仅允许相对扁平路径。 */
export function isSafePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('..')) return false
  const normalized = resolve(path)
  return !normalized.startsWith('..')
}
