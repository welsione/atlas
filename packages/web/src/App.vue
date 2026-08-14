<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { HomeFilled, Grid, Cpu, Tools, Lock, SwitchButton, ArrowLeft } from '@element-plus/icons-vue'
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
import type { App } from './types'

type MenuKey = 'console' | 'apps' | 'plugins' | 'security' | 'ops' | `plugin:${string}`

const current = ref<MenuKey>('console')
const activeApp = ref<App | null>(null)

/** 管理认证门：未通过鉴权时渲染登录页，不展示任何管理数据。 */
const authed = ref(false)
function handleAuthed() {
  authed.value = true
  // 登录前 /api/plugins/ui 会 401 静默失败，登录后必须重拉一次（规范 F-02）
  void initPluginSlots()
}
function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  setPageHeadAction(null)
  authed.value = false
  current.value = 'console'
  activeApp.value = null
}

onMounted(() => {
  // 401（token 失效/被吊销）→ 回落到登录页
  window.addEventListener('atlas:unauthorized', () => {
    authed.value = false
  })
})

/** 系统级插件侧边菜单（全局插件声明 system-menu slot 后出现）。 */
const systemMenuSlots = useSlotsOf('system-menu')

const activePlugin = computed(() => systemMenuSlots.value.find((s) => s.key === current.value))

function openSpace(app: App) {
  activeApp.value = app
  setPageHeadAction(null)
}

function backToList() {
  activeApp.value = null
  setPageHeadAction(null)
}

function switchMenu(key: MenuKey) {
  current.value = key
  activeApp.value = null
  setPageHeadAction(null)
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
const brandImg = computed(() => `/icons/${collapsed.value ? 'atlas' : 'atlas-banner'}.svg`)

/* 页头右侧主操作（由各视图经 setPageHeadAction 注入） */
const head = usePageHeadAction()
</script>

<template>
  <LoginView v-if="!authed" @authed="handleAuthed" />

  <el-container v-else class="layout" :class="{ collapsed }">
    <!-- 侧栏：整页同白；sticky 固定视口高度，退出登录钉在可视底部；可折叠成图标模式 -->
    <aside class="sidebar" aria-label="主导航">
      <div class="side-top">
        <a class="brand-logo" :title="collapsed ? '展开侧栏' : '收起侧栏'" @click.prevent="toggleCollapse">
          <img :src="brandImg" class="brand-banner" alt="Atlas" />
        </a>
        <div class="acts">
          <button type="button" class="sbar-btn" :title="collapsed ? '展开侧栏' : '收起侧栏'" @click="toggleCollapse">
            <el-icon :class="{ 'is-flip': collapsed }"><ArrowLeft /></el-icon>
          </button>
        </div>
      </div>

      <div class="menu">
        <!-- 内置菜单（线性图标 + 文字；系统级插件菜单同形态） -->
        <a class="mi" :class="{ on: current === 'console' }" title="控制台" @click.prevent="switchMenu('console')">
          <el-icon class="ic"><HomeFilled /></el-icon>
          <span class="txt">控制台</span>
          <span class="tip">控制台</span>
        </a>
        <a class="mi" :class="{ on: current === 'apps' }" title="应用管理" @click.prevent="switchMenu('apps')">
          <el-icon class="ic"><Grid /></el-icon>
          <span class="txt">应用管理</span>
          <span class="tip">应用管理</span>
        </a>
        <a v-for="slot in systemMenuSlots" :key="slot.key" class="mi" :class="{ on: current === slot.key }" :title="slot.label" @click.prevent="switchMenu(slot.key as MenuKey)">
          <el-icon v-if="typeof slot.icon === 'string' && slot.icon" class="ic">
            <img :src="slot.icon" alt="" />
          </el-icon>
          <el-icon v-else class="ic"><Cpu /></el-icon>
          <span class="txt">{{ slot.label }}</span>
          <span class="tip">{{ slot.label }}</span>
        </a>
        <a class="mi" :class="{ on: current === 'plugins' }" title="插件注册表" @click.prevent="switchMenu('plugins')">
          <el-icon class="ic"><Cpu /></el-icon>
          <span class="txt">插件注册表</span>
          <span class="tip">插件注册表</span>
        </a>
        <a class="mi" :class="{ on: current === 'ops' }" title="运维台" @click.prevent="switchMenu('ops')">
          <el-icon class="ic"><Tools /></el-icon>
          <span class="txt">运维台</span>
          <span class="tip">运维台</span>
        </a>
        <a class="mi" :class="{ on: current === 'security' }" title="安全设置" @click.prevent="switchMenu('security')">
          <el-icon class="ic"><Lock /></el-icon>
          <span class="txt">安全设置</span>
          <span class="tip">安全设置</span>
        </a>
      </div>

      <!-- 侧栏底部：退出登录（钉在可视底部，hover 红） -->
      <div class="sfoot">
        <el-button text class="logout-btn" @click="logout">
          <el-icon><SwitchButton /></el-icon>
          <span class="txt">退出登录</span>
        </el-button>
        <span class="tip">退出登录</span>
      </div>
    </aside>

    <el-main class="main">
      <div class="ph">
        <nav class="crumb">
          <template v-for="(c, i) in crumb" :key="i">
            <a v-if="c.go && i < crumb.length - 1" @click.prevent="c.go">{{ c.label }}</a>
            <span v-else class="cur">{{ c.label }}</span>
            <span v-if="i < crumb.length - 1" class="sep">›</span>
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
      <ConsoleView v-else-if="current === 'console'" @open-space="openSpace" />
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
}

.mi {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 12px;
  border-radius: var(--atlas-r-s);
  font-size: 13px;
  color: var(--atlas-menu);
  cursor: pointer;
  text-decoration: none;
  transition: background 0.14s, color 0.14s;
  white-space: nowrap;
}

.mi .txt {
  margin-right: auto;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mi .ic {
  width: 18px;
  height: 18px;
  min-width: 18px;
  flex-shrink: 0;
  opacity: 0.75;
}

.mi .ic img {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}

.mi.on {
  background: var(--atlas-accent-soft);
  color: var(--atlas-accent);
  font-weight: 700;
}

.mi.on .ic {
  opacity: 1;
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
  transition: 0.12s;
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
  border-radius: var(--atlas-r-s);
  cursor: pointer;
  padding: 3px 2px;
}

.brand-logo:hover {
  background: var(--atlas-layer);
}

.brand-logo img {
  display: block;
  height: 40px;
  width: auto;
  min-width: 40px;
  transition: height 0.18s;
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
  transition: background 0.14s, color 0.14s;
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

.layout.collapsed .mi .ic {
  width: 20px;
  height: 20px;
  min-width: 20px;
}

.layout.collapsed .mi .ic img {
  width: 20px;
  height: 20px;
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

.crumb a {
  color: var(--atlas-muted);
  text-decoration: none;
  cursor: pointer;
}

.crumb a:hover {
  color: var(--atlas-accent);
}

.crumb .sep {
  color: var(--atlas-stroke-strong);
}

.crumb .cur {
  color: var(--atlas-text);
  font-weight: 600;
}
</style>
