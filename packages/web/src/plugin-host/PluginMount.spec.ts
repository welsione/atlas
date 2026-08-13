import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PluginMount from './PluginMount.vue'
import type { PluginUiEntry, PluginMountContext } from './slotRegistry'

describe('PluginMount', () => {
  it('挂载后调用 load 并 mount entry，卸载时调用返回的 unmount', async () => {
    const entryUnmount = vi.fn()
    const entryMount = vi.fn((_el: HTMLElement, _ctx: PluginMountContext) => entryUnmount)
    const load = vi.fn(async () => ({ mount: entryMount }) as PluginUiEntry)
    const wrapper = mount(PluginMount, {
      props: { load, refresh: () => undefined, pluginType: 'demo', mode: 'app-space' },
    })
    await vi.waitFor(() => expect(entryMount).toHaveBeenCalled())
    expect(entryMount.mock.calls[0][1]).toMatchObject({ pluginType: 'demo', mode: 'app-space' })
    wrapper.unmount()
    expect(entryUnmount).toHaveBeenCalled()
  })

  it('load 进行中卸载：返回后不再挂载到已卸载 host', async () => {
    let resolveLoad!: (v: PluginUiEntry) => void
    const entryMount = vi.fn()
    const load = vi.fn(() => new Promise<PluginUiEntry>((r) => { resolveLoad = r }))
    const wrapper = mount(PluginMount, {
      props: { load, refresh: () => undefined, pluginType: 'demo' },
    })
    wrapper.unmount()
    resolveLoad({ mount: entryMount })
    await new Promise((r) => setTimeout(r, 0))
    expect(entryMount).not.toHaveBeenCalled()
  })
})
