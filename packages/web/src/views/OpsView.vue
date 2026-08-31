<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
import { appApi } from '../services/appApi'
import { opsApi, type OpsLogRow, type OpsOverview } from '../services/opsApi'
import { setPageHeadAction } from '../pageHead'
import { fmtTime } from '../format'
import type { App } from '../types'

const apps = ref<App[]>([])
const rows = ref<OpsLogRow[]>([])
const total = ref(0)
const loading = ref(false)
const overview = ref<OpsOverview>({ levels: { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 }, byPlugin: [], hourly: [] })

const filters = ref<{ appId?: number; pluginType: string; level: string }>({
  appId: undefined,
  pluginType: '',
  level: '',
})
const page = ref(1)
const size = ref(10)

async function fetchOverview() {
  try {
    overview.value = await opsApi.overview()
  } catch {
    // 忽略
  }
}

async function fetchLogs() {
  loading.value = true
  try {
    const result = await opsApi.logs({
      appId: filters.value.appId,
      pluginType: filters.value.pluginType || undefined,
      level: filters.value.level || undefined,
      page: page.value,
      size: size.value,
    })
    rows.value = result.rows
    total.value = result.total
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    apps.value = (await appApi.list(1, 100)).rows
  } catch {
    // 未登录
  }
  await Promise.all([fetchLogs(), fetchOverview()])
  setPageHeadAction({ label: '刷新', primary: false, onClick: () => void search() })
})

function search() {
  page.value = 1
  fetchLogs()
}

function resetFilters() {
  filters.value = { appId: undefined, pluginType: '', level: '' }
  search()
}

function detailOf(row: OpsLogRow): string {
  try {
    const detail = JSON.parse(row.detailJson)
    const parts = Object.entries(detail).map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    return parts.length ? parts.join('，') : ''
  } catch {
    return ''
  }
}

function levelTag(level: string) {
  return level === 'ERROR' ? 'danger' : level === 'WARN' ? 'warning' : level === 'DEBUG' ? 'info' : 'success'
}

const maxHourly = () => Math.max(1, ...overview.value.hourly.map((h) => h.count))
const totalErrors = () => overview.value.byPlugin.reduce((s, p) => s + Number(p.errors ?? 0), 0)
</script>

<template>
  <div class="page">
    <!-- 概览 -->
    <div class="overview-grid">
      <div class="overview-card surface">
        <div class="ttl-row"><h2>级别分布</h2></div>
        <div class="level-row"><span class="level-dot info" />INFO <b>{{ overview.levels.INFO }}</b></div>
        <div class="level-row"><span class="level-dot warning" />WARN <b>{{ overview.levels.WARN }}</b></div>
        <div class="level-row"><span class="level-dot danger" />ERROR <b>{{ overview.levels.ERROR }}</b></div>
        <div class="level-row"><span class="level-dot faint" />DEBUG <b>{{ overview.levels.DEBUG }}</b></div>
      </div>
      <div class="overview-card surface">
        <div class="ttl-row"><h2>近 24h 趋势（共 {{ overview.hourly.reduce((s, h) => s + h.count, 0) }} 条，错误 {{ totalErrors() }}）</h2></div>
        <div v-if="overview.hourly.length" class="trend">
          <div v-for="(h, i) in overview.hourly" :key="i" class="trend-col" :title="`${h.bucket}：${h.count} 条（错误 ${h.errors}）`">
            <div class="trend-bar" :style="{ height: `${(h.count / maxHourly()) * 100}%` }" :class="{ 'is-error': h.errors > 0 }" />
            <div class="trend-label">{{ String(h.bucket).slice(11, 13) }}时</div>
          </div>
        </div>
        <div v-else class="trend-empty">近 24h 暂无工作日志</div>
      </div>
      <div class="overview-card surface">
        <div class="ttl-row"><h2>按插件（近 7 天）</h2></div>
        <div v-for="p in overview.byPlugin" :key="p.pluginType" class="plugin-row">
          <code class="mono">{{ p.pluginType || '平台' }}</code>
          <el-tag size="small" :type="p.errors > 0 ? 'danger' : 'info'">{{ p.count }} 条{{ p.errors > 0 ? ` / ${p.errors} 错` : '' }}</el-tag>
        </div>
        <div v-if="overview.byPlugin.length === 0" class="muted">暂无工作日志</div>
      </div>
    </div>

    <!-- 日志列表 -->
    <div class="surface filter-bar">
      <el-select v-model="filters.appId" placeholder="全部应用" clearable filterable style="width: 180px" @change="search">
        <el-option v-for="a in apps" :key="a.id" :label="a.name" :value="a.id" />
      </el-select>
      <el-input v-model="filters.pluginType" placeholder="插件类型" clearable style="width: 160px" @keyup.enter="search" @clear="search" />
      <el-select v-model="filters.level" placeholder="全部级别" clearable style="width: 130px" @change="search">
        <el-option label="INFO" value="INFO" />
        <el-option label="WARN" value="WARN" />
        <el-option label="ERROR" value="ERROR" />
        <el-option label="DEBUG" value="DEBUG" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-tooltip content="重置筛选" placement="top">
        <el-button :icon="RefreshLeft" aria-label="重置筛选" @click="resetFilters" />
      </el-tooltip>
    </div>

    <div class="surface">
      <el-table v-loading="loading" :data="rows" empty-text="暂无工作日志">
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="级别" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="levelTag(row.level)">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="应用" width="140">
          <template #default="{ row }">
            <span v-if="row.appId === 0" class="muted">平台</span>
            <span v-else>{{ apps.find((a) => a.id === row.appId)?.name || `#${row.appId}` }}</span>
          </template>
        </el-table-column>
        <el-table-column label="插件" width="140">
          <template #default="{ row }"><code class="mono">{{ row.pluginType || '—' }}</code></template>
        </el-table-column>
        <el-table-column prop="message" label="消息" min-width="240" show-overflow-tooltip />
        <el-table-column label="详情" min-width="180">
          <template #default="{ row }">
            <span class="muted detail-text">{{ detailOf(row) || '—' }}</span>
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
          @current-change="(p: number) => { page = p; fetchLogs() }"
          @size-change="(s: number) => { size = s; page = 1; fetchLogs() }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.overview-grid {
  display: grid;
  grid-template-columns: 260px 1fr 300px;
  gap: 16px;
  margin-bottom: 16px;
}

.overview-card {
  padding: 16px;
  border-radius: var(--atlas-r-m);
}

.level-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}

.level-row b {
  margin-left: auto;
}

.level-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.level-dot.info {
  background: var(--atlas-info);
}

/* DEBUG 与 INFO 文字不同，状态点用弱灰阶区分 */
.level-dot.faint {
  background: var(--atlas-faint);
}

.level-dot.warning {
  background: var(--atlas-warning);
}

.level-dot.danger {
  background: var(--atlas-danger);
}

.trend {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 96px;
}

.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.trend-bar {
  width: 100%;
  max-width: 22px;
  background: var(--atlas-accent);
  border-radius: 6px 6px 0 0;
  opacity: 0.85;
  flex: 1;
  min-height: 2px;
}

.trend-bar.is-error {
  background: var(--atlas-danger);
}

.trend-label {
  font-size: 11px;
  color: var(--atlas-muted);
  margin-top: 4px;
}

.plugin-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
}

.trend-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96px;
  color: var(--atlas-muted);
  font-size: 13px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border-radius: var(--atlas-r-m);
  margin-bottom: 16px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 0;
}

.muted {
  color: var(--atlas-muted);
}

.detail-text {
  font-size: 12px;
}
</style>
