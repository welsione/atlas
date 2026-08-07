<script setup lang="ts">
import { ref } from 'vue'
import { Grid, Cpu, Lock, HomeFilled, Tools } from '@element-plus/icons-vue'
import ConsoleView from './views/ConsoleView.vue'
import AppsView from './views/AppsView.vue'
import AppSpaceView from './views/AppSpaceView.vue'
import PluginsAdminView from './views/PluginsAdminView.vue'
import SecurityView from './views/SecurityView.vue'
import OpsView from './views/OpsView.vue'
import type { App } from './types'

type MenuKey = 'console' | 'apps' | 'plugins' | 'security' | 'ops'

const current = ref<MenuKey>('console')
const activeApp = ref<App | null>(null)

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
  <el-container class="layout">
    <el-aside width="200px" class="sidebar">
      <div class="brand">
        <img src="/icons/huoshan.png" class="brand-logo" alt="AIBase" />
        <div>
          <div class="brand-name">AIBase</div>
          <div class="brand-sub">AI 服务基础平台</div>
        </div>
      </div>
      <el-menu :default-active="current" class="menu" @select="(i: string) => switchMenu(i as MenuKey)">
        <el-menu-item index="console">
          <el-icon><HomeFilled /></el-icon><span>控制台</span>
        </el-menu-item>
        <el-menu-item index="apps">
          <el-icon><Grid /></el-icon><span>应用管理</span>
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
    </el-aside>
    <el-main class="main">
      <AppSpaceView v-if="activeApp" :app="activeApp" @back="backToList" />
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
  background: var(--aibase-surface);
  border-right: 1px solid var(--aibase-stroke);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid var(--aibase-stroke);
}

.brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.brand-name {
  font-weight: 700;
  font-size: 15px;
}

.brand-sub {
  font-size: 11px;
  color: var(--aibase-muted);
}

.menu {
  border-right: none;
  padding-top: 8px;
}

.main {
  padding: 0;
  background: var(--aibase-bg);
}
</style>
