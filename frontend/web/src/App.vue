<script setup lang="ts">
import { ref } from 'vue'
import { Cpu, ChatDotRound, SetUp, Files } from '@element-plus/icons-vue'
import ProvidersView from './views/ProvidersView.vue'
import PromptsView from './views/PromptsView.vue'
import PluginsView from './views/PluginsView.vue'
import ModelFilesView from './views/ModelFilesView.vue'

const current = ref(localStorage.getItem('aibase-tab') || 'providers')

function switchTab(tab: string) {
  current.value = tab
  localStorage.setItem('aibase-tab', tab)
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="200px" class="sidebar">
      <div class="brand">
        <img src="/icons/huoshan.png" class="brand-logo" alt="AIBase" />
        <div>
          <div class="brand-name">AIBase</div>
          <div class="brand-sub">AI 服务基础组件</div>
        </div>
      </div>
      <el-menu :default-active="current" class="menu" @select="switchTab">
        <el-menu-item index="providers">
          <el-icon><Cpu /></el-icon><span>供应商配置</span>
        </el-menu-item>
        <el-menu-item index="prompts">
          <el-icon><ChatDotRound /></el-icon><span>提示词管理</span>
        </el-menu-item>
        <el-menu-item index="model-files">
          <el-icon><Files /></el-icon><span>模型文件</span>
        </el-menu-item>
        <el-menu-item index="plugins">
          <el-icon><SetUp /></el-icon><span>插件</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main class="main">
      <ProvidersView v-if="current === 'providers'" />
      <PromptsView v-else-if="current === 'prompts'" />
      <ModelFilesView v-else-if="current === 'model-files'" />
      <PluginsView v-else-if="current === 'plugins'" />
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
