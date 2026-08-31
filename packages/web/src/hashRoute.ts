/**
 * 轻量 hash 路由（项目未引入 vue-router）：把主导航状态同步到 location.hash，
 * 支持刷新/分享直达与浏览器前进后退。分页等轻量状态用 replaceState，不产生历史记录。
 *
 * 形态：
 *   #/console              控制台（默认）
 *   #/apps                 应用管理列表（?p=N 列表页码，仅 N>1 时写入）
 *   #/apps/{id}            应用空间·看板（board 不写入，为默认落地 Tab）
 *   #/apps/{id}/{tab}      应用空间·指定 Tab
 *   #/plugin/{type}        系统级插件页面
 */
export interface HashRoute {
  menu?: string
  appId?: number
  spaceTab?: string
  pluginType?: string
  page?: number
}

const MENUS = ['console', 'apps', 'plugins', 'ops', 'security']

export function parseHash(hash: string): HashRoute {
  const raw = (hash ?? '').replace(/^#\/?/, '')
  const [pathPart, queryPart] = raw.split('?')
  const segs = pathPart.split('/').filter(Boolean)
  const query = new URLSearchParams(queryPart ?? '')
  const route: HashRoute = { menu: 'console' }
  const head = segs[0] ?? ''
  if (head === 'apps') {
    route.menu = 'apps'
    const id = Number(segs[1])
    if (segs[1] && Number.isInteger(id) && id > 0) {
      route.appId = id
      if (segs[2]) route.spaceTab = decodeURIComponent(segs[2])
    }
    const p = Number(query.get('p'))
    if (Number.isInteger(p) && p > 1) route.page = p
  } else if (head === 'plugin' && segs[1]) {
    return { pluginType: decodeURIComponent(segs[1]) }
  } else if (MENUS.includes(head)) {
    route.menu = head
  }
  return route
}

export function toHash(r: HashRoute): string {
  const q = r.page != null && r.page > 1 ? `?p=${r.page}` : ''
  if (r.pluginType) return `#/plugin/${encodeURIComponent(r.pluginType)}`
  if (r.appId != null) {
    const tab = r.spaceTab && r.spaceTab !== 'board' ? `/${encodeURIComponent(r.spaceTab)}` : ''
    return `#/apps/${r.appId}${tab}${q}`
  }
  const menu = r.menu && MENUS.includes(r.menu) ? r.menu : 'console'
  return `#/${menu}${menu === 'apps' ? q : ''}`
}
