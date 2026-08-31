import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { registerCoreUi, slotsOf, pluginIconUrl, iconOf, initPluginSlots, toMountEntry } from './slotRegistry'

vi.mock('element-plus', () => ({ default: { install: () => undefined } }))

vi.mock('../services/http', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))

import { get } from '../services/http'

const getMock = get as ReturnType<typeof vi.fn>

describe('slotRegistry', () => {
  it('pluginIconUrl：data:/http(s) 原样返回，相对路径映射到 /_pluginui', () => {
    expect(pluginIconUrl('p', 'data:image/svg+xml;base64,xxx')).toBe('data:image/svg+xml;base64,xxx')
    expect(pluginIconUrl('p', 'https://x/y.svg')).toBe('https://x/y.svg')
    expect(pluginIconUrl('p', 'icons/a.svg')).toBe('/_pluginui/p/icons/a.svg')
    expect(pluginIconUrl('p', '/icons/b.svg')).toBe('/_pluginui/p/icons/b.svg')
    expect(pluginIconUrl('p', '')).toBeNull()
  })

  it('registerCoreUi + slotsOf：核心 UI 生成 core:tab 唯一 key', () => {
    registerCoreUi({ slot: 'app-space', tab: '数据集', load: async () => ({} as never) })
    const core = slotsOf('app-space').filter((s) => s.key === 'core:数据集')
    expect(core).toHaveLength(1)
    expect(core[0].label).toBe('数据集')
  })

  it('initPluginSlots + slotsOf：插件 slot 生成唯一 key、图标经 pluginIconUrl 解析', async () => {
    getMock.mockResolvedValueOnce([
      {
        pluginType: 'demo',
        name: '演示',
        icon: 'icons/demo.svg',
        version: '1.0.0',
        slots: [
          { slot: 'console', title: '概览', entry: 'entry.a.js' },
          { slot: 'app-space', tab: '面板', entry: 'entry.b.js' },
        ],
      },
    ])
    getMock.mockResolvedValueOnce([{ plugin: { pluginType: 'demo', icon: 'icons/demo.svg' } }])
    await initPluginSlots()

    expect(iconOf('demo')).toBe('icons/demo.svg')

    const consoleSlots = slotsOf('console')
    expect(consoleSlots).toHaveLength(1)
    expect(consoleSlots[0].key).toBe('plugin:demo:概览')
    expect(consoleSlots[0].label).toBe('概览')
    expect(consoleSlots[0].icon).toBe('/_pluginui/demo/icons/demo.svg')
    expect(consoleSlots[0].pluginType).toBe('demo')

    const appSlots = slotsOf('app-space').filter((s) => s.key.startsWith('plugin:demo:'))
    expect(appSlots).toHaveLength(1)
    expect(appSlots[0].key).toBe('plugin:demo:面板')
    expect(appSlots[0].pluginType).toBe('demo')
  })

  it('initPluginSlots：/api/plugins 分页形状（rows）也能取到图标声明（回归：f0cc663 分页化后图标丢失）', async () => {
    getMock.mockResolvedValueOnce([
      { pluginType: 'paged', name: '分页', slots: [{ slot: 'console', title: '概览', entry: 'entry.c.js' }] },
    ])
    // 分页对象形状（/api/plugins 当前返回 { rows, total, page, size }）
    getMock.mockResolvedValueOnce({ rows: [{ plugin: { pluginType: 'paged', icon: 'icons/paged.svg' } }], total: 1, page: 1, size: 10 })
    await initPluginSlots()

    expect(iconOf('paged')).toBe('icons/paged.svg')
    const consoleSlots = slotsOf('console').filter((s) => s.key === 'plugin:paged:概览')
    expect(consoleSlots).toHaveLength(1)
    expect(consoleSlots[0].icon).toBe('/_pluginui/paged/icons/paged.svg')
  })

  it('initPluginSlots：图标声明优先取磁盘 manifest（/api/plugins/ui），DB 注册表仅兜底无 UI 插件', async () => {
    getMock.mockResolvedValueOnce([
      // UI manifest（磁盘直读）声明的 icon 与注册表不一致时，以磁盘为准
      { pluginType: 'disk', name: '磁盘', icon: 'icons/from-disk.svg', slots: [{ slot: 'console', title: '卡', entry: 'entry.d.js' }] },
    ])
    getMock.mockResolvedValueOnce({ rows: [{ plugin: { pluginType: 'disk', icon: 'icons/from-db.svg' } }, { plugin: { pluginType: 'noui', icon: 'icons/noui.svg' } }] })
    await initPluginSlots()

    expect(iconOf('disk')).toBe('icons/from-disk.svg')
    // 无 UI 产物的插件：声明来自注册表兜底
    expect(iconOf('noui')).toBe('icons/noui.svg')
  })

  it('toMountEntry：mount 返回 unmount 清理函数并传递上下文', () => {
    const el = document.createElement('div')
    const Comp = { render: () => h('div', 'x') }
    const entry = toMountEntry(Comp)
    const unmount = entry.mount(el, { appId: 1, pluginType: 'demo', mode: 'app-space', refresh: () => undefined })
    expect(typeof unmount).toBe('function')
    expect(unmount!()).toBeUndefined()
  })
})
