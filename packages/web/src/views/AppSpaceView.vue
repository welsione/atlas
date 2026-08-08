<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Refresh, Folder, DataLine, Collection, VideoPlay, VideoPause, Delete } from '@element-plus/icons-vue'
import { pluginApi } from '../services/pluginApi'
import type { App, PluginOverviewRow } from '../types'
import PluginMount from '../plugin-host/PluginMount.vue'
import { registerCoreUi, useSlotsOf, toMountEntry, iconOf, pluginIconUrl } from '../plugin-host/slotRegistry'

// 框架能力面板（数据集）：懒加载 chunk + slot 静态注册，与插件 UI 同一渲染管线
registerCoreUi({
  slot: 'app-space',
  tab: '数据集',
  icon: Folder,
  load: async () => toMountEntry((await import('./panels/DatasetsPanel.vue')).default),
})

// 框架能力面板（接口监控，内置能力非插件）
registerCoreUi({
  slot: 'app-space',
  tab: '接口监控',
  icon: DataLine,
  load: async () => toMountEntry((await import('./panels/MonitorPanel.vue')).default),
})

const props = defineProps<{ app: App }>()
const emit = defineEmits<{ (e: 'back'): void }>()

const activeTab = ref(localStorage.getItem('aibase-space-tab') || 'instances')
const overview = ref<PluginOverviewRow[]>([])
const loading = ref(false)

const appSpaceSlots = useSlotsOf('app-space')

async function fetchOverview() {
  loading.value = true
  try {
    overview.value = await pluginApi.overview(props.app.id)
  } finally {
    loading.value = false
  }
}

onMounted(fetchOverview)

function switchTab(tab: string) {
  activeTab.value = tab
  localStorage.setItem('aibase-space-tab', tab)
}

async function handleEnable(row: PluginOverviewRow, scope?: string) {
  await pluginApi.enable(props.app.id, row.plugin.pluginType, scope)
  ElMessage.success('已启用')
  fetchOverview()
}

async function handleDisable(row: PluginOverviewRow) {
  await pluginApi.disable(props.app.id, row.plugin.pluginType)
  ElMessage.success('已停用（数据保留）')
  fetchOverview()
}

async function handleRemoveInstance(row: PluginOverviewRow) {
  try {
    await ElMessageBox.confirm(`删除实例将清理其通用存储数据；插件专用表数据保留为孤儿。确认删除「${row.plugin.name}」实例？`, '删除实例', { type: 'error' })
    await pluginApi.removeInstance(props.app.id, row.plugin.pluginType)
    ElMessage.success('实例已删除')
    fetchOverview()
  } catch {
    // 取消
  }
}

/** 单向规则：仅声明共享的插件可覆盖为独立。 */
function scopeOptions(row: PluginOverviewRow): { label: string; value: string }[] {
  const options = [
    { label: row.plugin.defaultDataScope === 'GLOBAL_SHARED' ? '全局共享' : '应用独立', value: row.plugin.defaultDataScope },
  ]
  if (row.plugin.defaultDataScope === 'GLOBAL_SHARED' && row.plugin.scopeOverrideAllowed) {
    options.push({ label: '覆盖为应用独立', value: 'APP_LOCAL' })
  }
  return options
}

function scopeLabel(row: PluginOverviewRow): string {
  if (!row.instance) return '—'
  return row.instance.dataScope === 'GLOBAL_SHARED' ? '全局共享' : '应用独立'
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="space-header">
        <el-tooltip content="返回应用列表" placement="bottom">
          <el-button :icon="Back" circle @click="emit('back')" />
        </el-tooltip>
        <div>
          <h1 class="page-title">{{ app.name }} <el-tag size="small" type="info">{{ app.appId }}</el-tag></h1>
          <p class="page-desc">{{ app.description || '应用空间：插件实例、插件数据、数据集发布与敏感凭证' }}</p>
        </div>
      </div>
      <el-tooltip content="刷新" placement="bottom">
        <el-button :icon="Refresh" circle :loading="loading" @click="fetchOverview" />
      </el-tooltip>
    </div>

    <el-tabs :model-value="activeTab" class="space-tabs" @tab-change="switchTab">
      <el-tab-pane name="instances">
        <template #label>
          <span class="tab-label">
            <el-icon class="core-tab-icon"><Collection /></el-icon>
            <span>插件实例</span>
          </span>
        </template>
        <div class="surface">
          <el-table v-loading="loading" :data="overview" empty-text="暂无已注册插件">
            <el-table-column label="插件" min-width="200">
              <template #default="{ row }">
                <div class="plugin-cell">
                  <img
                    v-if="pluginIconUrl(row.plugin.pluginType, iconOf(row.plugin.pluginType))"
                    :src="pluginIconUrl(row.plugin.pluginType, iconOf(row.plugin.pluginType))!"
                    class="plugin-icon"
                    alt=""
                  />
                  <span class="plugin-name">{{ row.plugin.name }}</span>
                  <el-tag v-if="row.plugin.builtin" size="small" type="info">内置</el-tag>
                  <el-tag v-else size="small" type="warning">外部</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="plugin.pluginType" label="类型" width="140">
              <template #default="{ row }"><code class="mono">{{ row.plugin.pluginType }}</code></template>
            </el-table-column>
            <el-table-column label="数据范围" width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="row.instance?.dataScope === 'GLOBAL_SHARED' ? 'warning' : 'success'">
                  {{ scopeLabel(row) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="plugin.description" label="说明" min-width="220" show-overflow-tooltip />
            <el-table-column label="运行时" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.runtimeLoaded ? 'success' : 'info'">
                  {{ row.runtimeLoaded ? '已加载' : '未加载' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="250" fixed="right">
              <template #default="{ row }">
                <template v-if="!row.instance || !row.instance.enabled">
                  <el-select v-if="!row.instance" size="small" :model-value="row.plugin.defaultDataScope" style="width: 110px" @change="(v: string) => handleEnable(row, v)">
                    <el-option v-for="opt in scopeOptions(row)" :key="opt.value" :value="opt.value" :label="opt.label" />
                  </el-select>
                  <el-tooltip :content="`按默认数据范围（${row.plugin.defaultDataScope === 'GLOBAL_SHARED' ? '全局共享' : '应用独立'}）启用实例`" placement="top">
                    <el-button size="small" type="primary" :icon="VideoPlay" @click="handleEnable(row)">启用</el-button>
                  </el-tooltip>
                </template>
                <template v-else>
                  <el-tooltip content="停用后端点与数据访问立即失效，数据保留可恢复" placement="top">
                    <el-button size="small" :icon="VideoPause" @click="handleDisable(row)">停用</el-button>
                  </el-tooltip>
                  <el-tooltip content="删除实例清理其通用存储；插件专用表数据保留" placement="top">
                    <el-button size="small" type="danger" plain :icon="Delete" @click="handleRemoveInstance(row)">删除实例</el-button>
                  </el-tooltip>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 框架能力面板（数据集 / 接口监控） -->
      <el-tab-pane v-for="slot in appSpaceSlots.filter((s) => s.key.startsWith('core:'))" :key="slot.key" :label="slot.label" :name="slot.key">
        <template #label>
          <span class="tab-label">
            <el-icon v-if="typeof slot.icon !== 'string' && slot.icon"><component :is="slot.icon" /></el-icon>
            <span>{{ slot.label }}</span>
          </span>
        </template>
        <PluginMount v-if="activeTab === slot.key" :load="slot.load" :app-id="app.id" :refresh="fetchOverview" />
      </el-tab-pane>

      <!-- 插件 UI 面板（内置/外部统一来自 jar） -->
      <el-tab-pane v-for="slot in appSpaceSlots.filter((s) => s.key.startsWith('plugin:'))" :key="slot.key" :name="slot.key">
        <template #label>
          <span class="tab-label">
            <img v-if="typeof slot.icon === 'string' && slot.icon" :src="slot.icon" class="tab-icon" alt="" />
            <span>{{ slot.label }}</span>
          </span>
        </template>
        <PluginMount v-if="activeTab === slot.key" :load="slot.load" :app-id="app.id" :plugin-type="slot.key.slice('plugin:'.length)" mode="app-space" :refresh="fetchOverview" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.space-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plugin-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugin-icon {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  flex-shrink: 0;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-icon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-label .el-icon,
.core-tab-icon {
  color: var(--aibase-accent);
}

.plugin-name {
  font-weight: 600;
}

.space-tabs {
  padding: 0 4px;
}
</style>
