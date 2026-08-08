import { createApp, computed } from 'vue'
import { reactive } from 'vue'
import type { Component } from 'vue'
import ElementPlus from 'element-plus'
import { get } from '../services/http'

/**
 * 插件 UI slot 注册表（平台核心静态注册 + 插件 jar 动态注册共用一套机制）。
 *
 * slot 取值：
 *  - 'app-space'：应用空间 Tab（manifest 里 slot 声明 tab 标签）
 *  - 'console'：控制台卡片（manifest 里 slot 声明 title）
 *  - 'system-menu'：系统级侧边菜单（全局插件，manifest 里 slot 声明 title）
 */
export type PluginSlotName = 'app-space' | 'console' | 'system-menu'

export interface PluginUiSlot {
  slot: PluginSlotName
  tab?: string
  title?: string
  entry: string
}

export interface PluginUiManifest {
  pluginType: string
  name: string
  icon?: string
  version?: string
  slots: PluginUiSlot[]
}

export interface PluginMountContext {
  appId?: number
  pluginType: string
  /** 挂载场景：console / system-menu / app-space，供插件按场景差异化渲染。 */
  mode?: string
  refresh: () => void
}

export interface PluginUiEntry {
  mount: (el: HTMLElement, ctx: PluginMountContext) => void | (() => void)
}

/** 核心 UI 静态注册项（框架能力：数据集面板懒加载 chunk）。 */
export interface CoreUiItem {
  slot: 'app-space'
  tab: string
  /** element-plus 图标组件（核心 Tab 与插件图标统一视觉形态）。 */
  icon?: Component
  load: () => Promise<PluginUiEntry>
}

const pluginManifests = reactive<PluginUiManifest[]>([])
const coreUiItems: CoreUiItem[] = []
/** 插件图标注册表（来自插件声明 /api/plugins，pluginType → icon 声明值）。 */
const pluginIcons = reactive<Record<string, string>>({})

/** 框架能力静态注册（主壳内懒加载 chunk，不经插件 jar）；按 tab 去重。 */
export function registerCoreUi(item: CoreUiItem) {
  if (!coreUiItems.some((i) => i.tab === item.tab)) {
    coreUiItems.push(item)
  }
}

/** 插件图标：pluginType → 声明值（'' / data: / http(s): / icons/xxx.svg）。 */
export function iconOf(pluginType: string): string {
  return pluginIcons[pluginType] ?? ''
}

/**
 * 解析插件图标为可加载 URL：
 * - data: / http(s): 原样返回
 * - 相对路径（icons/xxx.svg）→ /_pluginui/{type}/icons/xxx.svg（平台图标服务，缓存 immutable）
 * - 未声明 → null
 */
export function pluginIconUrl(pluginType: string, icon: string): string | null {
  if (!icon) return null
  if (/^(data:|https?:)/i.test(icon)) return icon
  const rel = icon.replace(/^\/+/, '')
  return `/_pluginui/${pluginType}/icons/${rel.replace(/^icons\//, '')}`
}

/** 拉取全部已注册插件的 UI manifest（启动时调用一次）。 */
export async function initPluginSlots() {
  try {
    const list = await get<PluginUiManifest[]>('/api/plugins/ui')
    pluginManifests.splice(0, pluginManifests.length, ...list)
  } catch {
    // 未登录或后端未就绪：静默（登录后刷新页面重试）
  }
  try {
    const defs = await get<Array<{ plugin: { pluginType: string; icon: string } }>>('/api/plugins')
    for (const d of defs) pluginIcons[d.plugin.pluginType] = d.plugin.icon ?? ''
  } catch {
    // 同上：静默
  }
}

/** 合并视图：核心 UI 在前，插件 UI 在后。icon：核心为 element 图标组件，插件为图片 URL。 */
export function slotsOf(name: PluginSlotName): Array<{ key: string; label: string; icon: string | Component | null; load: () => Promise<PluginUiEntry> }> {
  const result: Array<{ key: string; label: string; icon: string | Component | null; load: () => Promise<PluginUiEntry> }> = []
  if (name === 'app-space') {
    for (const item of coreUiItems) {
      result.push({ key: `core:${item.tab}`, label: item.tab, icon: item.icon ?? null, load: item.load })
    }
  }
  for (const m of pluginManifests) {
    for (const s of m.slots) {
      if (s.slot !== name) continue
      const label = name === 'app-space' ? (s.tab ?? m.name) : (s.title ?? m.name)
      result.push({
        key: `plugin:${m.pluginType}`,
        label,
        icon: pluginIconUrl(m.pluginType, iconOf(m.pluginType)),
        load: async () => (await import(/* @vite-ignore */ `/_pluginui/${m.pluginType}/${s.entry}`)).default as PluginUiEntry,
      })
    }
  }
  return result
}

/** 响应式 slot 视图：manifest 异步加载完成后自动更新。 */
export function useSlotsOf(name: PluginSlotName) {
  return computed(() => slotsOf(name))
}

/**
 * Vue 组件 → mount(el, ctx) 适配器（框架能力面板走统一 slot 挂载，
 * 与插件 UI 完全同一套渲染管线，仅注册来源不同）。
 */
export function toMountEntry(component: unknown): PluginUiEntry {
  return {
    mount: (el, ctx) => {
      const app = createApp(component as never, { appId: ctx.appId })
      app.use(ElementPlus)
      app.mount(el)
      return () => app.unmount()
    },
  }
}
