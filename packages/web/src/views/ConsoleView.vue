<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRight, Monitor, Cpu, Warning, List } from '@element-plus/icons-vue'
import { appApi } from '../services/appApi'
import { opsApi } from '../services/opsApi'
import { pluginApi } from '../services/pluginApi'
import PluginMount from '../plugin-host/PluginMount.vue'
import { useSlotsOf } from '../plugin-host/slotRegistry'
import type { App } from '../types'

const emit = defineEmits<{ (e: 'open-space', app: App): void }>()

const apps = ref<App[]>([])
const instanceCount = ref(0)
const overview = ref<{ levels: Record<string, number>; hourly: Array<{ bucket: string; count: number; errors: number }> }>({
  levels: { INFO: 0, WARN: 0, ERROR: 0 },
  hourly: [],
})

const consoleSlots = useSlotsOf('console')

onMounted(async () => {
  try {
    apps.value = await appApi.list()
    const counts = await Promise.all(apps.value.map((a) => pluginApi.overview(a.id).catch(() => [])))
    instanceCount.value = counts.reduce((s, rows) => s + rows.length, 0)
  } catch {
    // 未登录
  }
  try {
    overview.value = await opsApi.overview()
  } catch {
    // 运维台暂不可用
  }
})

const maxHourly = () => Math.max(1, ...overview.value.hourly.map((h) => h.count))
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">控制台</h1>
        <p class="page-desc">平台总览与插件服务卡片</p>
      </div>
    </div>

    <!-- 平台核心卡片 -->
    <div class="card-grid">
      <div class="stat-card" @click="apps[0] && emit('open-space', apps[0])">
        <el-icon class="stat-icon"><Monitor /></el-icon>
        <div class="stat-num">{{ apps.length }}</div>
        <div class="stat-label">应用总数</div>
      </div>
      <div class="stat-card">
        <el-icon class="stat-icon"><Cpu /></el-icon>
        <div class="stat-num">{{ instanceCount }}</div>
        <div class="stat-label">插件实例</div>
      </div>
      <div class="stat-card">
        <el-icon class="stat-icon"><Warning /></el-icon>
        <div class="stat-num" :class="{ 'is-error': overview.levels.ERROR > 0 }">{{ overview.levels.ERROR }}</div>
        <div class="stat-label">工作日志错误（近 7 天）</div>
      </div>
      <div class="stat-card">
        <el-icon class="stat-icon"><List /></el-icon>
        <div class="stat-num">{{ overview.hourly.reduce((s, h) => s + h.count, 0) }}</div>
        <div class="stat-label">近 24h 工作日志</div>
      </div>
    </div>

    <!-- 插件卡片区 -->
    <div class="section-title">
      <span>插件服务</span>
    </div>
    <div v-if="consoleSlots.length" class="card-grid plugin-cards">
      <div v-for="slot in consoleSlots" :key="slot.key" class="plugin-card surface">
        <PluginMount :load="slot.load" :plugin-type="slot.key.slice('plugin:'.length)" :refresh="() => undefined" />
      </div>
    </div>
    <div v-else class="empty-hint surface">
      当前没有插件注册控制台卡片。插件在 UI manifest 的 slots 中声明 slot: console 后生效。
    </div>
  </div>
</template>

<style scoped>
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--aibase-surface);
  border: 1px solid var(--aibase-stroke);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 22px;
  color: var(--aibase-accent);
  margin-bottom: 12px;
}

.stat-num {
  font-size: 28px;
  font-weight: 700;
}

.stat-num.is-error {
  color: #f56c6c;
}

.stat-label {
  font-size: 12px;
  color: var(--aibase-muted);
  margin-top: 4px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  margin: 8px 0 12px;
}

.plugin-card {
  padding: 16px;
  min-height: 120px;
}

.empty-hint {
  padding: 32px;
  text-align: center;
  color: var(--aibase-muted);
  border-radius: 12px;
}
</style>
