import { describe, expect, it } from 'vitest'
import { parseHash, toHash } from './hashRoute'

describe('hashRoute', () => {
  it('空/非法 hash 回落 console', () => {
    expect(parseHash('')).toEqual({ menu: 'console' })
    expect(parseHash('#/')).toEqual({ menu: 'console' })
    expect(parseHash('#/unknown')).toEqual({ menu: 'console' })
    expect(toHash({ menu: 'nope' as string })).toBe('#/console')
  })

  it('解析内置菜单与系统级插件页', () => {
    expect(parseHash('#/ops')).toEqual({ menu: 'ops' })
    expect(parseHash('#/security')).toEqual({ menu: 'security' })
    expect(parseHash('#/plugin/machine-monitor')).toEqual({ pluginType: 'machine-monitor' })
  })

  it('解析应用空间 / Tab / 列表页码', () => {
    expect(parseHash('#/apps')).toEqual({ menu: 'apps' })
    expect(parseHash('#/apps/3')).toEqual({ menu: 'apps', appId: 3 })
    expect(parseHash('#/apps/3/instances')).toEqual({ menu: 'apps', appId: 3, spaceTab: 'instances' })
    expect(parseHash('#/apps?p=2')).toEqual({ menu: 'apps', page: 2 })
    // 非法 appId / 页码忽略
    expect(parseHash('#/apps/abc')).toEqual({ menu: 'apps' })
    expect(parseHash('#/apps?p=1')).toEqual({ menu: 'apps' })
  })

  it('toHash 规则：board 为默认不写入，page>1 才写入', () => {
    expect(toHash({ menu: 'apps', appId: 3, spaceTab: 'board' })).toBe('#/apps/3')
    expect(toHash({ menu: 'apps', appId: 3, spaceTab: 'instances' })).toBe('#/apps/3/instances')
    expect(toHash({ menu: 'apps', page: 2 })).toBe('#/apps?p=2')
    expect(toHash({ menu: 'apps', appId: 3, page: 2 })).toBe('#/apps/3?p=2')
    expect(toHash({ pluginType: 'machine monitor' })).toBe('#/plugin/machine%20monitor')
  })

  it('往返一致（除 board 简化）', () => {
    for (const h of ['#/', '#/apps', '#/apps/3', '#/apps/3/instances', '#/apps?p=2', '#/plugin/machine-monitor', '#/security']) {
      const expected = h === '#/' ? '#/console' : h
      expect(toHash(parseHash(h))).toBe(expected)
    }
  })
})
