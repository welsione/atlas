<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VideoPlay, FolderOpened, InfoFilled } from '@element-plus/icons-vue'
import { pluginApi, type DefRow } from '../services/pluginApi'
import { iconOf, pluginIconUrl } from '../plugin-host/slotRegistry'
import { setPageHeadAction } from '../pageHead'

const rows = ref<DefRow[]>([])
const loading = ref(false)
const page = ref(1)
const size = ref(10)
const total = ref(0)

async function fetchAll() {
  loading.value = true
  try {
    const res = await pluginApi.listDefs(page.value, size.value)
    rows.value = res.rows
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function switchPage(p: number) {
  page.value = p
  fetchAll()
}

function switchSize(s: number) {
  size.value = s
  page.value = 1
  fetchAll()
}

onMounted(() => {
  fetchAll()
  setPageHeadAction({ label: '刷新', primary: false, onClick: () => void fetchAll() })
})

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
    <div class="surface">
      <el-table v-loading="loading" :data="rows" empty-text="暂无插件">
        <el-table-column label="插件" min-width="220">
          <template #default="{ row }">
            <div class="plugin-cell">
              <img
                v-if="pluginIconUrl(row.plugin.pluginType, iconOf(row.plugin.pluginType))"
                :src="pluginIconUrl(row.plugin.pluginType, iconOf(row.plugin.pluginType))!"
                class="plugin-icon"
                alt=""
              />
              <span class="plugin-name">{{ row.plugin.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="标识" width="150">
          <template #default="{ row }">
            <el-tooltip :content="`目录：${row.plugin.artifact}`" placement="top">
              <code class="mono">{{ row.plugin.pluginType }}</code>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="数据范围" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.plugin.defaultDataScope === 'GLOBAL_SHARED' ? 'warning' : 'success'">
              {{ row.plugin.defaultDataScope === 'GLOBAL_SHARED' ? '全局共享' : '应用独立' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="plugin.version" label="版本" width="90">
          <template #default="{ row }"><code class="mono">v{{ row.plugin.version }}</code></template>
        </el-table-column>
        <el-table-column prop="plugin.description" label="说明" min-width="240" show-overflow-tooltip />
        <el-table-column label="运行时" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.runtimeLoaded ? 'success' : 'info'">
              {{ row.runtimeLoaded ? '已加载' : '未加载' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-tooltip v-if="row.runtimeLoaded" content="卸载后实例与数据保留，重新集成可恢复" placement="top">
              <el-button size="small" plain :icon="VideoPlay" @click="handleUnload(row)">卸载</el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-size="size"
          :page-sizes="[10, 20, 50]"
          :current-page="page"
          @current-change="switchPage"
          @size-change="switchSize"
        />
      </div>
    </div>

    <div class="install-hint">
      <el-icon class="hint-icon"><FolderOpened /></el-icon>
      <span>新增插件：在 <code class="mono">plugins/</code> 目录放入一个含 <code class="mono">manifest.json</code> 与 <code class="mono">src/index.ts</code> 的目录（参考 <code class="mono">template/</code>），约 10 秒后自动热加载。</span>
      <el-tooltip content="修改插件后按需手动全量重载（POST /api/plugins/reload）" placement="top">
        <el-icon class="hint-icon"><InfoFilled /></el-icon>
      </el-tooltip>
    </div>
  </div>
</template>

<style scoped>
.plugin-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugin-icon {
  width: 24px;
  height: 24px;
  border-radius: var(--atlas-r-s);
  flex-shrink: 0;
}

.plugin-name {
  font-weight: 600;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
}

.install-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: var(--atlas-r-m);
  background: var(--atlas-surface);
  border: 1px dashed var(--atlas-stroke);
  color: var(--atlas-muted);
  font-size: 13px;
}

.hint-icon {
  flex-shrink: 0;
  color: var(--atlas-accent);
}
</style>
