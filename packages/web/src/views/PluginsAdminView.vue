<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, VideoPlay } from '@element-plus/icons-vue'
import { pluginApi } from '../services/pluginApi'
import type { PluginDef } from '../types'

type DefRow = { plugin: PluginDef; runtimeLoaded: boolean; runtimeArtifact: string }

const rows = ref<DefRow[]>([])
const loading = ref(false)

async function fetchAll() {
  loading.value = true
  try {
    rows.value = await pluginApi.listDefs()
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

async function handleUnload(row: DefRow) {
  try {
    await ElMessageBox.confirm(`卸载后插件实例与数据保留，重新集成可恢复。确认卸载「${row.plugin.name}」？`, '卸载插件', { type: 'warning' })
    await pluginApi.unload(row.plugin.pluginType)
    ElMessage.success('已卸载（数据保留）')
    await fetchAll()
  } catch {
    // 取消
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">插件注册表</h1>
        <p class="page-desc">平台级插件清单：内置保留字 + 外部目录插件（data/plugins/ 热加载，约 10 秒生效）</p>
      </div>
      <el-button :icon="Refresh" circle :loading="loading" @click="fetchAll" />
    </div>

    <div class="surface">
      <el-table v-loading="loading" :data="rows" empty-text="暂无插件">
        <el-table-column label="插件" min-width="180">
          <template #default="{ row }">
            <div class="plugin-cell">
              <span class="plugin-name">{{ row.plugin.name }}</span>
              <el-tag v-if="row.plugin.builtin" size="small" type="info">内置</el-tag>
              <el-tag v-else size="small" type="warning">外部</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="plugin.pluginType" label="类型" width="130">
          <template #default="{ row }"><code class="mono">{{ row.plugin.pluginType }}</code></template>
        </el-table-column>
        <el-table-column label="数据范围" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.plugin.defaultDataScope === 'GLOBAL_SHARED' ? 'warning' : 'success'">
              {{ row.plugin.defaultDataScope === 'GLOBAL_SHARED' ? '全局共享' : '应用独立' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="plugin.version" label="版本" width="90" />
        <el-table-column prop="plugin.artifact" label="来源" min-width="140">
          <template #default="{ row }">
            <code class="mono">{{ row.plugin.artifact || 'builtin' }}</code>
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
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!row.plugin.builtin && row.runtimeLoaded" size="small" type="danger" plain :icon="VideoPlay" @click="handleUnload(row)">卸载</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.plugin-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugin-name {
  font-weight: 600;
}
</style>
