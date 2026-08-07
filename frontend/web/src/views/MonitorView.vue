<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { monitorApi } from '../services/promptApi'

type Stats = {
  uploadBytes: number
  uploadCount: number
  downloadBytes: number
  downloadCount: number
  series: Array<{ bucket: string; uploadBytes: number; downloadBytes: number }>
}

type Overview = {
  cpuCores: number
  systemLoad: number
  processCpuPercent: number
  heapUsed: number
  heapMax: number
  threadCount: number
  uptimeSeconds: number
  systemTotalMemory: number
  systemFreeMemory: number
  diskTotal: number
  diskFree: number
  entryCount: number
  storedBytes: number
  dataDirBytes: number
  dbFileBytes: number
}

type TopRow = { fileId: number; name: string; count: number; totalBytes: number }
type TopIp = { ip: string; count: number; totalBytes: number }

const range = ref<'24h' | '7d' | 'all'>('24h')
const stats = ref<Stats | null>(null)
const overview = ref<Overview | null>(null)
const topDownloads = ref<TopRow[]>([])
const topUploads = ref<TopRow[]>([])
const topIps = ref<TopIp[]>([])
const loading = ref(false)

async function fetchAll() {
  loading.value = true
  try {
    stats.value = await monitorApi.stats(range.value)
    overview.value = await monitorApi.overview()
    const top = await monitorApi.top(range.value)
    topDownloads.value = top.topDownloadFiles
    topUploads.value = top.topUploadFiles
    topIps.value = top.topIps
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

const chart = computed(() => {
  const max = Math.max(1, ...(stats.value?.series ?? []).flatMap((p) => [p.uploadBytes, p.downloadBytes]))
  return (stats.value?.series ?? []).map((p) => ({
    label: p.bucket.slice(5),
    uploadPercent: (p.uploadBytes / max) * 100,
    downloadPercent: (p.downloadBytes / max) * 100,
  }))
})

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return bytes + ' B'
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}天${h}小时`
  if (h > 0) return `${h}小时${m}分`
  return `${m}分钟`
}

function memoryPercent(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100) : 0
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">控制台</h1>
        <p class="page-desc">上传/下载流量监控与服务器运行数据</p>
      </div>
      <div>
        <el-radio-group v-model="range" size="small" @change="fetchAll">
          <el-radio-button value="24h">24 小时</el-radio-button>
          <el-radio-button value="7d">7 天</el-radio-button>
          <el-radio-button value="all">全部</el-radio-button>
        </el-radio-group>
        <el-button :icon="Refresh" circle :loading="loading" @click="fetchAll" style="margin-left: 8px" />
      </div>
    </div>

    <div v-loading="loading" class="dashboard">
      <!-- 流量指标卡 -->
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">上传流量</div>
          <div class="metric-value">{{ formatBytes(stats?.uploadBytes ?? 0) }}</div>
          <div class="metric-sub">{{ stats?.uploadCount ?? 0 }} 次上传/更新</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">下载流量</div>
          <div class="metric-value accent">{{ formatBytes(stats?.downloadBytes ?? 0) }}</div>
          <div class="metric-sub">{{ stats?.downloadCount ?? 0 }} 次下载</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">JVM 堆内存</div>
          <div class="metric-value">{{ formatBytes(overview?.heapUsed ?? 0) }}</div>
          <div class="metric-sub">
            峰值 {{ formatBytes(overview?.heapMax ?? 0) }}（{{ memoryPercent(overview?.heapUsed ?? 0, overview?.heapMax ?? 0) }}%）
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-label">系统内存</div>
          <div class="metric-value">{{ formatBytes((overview?.systemTotalMemory ?? 0) - (overview?.systemFreeMemory ?? 0)) }}</div>
          <div class="metric-sub">共 {{ formatBytes(overview?.systemTotalMemory ?? 0) }}（{{ memoryPercent((overview?.systemTotalMemory ?? 0) - (overview?.systemFreeMemory ?? 0), overview?.systemTotalMemory ?? 0) }}%）</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">磁盘</div>
          <div class="metric-value">{{ formatBytes((overview?.diskTotal ?? 0) - (overview?.diskFree ?? 0)) }}</div>
          <div class="metric-sub">可用 {{ formatBytes(overview?.diskFree ?? 0) }} / 共 {{ formatBytes(overview?.diskTotal ?? 0) }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">运行时长</div>
          <div class="metric-value">{{ formatDuration(overview?.uptimeSeconds ?? 0) }}</div>
          <div class="metric-sub">{{ overview?.threadCount ?? 0 }} 线程 · {{ overview?.cpuCores ?? 0 }} 核 · 负载 {{ overview?.systemLoad ?? 0 }}</div>
        </div>
      </div>

      <!-- 存储 -->
      <div class="surface section">
        <p class="section-title">存储</p>
        <div class="storage-line">
          <span>文件条目 <b>{{ overview?.entryCount ?? 0 }}</b> 个，存储 {{ formatBytes(overview?.storedBytes ?? 0) }}</span>
          <span class="muted">数据目录 {{ formatBytes(overview?.dataDirBytes ?? 0) }}（含数据库 {{ formatBytes(overview?.dbFileBytes ?? 0) }}）</span>
        </div>
      </div>

      <!-- 流量趋势 -->
      <div class="surface section">
        <p class="section-title">流量趋势（{{ range === '24h' ? '按小时' : '按天' }}）</p>
        <div class="chart">
          <div class="chart-row" v-for="point in chart" :key="point.label">
            <span class="chart-label">{{ point.label }}</span>
            <div class="chart-bars">
              <div class="bar up" :style="{ width: point.uploadPercent + '%' }" title="上传" />
              <div class="bar down" :style="{ width: point.downloadPercent + '%' }" title="下载" />
            </div>
          </div>
          <div v-if="!chart.length" class="muted">暂无数据</div>
          <div class="chart-legend">
            <span class="legend up">上传</span>
            <span class="legend down">下载</span>
          </div>
        </div>
      </div>

      <!-- Top 排行 -->
      <div class="top-grid">
        <div class="surface section">
          <p class="section-title">下载 Top 文件</p>
          <el-table :data="topDownloads" empty-text="暂无" size="small">
            <el-table-column prop="name" label="文件" min-width="160" show-overflow-tooltip />
            <el-table-column prop="count" label="次数" width="70" />
            <el-table-column label="流量" width="100">
              <template #default="{ row }">{{ formatBytes(row.totalBytes) }}</template>
            </el-table-column>
          </el-table>
        </div>
        <div class="surface section">
          <p class="section-title">下载 Top IP</p>
          <el-table :data="topIps" empty-text="暂无" size="small">
            <el-table-column prop="ip" label="IP" min-width="140" />
            <el-table-column prop="count" label="次数" width="70" />
            <el-table-column label="流量" width="100">
              <template #default="{ row }">{{ formatBytes(row.totalBytes) }}</template>
            </el-table-column>
          </el-table>
        </div>
        <div class="surface section">
          <p class="section-title">上传 Top 文件</p>
          <el-table :data="topUploads" empty-text="暂无" size="small">
            <el-table-column prop="name" label="文件" min-width="160" show-overflow-tooltip />
            <el-table-column prop="count" label="次数" width="70" />
            <el-table-column label="流量" width="100">
              <template #default="{ row }">{{ formatBytes(row.totalBytes) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  background: var(--aibase-surface);
  border: 1px solid var(--aibase-stroke);
  border-radius: 10px;
  padding: 14px 16px;
}

.metric-label {
  font-size: 12px;
  color: #6e6e78;
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  margin: 6px 0 4px;
  font-variant-numeric: tabular-nums;
}

.metric-value.accent {
  color: var(--aibase-accent);
}

.metric-sub {
  font-size: 12px;
  color: #6e6e78;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #6e6e78;
  margin: 0 0 12px;
}

.storage-line {
  display: flex;
  gap: 24px;
  font-size: 13px;
  flex-wrap: wrap;
}

.chart-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.chart-label {
  width: 60px;
  font-size: 11px;
  color: #6e6e78;
  flex: none;
  font-variant-numeric: tabular-nums;
}

.chart-bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bar {
  height: 5px;
  border-radius: 3px;
  transition: width 0.3s;
}

.bar.up {
  background: #10b981;
}

.bar.down {
  background: var(--aibase-accent);
}

.chart-legend {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 12px;
  color: #6e6e78;
}

.legend::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 4px;
  vertical-align: -1px;
}

.legend.up::before {
  background: #10b981;
}

.legend.down::before {
  background: var(--aibase-accent);
}

.top-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
</style>
