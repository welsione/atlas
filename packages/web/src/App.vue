<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { SwitchButton, ArrowLeft } from '@element-plus/icons-vue'
// 侧边导航统一用 Lucide 线性图标库（stroke 2 统一语言，currentColor 随菜单态）
import { House, LayoutGrid, Puzzle, Settings, Lock, Cpu, Activity } from 'lucide-vue-next'
import ConsoleView from './views/ConsoleView.vue'
import AppsView from './views/AppsView.vue'
import AppSpaceView from './views/AppSpaceView.vue'
import PluginsAdminView from './views/PluginsAdminView.vue'
import SecurityView from './views/SecurityView.vue'
import OpsView from './views/OpsView.vue'
import LoginView from './views/LoginView.vue'
import PluginMount from './plugin-host/PluginMount.vue'
import { initPluginSlots, useSlotsOf } from './plugin-host/slotRegistry'
import { usePageHeadAction, setPageHeadAction } from './pageHead'
import { AUTH_TOKEN_KEY } from './services/http'
import { appApi } from './services/appApi'
import { parseHash, toHash, type HashRoute } from './hashRoute'
import type { App } from './types'

type MenuKey = 'console' | 'apps' | 'plugins' | 'security' | 'ops' | `plugin:${string}`

/* ---------- hash 路由（刷新/分享直达 + 前进后退） ---------- */
function currentRoute(): HashRoute {
  return parseHash(typeof window !== 'undefined' ? window.location.hash : '')
}

/** 管理认证门：未通过鉴权时渲染登录页，不展示任何管理数据。 */
const authed = ref(false)

const initialRoute = currentRoute()
const current = ref<MenuKey>(initialRoute.pluginType ? `plugin:${initialRoute.pluginType}` : ((initialRoute.menu ?? 'console') as MenuKey))
const activeApp = ref<App | null>(null)

/** 深链 #/apps/{id}：列表里找回应用实体后进入空间；找不到/未登录静默回落列表。 */
async function restoreApp(id: number) {
  try {
    const app = (await appApi.list(1, 100)).rows.find((a) => a.id === id) ?? null
    // 请求期间路由可能已再次变化
    if (current.value !== 'apps' || currentRoute().appId !== id) return
    if (app) {
      activeApp.value = app
    } else {
      history.replaceState(null, '', toHash({ menu: 'apps' }))
    }
  } catch {
    // 未登录等
  }
}

function applyRoute(r: HashRoute) {
  if (r.pluginType) {
    current.value = `plugin:${r.pluginType}`
    activeApp.value = null
    setPageHeadAction(null)
    return
  }
  current.value = (r.menu ?? 'console') as MenuKey
  setPageHeadAction(null)
  if (r.appId != null) {
    if (activeApp.value?.id === r.appId) return
    activeApp.value = null
    void restoreApp(r.appId)
  } else {
    activeApp.value = null
  }
}

function handleAuthed() {
  authed.value = true
  // 登录前 /api/plugins/ui 会 401 静默失败，登录后必须重拉一次（规范 F-02）
  void initPluginSlots()
  // 带 hash 直达（如 #/apps/3/instances）：登录后恢复路由目标
  if (currentRoute().appId != null) applyRoute(currentRoute())
}
function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  setPageHeadAction(null)
  authed.value = false
  current.value = 'console'
  activeApp.value = null
  history.replaceState(null, '', toHash({ menu: 'console' }))
}

/* 401（token 失效/被吊销）→ 回落到登录页；卸载时对称清理 */
const onUnauthorized = () => {
  authed.value = false
}
const onPopState = () => applyRoute(currentRoute())
onMounted(() => {
  window.addEventListener('atlas:unauthorized', onUnauthorized)
  window.addEventListener('popstate', onPopState)
  window.addEventListener('resize', syncViewport, { passive: true })
  syncViewport()
})
onBeforeUnmount(() => {
  window.removeEventListener('atlas:unauthorized', onUnauthorized)
  window.removeEventListener('popstate', onPopState)
  window.removeEventListener('resize', syncViewport)
})

/** 系统级插件侧边菜单（全局插件声明 system-menu slot 后出现）。 */
const systemMenuSlots = useSlotsOf('system-menu')

/* 深链 current=plugin:{type}，而 slot.key=plugin:{type}:{title}：按前缀匹配；
   computed 响应式——slot 清单异步就绪后自动命中（此前全等匹配导致深链刷新永远落空） */
const activePlugin = computed(() => {
  const c = current.value
  if (!c.startsWith('plugin:')) return undefined
  return systemMenuSlots.value.find((s) => s.key === c || s.key.startsWith(c + ':'))
})

function openSpace(app: App) {
  activeApp.value = app
  setPageHeadAction(null)
  history.pushState(null, '', toHash({ menu: 'apps', appId: app.id }))
}

function backToList() {
  activeApp.value = null
  setPageHeadAction(null)
  history.pushState(null, '', toHash({ menu: 'apps' }))
}

function switchMenu(key: MenuKey) {
  current.value = key
  activeApp.value = null
  setPageHeadAction(null)
  history.pushState(null, '', toHash(key.startsWith('plugin:') ? { pluginType: key.slice(7) } : { menu: key }))
}

/* ---------- 面包屑（§7.1：二进制 `首页 › 当前页`） ---------- */
const crumb = computed<Array<{ label: string; go?: () => void }>>(() => {
  if (activePlugin.value) {
    return [{ label: '首页', go: () => switchMenu('console') }, { label: activePlugin.value.label }]
  }
  if (activeApp.value) {
    return [
      { label: '首页', go: () => switchMenu('console') },
      { label: '应用管理', go: () => switchMenu('apps') },
      { label: activeApp.value.name },
    ]
  }
  const map: Record<MenuKey, string> = {
    console: '控制台',
    apps: '应用管理',
    plugins: '插件注册表',
    ops: '运维台',
    security: '安全设置',
  }
  return [{ label: '首页' }, { label: map[current.value] ?? '控制台' }]
})

/* ---------- 侧栏折叠（§7.2）---------- */
const COLLAPSE_KEY = 'atlas-sidebar-collapsed'
const collapsed = ref(typeof localStorage !== 'undefined' && localStorage.getItem(COLLAPSE_KEY) === '1')
function toggleCollapse() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
  } catch {
    // 忽略
  }
}
/* 移动端抽屉始终是「展开」形态，Logo 与桌面折叠状态解耦，一律用横幅版 */
const brandImg = computed(() => `/icons/${!isMobile.value && collapsed.value ? 'atlas' : 'atlas-banner'}.svg`)

/* ---------- 移动端（≤768px）：侧栏转为覆盖式抽屉，汉堡按钮开合 ---------- */
const isMobile = ref(false)
const mobileNavOpen = ref(false)
function syncViewport() {
  // jsdom 等环境无 matchMedia：视为桌面（isMobile 默认 false）
  isMobile.value = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches
  if (!isMobile.value) mobileNavOpen.value = false
}
function toggleMobileNav() {
  mobileNavOpen.value = !mobileNavOpen.value
}
function switchMenuMobile(key: MenuKey) {
  switchMenu(key)
  mobileNavOpen.value = false
}

/* 页头右侧主操作（由各视图经 setPageHeadAction 注入） */
const head = usePageHeadAction()
</script>

<template>
  <LoginView v-if="!authed" @authed="handleAuthed" />

  <el-container v-else class="layout" :class="{ collapsed, 'is-mobile': isMobile, 'mobile-nav-open': mobileNavOpen }">
    <!-- 遮罩：移动端抽屉打开时覆盖内容区，点击关闭 -->
    <div v-if="isMobile" class="mobile-mask" :class="{ show: mobileNavOpen }" aria-hidden="true" @click="mobileNavOpen = false" />
    <!-- 侧栏：整页同白；sticky 固定视口高度，退出登录钉在可视底部；可折叠成图标模式；移动端覆盖式抽屉 -->
    <aside class="sidebar" aria-label="主导航">
      <div class="side-top">
        <!-- 移动端抽屉没有「图标模式」语义：Logo 不可点折叠，点击仅关闭抽屉 -->
        <button
          type="button"
          class="brand-logo"
          :title="isMobile ? undefined : (collapsed ? '展开侧栏' : '收起侧栏')"
          :aria-label="isMobile ? '关闭导航菜单' : (collapsed ? '展开侧栏' : '收起侧栏')"
          :aria-expanded="isMobile ? mobileNavOpen : !collapsed"
          @click="isMobile ? (mobileNavOpen = false) : toggleCollapse()"
        >
          <img :src="brandImg" class="brand-banner" alt="Atlas" />
        </button>
        <div v-if="!isMobile" class="acts">
          <button type="button" class="sbar-btn" :title="collapsed ? '展开侧栏' : '收起侧栏'" :aria-label="collapsed ? '展开侧栏' : '收起侧栏'" :aria-expanded="!collapsed" @click="toggleCollapse">
            <el-icon :class="{ 'is-flip': collapsed }" aria-hidden="true"><ArrowLeft /></el-icon>
          </button>
        </div>
      </div>

      <div class="menu" role="navigation" aria-label="主导航">
        <!-- 内置菜单（统一线性图标 navIcons.ts + 文字；系统级插件菜单同形态） -->
        <button type="button" class="mi" :class="{ on: current === 'console' }" :aria-current="current === 'console' ? 'page' : undefined" @click="switchMenuMobile('console')">
          <House class="ic" aria-hidden="true" :stroke-width="1.8" />
          <span class="txt">控制台</span>
          <span class="tip" aria-hidden="true">控制台</span>
        </button>
        <button type="button" class="mi" :class="{ on: current === 'apps' }" :aria-current="current === 'apps' ? 'page' : undefined" @click="switchMenuMobile('apps')">
          <LayoutGrid class="ic" aria-hidden="true" :stroke-width="1.8" />
          <span class="txt">应用管理</span>
          <span class="tip" aria-hidden="true">应用管理</span>
        </button>
        <button v-for="slot in systemMenuSlots" :key="slot.key" type="button" class="mi" :class="{ on: current === slot.key }" :aria-current="current === slot.key ? 'page' : undefined" @click="switchMenuMobile(slot.key as MenuKey)">
          <!-- 菜单图标统一 Lucide 线性风（插件自带的彩色 SVG 与菜单灰/蓝态冲突，img 引入也无法 currentColor）：
               监控类用 Activity，其他用 Cpu 兜底，颜色随文字态 -->
          <Activity v-if="slot.pluginType === 'machine-monitor'" class="ic" aria-hidden="true" :stroke-width="1.8" />
          <Cpu v-else class="ic" aria-hidden="true" :stroke-width="1.8" />
          <span class="txt">{{ slot.label }}</span>
          <span class="tip" aria-hidden="true">{{ slot.label }}</span>
        </button>
        <button type="button" class="mi" :class="{ on: current === 'plugins' }" :aria-current="current === 'plugins' ? 'page' : undefined" @click="switchMenuMobile('plugins')">
          <Puzzle class="ic" aria-hidden="true" :stroke-width="1.8" />
          <span class="txt">插件注册表</span>
          <span class="tip" aria-hidden="true">插件注册表</span>
        </button>
        <button type="button" class="mi" :class="{ on: current === 'ops' }" :aria-current="current === 'ops' ? 'page' : undefined" @click="switchMenuMobile('ops')">
          <Settings class="ic" aria-hidden="true" :stroke-width="1.8" />
          <span class="txt">运维台</span>
          <span class="tip" aria-hidden="true">运维台</span>
        </button>
        <button type="button" class="mi" :class="{ on: current === 'security' }" :aria-current="current === 'security' ? 'page' : undefined" @click="switchMenuMobile('security')">
          <Lock class="ic" aria-hidden="true" :stroke-width="1.8" />
          <span class="txt">安全设置</span>
          <span class="tip" aria-hidden="true">安全设置</span>
        </button>
      </div>

      <!-- 侧栏底部：退出登录（钉在可视底部，hover 红） -->
      <div class="sfoot">
        <el-button text class="logout-btn" @click="logout">
          <el-icon aria-hidden="true"><SwitchButton /></el-icon>
          <span class="txt">退出登录</span>
        </el-button>
        <span class="tip" aria-hidden="true">退出登录</span>
      </div>
    </aside>

    <el-main class="main">
      <div class="ph">
        <nav class="crumb" aria-label="面包屑">
          <!-- 移动端汉堡按钮：开合侧栏抽屉（用 Atlas 图标，与侧栏品牌一致） -->
          <button v-if="isMobile" type="button" class="hamburger" aria-label="打开导航菜单" :aria-expanded="mobileNavOpen" @click="toggleMobileNav">
            <img src="/icons/atlas.svg" class="hamburger-ico" alt="" />
          </button>
          <template v-for="(c, i) in crumb" :key="i">
            <button v-if="c.go && i < crumb.length - 1" type="button" class="crumb-link" @click="c.go">{{ c.label }}</button>
            <span v-else class="cur">{{ c.label }}</span>
            <span v-if="i < crumb.length - 1" class="sep" aria-hidden="true">›</span>
          </template>
        </nav>
        <el-tooltip v-if="head.action" :content="head.action.tip || head.action.label" placement="bottom">
          <el-button
            :type="head.action.primary === false ? 'default' : 'primary'"
            :icon="head.action.icon"
            :loading="head.action.loading"
            :disabled="head.action.disabled"
            class="head-action"
            @click="head.action.onClick"
          >
            {{ head.action.label }}
          </el-button>
        </el-tooltip>
      </div>

      <!-- 系统级插件面板（全局插件，无应用上下文） -->
      <div v-if="activePlugin" class="page">
        <PluginMount :load="activePlugin.load" :plugin-type="activePlugin.pluginType" mode="system-menu" :refresh="() => undefined" />
      </div>
      <AppSpaceView v-else-if="activeApp" :app="activeApp" @back="backToList" />
      <ConsoleView v-else-if="current === 'console'" @go-apps="switchMenu('apps')" />
      <AppsView v-else-if="current === 'apps'" @open-space="openSpace" />
      <PluginsAdminView v-else-if="current === 'plugins'" />
      <OpsView v-else-if="current === 'ops'" />
      <SecurityView v-else />
    </el-main>
  </el-container>
</template>

<style scoped>
.layout {
  display: flex;
  align-items: flex-start;
  min-height: 100vh;
  background: var(--atlas-bg);
}

/* ===== 侧栏：整页同白；sticky 固定视口高度，菜单 flex 填满，把底部退出登录钉在可视底部 ===== */
.sidebar {
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  width: 232px;
  flex-shrink: 0;
  padding: 14px 12px 16px;
  border-right: 1px solid var(--atlas-stroke);
  overflow: hidden;
  transition: width 0.2s ease;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.mi {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 12px;
  border: 0;
  background: none;
  font: inherit;
  width: 100%;
  text-align: left;
  border-radius: var(--atlas-r-s);
  font-size: 13px;
  color: var(--atlas-menu);
  cursor: pointer;
  text-decoration: none;
  transition: background 0.14s ease, color 0.14s ease;
  white-space: nowrap;
}

.mi .txt {
  margin-right: auto;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mi .ic {
  width: 22px;
  height: 22px;
  min-width: 22px;
  flex-shrink: 0;
  /* 图标颜色统一跟随文字色（currentColor）：默认菜单灰、hover 深色、选中品牌蓝，
     不再对图标做单独透明度折扣 */
  opacity: 1;
}

.mi .ic img {
  width: 22px;
  height: 22px;
  border-radius: 5px;
}

.mi.on {
  background: var(--atlas-accent-soft);
  color: var(--atlas-accent);
  font-weight: 700;
}

.mi:not(.on):hover {
  background: var(--atlas-layer);
  color: var(--atlas-text);
}

.mi .cnt {
  margin-left: auto;
  font-size: 11px;
  color: var(--atlas-faint);
  font-variant-numeric: tabular-nums;
}

/* 折叠态悬停图标 tooltip */
.mi .tip,
.sfoot .tip {
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) translateX(-4px);
  background: var(--atlas-text);
  color: var(--atlas-bg);
  font-size: 12px;
  padding: 5px 9px;
  border-radius: var(--atlas-r-s);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease, transform 0.12s ease;
  z-index: 50;
  box-shadow: 0 4px 12px rgba(16, 24, 48, 0.18);
}

.layout.collapsed .mi:hover .tip,
.layout.collapsed .sfoot:hover .tip {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

/* 顶部品牌 logo（可点击收起/展开）+ 右上折叠图标 */
.side-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 18px;
}

.brand-logo {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  font: inherit;
  padding: 3px 2px;
  border-radius: var(--atlas-r-s);
  cursor: pointer;
}

.brand-logo:hover {
  background: var(--atlas-layer);
}

.brand-logo img {
  display: block;
  height: 40px;
  width: auto;
  min-width: 40px;
}

.acts {
  display: flex;
  gap: 4px;
  align-items: center;
}

.sbar-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--atlas-r-s);
  color: var(--atlas-muted);
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.sbar-btn:hover {
  background: var(--atlas-layer);
  color: var(--atlas-text);
}

.sbar-btn .is-flip {
  transform: rotate(180deg);
}

.sbar-btn .el-icon {
  transition: transform 0.2s ease;
}

/* 退出登录（底部，hover 红） */
.sfoot {
  position: relative;
  margin-top: 14px;
}

.logout-btn {
  width: 100%;
  justify-content: flex-start;
  gap: 9px;
  padding: 9px 12px;
  border-radius: var(--atlas-r-s);
  font-size: 12px;
  color: var(--atlas-muted);
  transition: background 0.14s, color 0.14s;
}

.logout-btn:hover {
  background: var(--atlas-danger-hover-bg);
  color: var(--atlas-danger);
}

.logout-btn:hover .el-icon {
  color: var(--atlas-danger);
}

/* ===== 折叠态：图标模式 ===== */
.layout.collapsed .sidebar {
  width: 64px;
  padding: 14px 10px 16px;
}

.layout.collapsed .side-top {
  margin-bottom: 18px;
  justify-content: center;
}

.layout.collapsed .brand-logo {
  flex: none;
  padding: 4px 2px;
}

.layout.collapsed .brand-logo img {
  height: 38px;
}

.layout.collapsed .acts {
  display: none;
}

.layout.collapsed .menu {
  margin-top: 2px;
}

.layout.collapsed .mi {
  padding: 10px;
  gap: 0;
  justify-content: center;
}

/* 收起态（图标模式）：图标是唯一信息载体，完全不透明，
   避免大热区中心一小块灰图的失衡观感 */
.layout.collapsed .mi .ic {
  width: 22px;
  height: 22px;
  min-width: 22px;
  opacity: 1;
}

.layout.collapsed .mi:not(.on) .ic {
  color: var(--atlas-text);
}

.layout.collapsed .mi .ic img {
  width: 22px;
  height: 22px;
  border-radius: 5px;
}

.layout.collapsed .mi .txt {
  display: none;
}

.layout.collapsed .sfoot {
  justify-content: center;
  display: flex;
}

.layout.collapsed .logout-btn {
  padding: 9px 0;
  justify-content: center;
}

.layout.collapsed .logout-btn .txt {
  display: none;
}

.layout.collapsed .sfoot:hover .logout-btn {
  background: var(--atlas-layer);
}

/* ===== 主区：同白底，承载页面外边距（26px 36px 40px） ===== */
.main {
  flex: 1;
  min-width: 0;
  padding: 26px 36px 40px;
  background: var(--atlas-bg);
}

.ph {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
  min-height: 28px;
}

.head-action {
  flex-shrink: 0;
}

.crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--atlas-muted);
}

.crumb a,
.crumb .cur,
.crumb-link {
  color: var(--atlas-muted);
  text-decoration: none;
  cursor: pointer;
}

.crumb a:hover,
.crumb-link:hover {
  color: var(--atlas-accent);
}

.crumb-link {
  border: 0;
  background: none;
  font: inherit;
  font-size: 13px;
  padding: 0;
}

.crumb .sep {
  color: var(--atlas-stroke-strong);
}

.crumb .cur {
  color: var(--atlas-text);
  font-weight: 600;
}

/* 汉堡按钮：仅移动端渲染（v-if），桌面不占位 */
.hamburger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--atlas-stroke);
  border-radius: var(--atlas-r-s);
  background: var(--atlas-surface);
  color: var(--atlas-text);
  cursor: pointer;
  flex-shrink: 0;
  margin-right: 10px;
  transition: background 0.14s ease, border-color 0.14s ease;
}
.hamburger:hover {
  background: var(--atlas-layer);
  border-color: var(--atlas-stroke-strong);
}
.hamburger-ico {
  width: 34px;
  height: 34px;
  display: block;
}

/* 遮罩：移动端抽屉打开时盖住内容区 */
.mobile-mask {
  display: none;
}

/* ===== 移动端（≤768px）：侧栏覆盖式抽屉 + 内容区收窄 ===== */
@media (max-width: 768px) {
  .main {
    padding: 16px 16px 28px;
  }
  .crumb {
    font-size: 13px;
  }

  .mobile-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 1990;
    background: rgba(20, 28, 60, 0.4);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }
  .mobile-mask.show {
    opacity: 1;
    pointer-events: auto;
  }

  /* 侧栏变固定覆盖抽屉：忽略折叠态（collapsed 仅桌面语义），始终全宽展开 */
  .layout.is-mobile .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    height: 100dvh;
    z-index: 2000;
    background: var(--atlas-bg);
    transform: translateX(-100%);
    transition: transform 0.22s ease;
    box-shadow: none;
  }
  .layout.is-mobile.mobile-nav-open .sidebar {
    transform: translateX(0);
    box-shadow: 0 6px 24px rgba(20, 28, 60, 0.14);
  }
  /* 抽屉态下忽略桌面折叠样式，恢复「图标+文字」完整展开形态：
     collapsed 的 padding/justify/side-top/sfoot 等折叠布局属性全部覆盖回退 */
  .layout.is-mobile .sidebar {
    width: min(80vw, 300px);
    padding: 14px 12px 16px;
  }
  .layout.is-mobile .side-top {
    justify-content: flex-start;
    margin-bottom: 6px;
  }
  .layout.is-mobile .brand-logo {
    flex: 1;
  }
  .layout.is-mobile .menu {
    margin-top: 12px;
  }
  .layout.is-mobile .mi {
    padding: 9px 12px;
    gap: 11px;
    justify-content: flex-start;
  }
  .layout.is-mobile .mi .txt {
    display: inline;
  }
  .layout.is-mobile .mi .ic,
  .layout.is-mobile .mi .ic img {
    width: 24px;
    height: 24px;
    min-width: 24px;
  }
  .layout.is-mobile .sfoot {
    justify-content: flex-start;
  }
  .layout.is-mobile .logout-btn {
    padding: 9px 12px;
    justify-content: flex-start;
  }
  .layout.is-mobile .logout-btn .txt {
    display: inline;
  }
  /* 隐藏桌面折叠箭头（抽屉用遮罩关闭） */
  .layout.is-mobile .acts {
    display: none;
  }
}
</style>
