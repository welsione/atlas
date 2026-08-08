<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh, Connection, DataLine, Select, CircleClose, User, Monitor } from '@element-plus/icons-vue'
import { monitorApi, type MonitorOverview, type MonitorRow, type MonitorRange } from '../../services/monitorApi'

const props = defineProps<{ appId: number }>()

const range = ref<MonitorRange>('24h')
const overview = ref<MonitorOverview>({
  total: 0, totalBytes: 0, notModified: 0, failures: 0, activeApps: 0, activeIps: 0,
})
const endpoints = ref<MonitorRow[]>([])
const topResources = ref<MonitorRow[]>([])
const topIps = ref<MonitorRow[]>([])
const topApps = ref<MonitorRow[]>([])
const recent = ref<MonitorRow[]>([])
const series = ref<MonitorRow[]>([])
const loading = ref(false)

async function fetchAll() {
  loading.value = true
  try {
    const r = range.value
    ;[overview.value, endpoints.value, topResources.value, topIps.value, topApps.value, series.value] =
      await Promise.all([
        monitorApi.overview(props.appId, r),
        monitorApi.endpoints(props.appId, r),
        monitorApi.topResources(props.appId, r),
        monitorApi.topIps(props.appId, r),
        monitorApi.topApps(props.appId, r),
        monitorApi.series(props.appId, r),
      ])
    recent.value = await monitorApi.recent(props.appId)
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

function switchRange(r: MonitorRange) {
  range.value = r
  fetchAll()
}

const notModifiedRate = computed(() =>
  overview.value.total > 0 ? Math.round((overview.value.notModified / overview.value.total) * 100) : 0,
)
const failureRate = computed(() =>
  overview.value.total > 0 ? Math.round((overview.value.failures / overview.value.total) * 100) : 0,
)
const maxSeries = () => Math.max(1, ...series.value.map((s) => Number(s.count ?? 0)))
const fmtBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`)
const statusTag = (s: number) => (s >= 400 ? 'danger' : s === 304 ? 'warning' : 'success')
</script>

<template>
  <div>
    <div class="toolbar">
      <el-radio-group :model-value="range" @change="(v: string | number | boolean | undefined) => switchRange(v as MonitorRange)">
        <el-radio-button value="24h">24 小时</el-radio-button>
        <el-radio-button value="7d">7 天</el-radio-button>
        <el-radio-button value="all">全部</el-radio-button>
      </el-radio-group>
      <el-tooltip content="刷新" placement="bottom">
        <el-button :icon="Refresh" circle :loading="loading" @click="fetchAll" />
      </el-tooltip>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-grid">
      <el-tooltip content="数据面消费总调用次数" placement="top">
        <div class="stat-card surface"><el-icon class="stat-icon"><Connection /></el-icon><div class="stat-num">{{ overview.total }}</div><div class="stat-label">总调用</div></div>
      </el-tooltip>
      <el-tooltip content="响应体累计流量（不含 304）" placement="top">
        <div class="stat-card surface"><el-icon class="stat-icon"><DataLine /></el-icon><div class="stat-num">{{ fmtBytes(overview.totalBytes) }}</div><div class="stat-label">流量</div></div>
      </el-tooltip>
      <el-tooltip content="条件请求命中（304）占比，越高缓存越有效" placement="top">
        <div class="stat-card surface"><el-icon class="stat-icon"><Select /></el-icon><div class="stat-num">{{ overview.notModified }}（{{ notModifiedRate }}%）</div><div class="stat-label">304 命中</div></div>
      </el-tooltip>
      <el-tooltip content="4xx/5xx 失败请求数与占比" placement="top">
        <div class="stat-card surface"><el-icon class="stat-icon" :class="{ 'is-error': overview.failures > 0 }"><CircleClose /></el-icon><div class="stat-num" :class="{ 'is-error': overview.failures > 0 }">{{ overview.failures }}（{{ failureRate }}%）</div><div class="stat-label">失败</div></div>
      </el-tooltip>
      <el-tooltip content="携带有效应用令牌的消费方数量" placement="top">
        <div class="stat-card surface"><el-icon class="stat-icon"><User /></el-icon><div class="stat-num">{{ overview.activeApps }}</div><div class="stat-label">活跃消费应用</div></div>
      </el-tooltip>
      <el-tooltip content="去重后的客户端 IP 数量" placement="top">
        <div class="stat-card surface"><el-icon class="stat-icon"><Monitor /></el-icon><div class="stat-num">{{ overview.activeIps }}</div><div class="stat-label">活跃 IP</div></div>
      </el-tooltip>
    </div>

    <!-- 趋势 -->
    <div class="surface section">
      <div class="section-title">调用趋势（按小时）</div>
      <div class="trend">
        <div v-for="(s, i) in series" :key="i" class="trend-col" :title="`${s.bucket}：${s.count} 次`">
          <div class="trend-bar" :style="{ height: `${(Number(s.count) / maxSeries()) * 100}%` }" />
          <div class="trend-label">{{ String(s.bucket).slice(11, 13) }}时</div>
        </div>
        <div v-if="series.length === 0" class="empty">暂无数据</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- 端点分布 -->
      <div class="surface section">
        <div class="section-title">端点分布</div>
        <el-table :data="endpoints" size="small" empty-text="暂无">
          <el-table-column prop="endpoint" label="端点" show-overflow-tooltip />
          <el-table-column prop="count" label="调用" width="70" />
          <el-table-column prop="bytes" label="流量" width="80">
            <template #default="{ row }">{{ fmtBytes(Number(row.bytes)) }}</template>
          </el-table-column>
          <el-table-column prop="not_modified" label="304" width="60" />
          <el-table-column prop="failures" label="失败" width="60" />
        </el-table>
      </div>

      <!-- Top 资源 -->
      <div class="surface section">
        <div class="section-title">Top 资源</div>
        <el-table :data="topResources" size="small" empty-text="暂无">
          <el-table-column label="资源" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.name || `${row.resource_type}#${row.resource_id}` }}</template>
          </el-table-column>
          <el-table-column prop="count" label="调用" width="70" />
          <el-table-column prop="bytes" label="流量" width="80">
            <template #default="{ row }">{{ fmtBytes(Number(row.bytes)) }}</template>
          </el-table-column>
          <el-table-column prop="not_modified" label="304" width="60" />
        </el-table>
      </div>
    </div>

    <div class="grid-2">
      <!-- Top IP -->
      <div class="surface section">
        <div class="section-title">Top IP</div>
        <el-table :data="topIps" size="small" empty-text="暂无">
          <el-table-column prop="ip" label="IP" show-overflow-tooltip />
          <el-table-column prop="count" label="调用" width="80" />
          <el-table-column prop="bytes" label="流量" width="90">
            <template #default="{ row }">{{ fmtBytes(Number(row.bytes)) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Top 消费应用 -->
      <div class="surface section">
        <div class="section-title">Top 消费应用</div>
        <el-table :data="topApps" size="small" empty-text="暂无">
          <el-table-column label="消费方" min-width="120">
            <template #default="{ row }">{{ Number(row.app_id) === 0 ? '匿名 token' : `应用 #${row.app_id}` }}</template>
          </el-table-column>
          <el-table-column prop="count" label="调用" width="80" />
          <el-table-column prop="bytes" label="流量" width="90">
            <template #default="{ row }">{{ fmtBytes(Number(row.bytes)) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 最近调用 -->
    <div class="surface section">
      <div class="section-title">最近调用</div>
      <el-table :data="recent" size="small" empty-text="暂无">
        <el-table-column prop="accessed_at" label="时间" width="170" />
        <el-table-column prop="endpoint" label="端点" width="100" />
        <el-table-column label="资源" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name || `${row.resource_type}#${row.resource_id}` }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTag(Number(row.http_status))">{{ row.http_status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ip" label="IP" width="130" />
        <el-table-column label="流量" width="90">
          <template #default="{ row }">{{ fmtBytes(Number(row.bytes)) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  padding: 16px;
  border-radius: 12px;
}

.stat-icon {
  font-size: 18px;
  color: var(--aibase-accent);
  margin-bottom: 8px;
}

.stat-icon.is-error {
  color: #f56c6c;
}

.stat-num {
  font-size: 20px;
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

.section {
  margin-bottom: 16px;
}

.section-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 12px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.trend {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 100px;
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
  max-width: 18px;
  background: var(--aibase-accent);
  border-radius: 3px 3px 0 0;
  opacity: 0.85;
  flex: 1;
  min-height: 2px;
}

.trend-label {
  font-size: 10px;
  color: var(--aibase-muted);
  margin-top: 4px;
}

.empty {
  color: var(--aibase-muted);
  font-size: 13px;
}
</style>
