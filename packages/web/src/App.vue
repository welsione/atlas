<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Grid, Cpu, Lock, HomeFilled, Tools, SwitchButton } from '@element-plus/icons-vue'
import ConsoleView from './views/ConsoleView.vue'
import AppsView from './views/AppsView.vue'
import AppSpaceView from './views/AppSpaceView.vue'
import PluginsAdminView from './views/PluginsAdminView.vue'
import SecurityView from './views/SecurityView.vue'
import OpsView from './views/OpsView.vue'
import LoginView from './views/LoginView.vue'
import PluginMount from './plugin-host/PluginMount.vue'
import { useSlotsOf } from './plugin-host/slotRegistry'
import { AUTH_TOKEN_KEY } from './services/http'
import type { App } from './types'

type MenuKey = 'console' | 'apps' | 'plugins' | 'security' | 'ops' | `plugin:${string}`

const current = ref<MenuKey>('console')
const activeApp = ref<App | null>(null)

/** 管理认证门：未通过鉴权时渲染登录页，不展示任何管理数据。 */
const authed = ref(false)
function handleAuthed() {
  authed.value = true
}
function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
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
}

function backToList() {
  activeApp.value = null
}

function switchMenu(key: MenuKey) {
  current.value = key
  activeApp.value = null
}
</script>

<template>
  <LoginView v-if="!authed" @authed="handleAuthed" />
  <el-container v-else class="layout">
    <el-aside width="200px" class="sidebar">
      <div class="brand">
        <img src="/icons/atlas.svg" class="brand-logo" alt="Atlas" />
        <div class="brand-name">Atlas</div>
      </div>
      <el-menu :default-active="current" class="menu" @select="(i: string) => switchMenu(i as MenuKey)">
        <el-menu-item index="console">
          <el-icon><HomeFilled /></el-icon><span>控制台</span>
        </el-menu-item>
        <el-menu-item index="apps">
          <el-icon><Grid /></el-icon><span>应用管理</span>
        </el-menu-item>
        <el-menu-item v-for="slot in systemMenuSlots" :key="slot.key" :index="slot.key" :title="slot.label">
          <el-icon>
            <img v-if="typeof slot.icon === 'string'" :src="slot.icon" class="menu-plugin-icon" alt="" />
            <Cpu v-else />
          </el-icon>
          <span>{{ slot.label }}</span>
        </el-menu-item>
        <el-menu-item index="plugins">
          <el-icon><Cpu /></el-icon><span>插件注册表</span>
        </el-menu-item>
        <el-menu-item index="ops">
          <el-icon><Tools /></el-icon><span>运维台</span>
        </el-menu-item>
        <el-menu-item index="security">
          <el-icon><Lock /></el-icon><span>安全设置</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <el-button text class="logout-btn" @click="logout">
          <el-icon><SwitchButton /></el-icon><span>退出登录</span>
        </el-button>
      </div>
    </el-aside>
    <el-main class="main">
      <!-- 系统级插件面板（全局插件，无应用上下文） -->
      <div v-if="activePlugin" class="page">
        <div class="page-header">
          <h1 class="page-title">{{ activePlugin.label }}</h1>
        </div>
        <PluginMount :load="activePlugin.load" :plugin-type="activePlugin.key.slice('plugin:'.length)" mode="system-menu" :refresh="() => undefined" />
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
  min-height: 100vh;
}

.sidebar {
  background: var(--atlas-surface);
  border-right: 1px solid var(--atlas-stroke);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid var(--atlas-stroke);
}

.brand-logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
}

.brand-name {
  font-weight: 700;
  font-size: 19px;
}

.menu {
  border-right: none;
  padding-top: 8px;
}

.sidebar {
  display: flex;
  flex-direction: column;
}

.sidebar-footer {
  margin-top: auto;
  padding: 12px 8px;
  border-top: 1px solid var(--atlas-stroke);
}

.logout-btn {
  width: 100%;
  justify-content: flex-start;
  color: var(--atlas-muted);
}

.menu-plugin-icon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.main {
  padding: 0;
  background: var(--atlas-bg);
}
</style>
