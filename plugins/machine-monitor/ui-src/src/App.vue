<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Refresh, Monitor, Cpu, Histogram, Odometer, DataLine } from '@element-plus/icons-vue'
import { get } from '@atlas/runtime'

const props = defineProps({ appId: { type: Number, default: null }, mode: { type: String, default: '' } })

/** 详情模式：系统级侧边菜单面板（system-menu）或应用空间 Tab（appId 存在）。 */
const DETAILED = computed(() => props.mode === 'system-menu' || (props.appId != null && props.appId !== undefined))
const base = () => `/api/apps/${resolvedAppId.value ?? props.appId}/plugins/machine-monitor/ep`

const loading = ref(false)
const error = ref('')
const lastUpdated = ref('')
const host = ref(null)
const sample = ref(null)
const history = ref([])
const processes = ref([])
const autoRefresh = ref(true)
const resolvedAppId = ref(null)

let timer = null

// ---------- 工具 ----------
const byteFmt = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
const fmtBytes = (b) => {
  if (b == null) return '—'
  const v = Number(b)
  if (v >= 1073741824) return `${byteFmt.format(v / 1073741824)} GB`
  if (v >= 1048576) return `${byteFmt.format(v / 1048576)} MB`
  if (v >= 1024) return `${byteFmt.format(v / 1024)} KB`
  return `${v} B`
}
const fmtUptime = (s) => {
  if (s == null) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d > 0 ? `${d}天${h}时` : h > 0 ? `${h}时${m}分` : `${m}分`
}
/** 用量分档色：一律引用 --atlas-* token（内联样式同样生效）。 */
const colorOf = (p) => (p == null ? 'var(--atlas-muted)' : p >= 85 ? 'var(--atlas-danger)' : p >= 60 ? 'var(--atlas-warning)' : 'var(--atlas-success)')
const pctText = (p) => (p == null ? '—' : `${p}%`)

/** 北京时间格式化（采样存储为 UTC ISO，展示统一转 Asia/Shanghai）。 */
const TZ = { timeZone: 'Asia/Shanghai', hour12: false }
const fmtTime = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n) => String(n).padStart(2, '0')
  const parts = new Intl.DateTimeFormat('zh-CN', { ...TZ, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d)
  const get = (t) => parts.find((x) => x.type === t)?.value ?? ''
  return `${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}
const fmtClock = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const parts = new Intl.DateTimeFormat('zh-CN', { ...TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d)
  const get = (t) => parts.find((x) => x.type === t)?.value ?? ''
  return `${get('hour')}:${get('minute')}:${get('second')}`
}

// ---------- 数据 ----------
async function resolveApp() {
  if (resolvedAppId.value != null) return true
  try {
    // /api/apps 兼容分页 {rows} 与数组两种形状（分页改造后为 {rows,total,page,size}）
    const res = await get('/api/apps')
    const apps = Array.isArray(res) ? res : (res?.rows ?? [])
    if (apps.length > 0) {
      resolvedAppId.value = apps[0].id
      return true
    }
  } catch {
    // 未登录等
  }
  return false
}

let statusSeq = 0
async function fetchStatus() {
  if (!(await resolveApp())) return
  const ep = base()
  const seq = ++statusSeq
  try {
    const data = await get(ep + '/status')
    if (seq !== statusSeq) return // 手动刷新与 5s 轮询并发时旧响应丢弃
    host.value = data.host
    sample.value = data.sample
    lastUpdated.value = fmtClock()
    error.value = ''
  } catch (e) {
    if (seq === statusSeq) error.value = (e && e.message) || '采集失败'
  }
}

async function fetchHistory() {
  if (!(await resolveApp())) return
  try {
    history.value = await get(base() + '/history/24')
    samplePage.value = 1
  } catch {
    // 详情页可容忍历史失败
  }
}

async function fetchProcesses() {
  if (!(await resolveApp())) return
  try {
    processes.value = await get(base() + '/processes')
    procPage.value = 1
  } catch {
    // 尽力而为
  }
}

async function refreshAll() {
  loading.value = true
  try {
    await fetchStatus()
    if (DETAILED.value) {
      await Promise.all([fetchHistory(), fetchProcesses()])
    }
  } finally {
    loading.value = false
  }
}

// 趋势图：最多 96 个点（均值降采样）
const trend = computed(() => {
  const list = history.value
  if (list.length === 0) return { cpu: [], mem: [], disk: [] }
  const bucketCount = Math.min(96, list.length)
  const size = list.length / bucketCount
  const series = (key) =>
    Array.from({ length: bucketCount }, (_, i) => {
      const seg = list.slice(Math.floor(i * size), Math.floor((i + 1) * size))
      const vals = seg.map((s) => s[key]).filter((v) => v != null)
      if (vals.length === 0) return { v: null, ts: seg[0].ts }
      return { v: vals.reduce((a, b) => a + b, 0) / vals.length, ts: seg[0].ts }
    })
  return { cpu: series('cpu'), mem: series('memPercent'), disk: series('diskPercent') }
})
const trendMax = () => Math.max(1, ...trend.value.cpu.map((p) => p.v ?? 0), ...trend.value.mem.map((p) => p.v ?? 0), ...trend.value.disk.map((p) => p.v ?? 0))
const fmtTrendTime = (ts) => (ts ? new Intl.DateTimeFormat('zh-CN', { ...TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts)) : '')
/** 趋势图文本替代：最新非空采样值（可达性，规范 §8）。 */
const latestText = (key) => {
  const pts = trend.value[key] ?? []
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    if (pts[i].v != null) return `${fmtTrendTime(pts[i].ts)} ${pts[i].v.toFixed(1)}%`
  }
  return '暂无采样'
}

// 最近采样：全量倒序 + 前端分页（每页 10 条）
const SAMPLE_PAGE_SIZE = 10
const samplePage = ref(1)
const samplesDesc = computed(() => [...history.value].reverse())
const pagedSamples = computed(() => samplesDesc.value.slice((samplePage.value - 1) * SAMPLE_PAGE_SIZE, samplePage.value * SAMPLE_PAGE_SIZE))

// Top 进程：后端前 100 条 + 前端分页（每页 10 条）
const PROC_PAGE_SIZE = 10
const procPage = ref(1)
const pagedProcesses = computed(() => processes.value.slice((procPage.value - 1) * PROC_PAGE_SIZE, procPage.value * PROC_PAGE_SIZE))

// ---------- 生命周期 ----------
let tickCount = 0
onMounted(async () => {
  await refreshAll()
  timer = setInterval(async () => {
    tickCount += 1
    if (autoRefresh.value && (await resolveApp())) {
      await fetchStatus()
      // 5s tick × 12 ≈ 每分钟刷新一次历史与进程（原 getSeconds()%60 判断几乎永假）
      if (DETAILED.value && tickCount % 12 === 0) {
        await Promise.all([fetchHistory(), fetchProcesses()])
      }
    }
  }, 5000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <!-- ==================== 控制台卡片（无 appId 的紧凑模式） ==================== -->
  <div v-if="!DETAILED" class="card-mode">
    <div v-if="sample && host" class="card-grid">
      <div class="card-metric">
        <el-progress type="dashboard" :width="64" :stroke-width="6" :percentage="sample.cpu" :color="colorOf(sample.cpu)" :aria-label="`CPU 使用率 ${sample.cpu}%`" />
        <div class="metric-label">CPU</div>
      </div>
      <div class="card-metric">
        <el-progress type="dashboard" :width="64" :stroke-width="6" :percentage="sample.memPercent" :color="colorOf(sample.memPercent)" :aria-label="`内存使用率 ${sample.memPercent}%`" />
        <div class="metric-label">内存</div>
      </div>
      <div class="card-metric">
        <el-progress type="dashboard" :width="64" :stroke-width="6" :percentage="sample.diskPercent ?? 0" :color="colorOf(sample.diskPercent)" :aria-label="`磁盘使用率 ${sample.diskPercent ?? 0}%`" />
        <div class="metric-label">磁盘</div>
      </div>
      <div class="card-meta">
        <div class="meta-host" :title="host.hostname">{{ host.hostname }}</div>
        <div class="meta-line">负载 {{ sample.load1.toFixed(2) }}</div>
        <div class="meta-line">运行 {{ fmtUptime(sample.uptimeSeconds) }}</div>
        <div class="meta-line muted">{{ lastUpdated || '—' }}</div>
      </div>
    </div>
    <div v-else class="card-empty">
      {{ error || '正在采集指标…' }}
    </div>
  </div>

  <!-- ==================== 应用空间详情（有 appId 的完整模式） ==================== -->
  <div v-else class="detail-mode">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-switch v-model="autoRefresh" active-color="var(--atlas-accent)" active-text="自动刷新（5s）" size="small" aria-label="切换自动刷新" />
        <span v-if="lastUpdated" class="updated muted">最近更新 {{ lastUpdated }}</span>
      </div>
      <el-tooltip content="刷新监控数据" placement="top">
        <el-button :icon="Refresh" circle aria-label="刷新监控数据" :loading="loading" @click="refreshAll" />
      </el-tooltip>
    </div>

    <div v-if="error" class="error-bar">{{ error }}</div>

    <!-- 主机信息 -->
    <div v-if="host" class="surface section">
      <div class="section-title">主机信息</div>
      <div class="host-grid">
        <div class="host-item"><span class="muted">主机名</span><b>{{ host.hostname }}</b></div>
        <div class="host-item"><span class="muted">系统</span><b>{{ host.platform }} {{ host.release }}（{{ host.arch }}）</b></div>
        <div class="host-item"><span class="muted">CPU</span><b>{{ host.cores }} 核 · {{ host.cpuModel }}</b></div>
      </div>
    </div>

    <!-- 核心指标卡片 -->
    <div v-if="sample" class="stat-grid">
      <div class="stat-card surface">
        <el-icon class="stat-icon" aria-hidden="true"><Cpu /></el-icon>
        <div class="stat-num" :style="{ color: colorOf(sample.cpu) }">{{ pctText(sample.cpu) }}</div>
        <div class="stat-label">CPU 使用率</div>
      </div>
      <div class="stat-card surface">
        <el-icon class="stat-icon" aria-hidden="true"><Histogram /></el-icon>
        <div class="stat-num" :style="{ color: colorOf(sample.memPercent) }">{{ pctText(sample.memPercent) }}</div>
        <div class="stat-label">内存 {{ fmtBytes(sample.memUsed) }} / {{ fmtBytes(sample.memTotal) }}</div>
      </div>
      <div class="stat-card surface">
        <el-icon class="stat-icon" aria-hidden="true"><Odometer /></el-icon>
        <div class="stat-num">{{ sample.load1.toFixed(2) }}</div>
        <div class="stat-label">负载 1/5/15：{{ sample.load1.toFixed(2) }} / {{ sample.load5.toFixed(2) }} / {{ sample.load15.toFixed(2) }}</div>
      </div>
      <div class="stat-card surface">
        <el-icon class="stat-icon" aria-hidden="true"><Monitor /></el-icon>
        <div class="stat-num" :style="{ color: colorOf(sample.diskPercent) }">{{ pctText(sample.diskPercent) }}</div>
        <div class="stat-label">磁盘 {{ fmtBytes(sample.diskTotal) }} · 剩余 {{ fmtBytes(sample.diskFree) }}</div>
      </div>
      <div class="stat-card surface">
        <el-icon class="stat-icon" aria-hidden="true"><DataLine /></el-icon>
        <div class="stat-num">{{ fmtUptime(sample.uptimeSeconds) }}</div>
        <div class="stat-label">运行时长 · 进程 RSS {{ fmtBytes(sample.rss) }}</div>
      </div>
    </div>

    <!-- 趋势 -->
    <div class="surface section">
      <div class="section-title">近 24 小时趋势（分钟采样）</div>
      <div v-if="trend.cpu.length" class="trend-grid">
        <div v-for="t in [['cpu', 'CPU %', 'cpu'], ['mem', '内存 %', 'mem'], ['disk', '磁盘 %', 'disk']]" :key="t[0]" class="trend-box">
          <div class="trend-name">{{ t[1] }}</div>
          <div
            class="trend"
            role="img"
            :aria-label="`近 24 小时 ${t[1]} 趋势图，共 ${trend[t[2]].length} 个采样点，最新 ${latestText(t[2])}`"
          >
            <div v-for="(p, i) in trend[t[2]]" :key="i" class="trend-col" :title="`${fmtTrendTime(p.ts)}：${p.v == null ? '—' : p.v.toFixed(1)}%`">
              <div class="trend-bar" :style="{ height: `${(p.v ?? 0) / trendMax() * 100}%`, background: colorOf(p.v) }" />
            </div>
          </div>
          <div class="trend-latest muted">{{ latestText(t[2]) }}</div>
        </div>
      </div>
      <div v-else class="empty muted">暂无历史数据（控制台卡片或定时数据集刷新会自动采样）</div>
    </div>

    <div class="grid-2">
      <!-- 最近采样 -->
      <div class="surface section">
        <div class="section-title">最近采样（北京时间）</div>
        <el-table :data="pagedSamples" size="small" empty-text="暂无采样记录">
          <el-table-column label="时间" width="120">
            <template #default="{ row }">{{ fmtTime(row.ts) }}</template>
          </el-table-column>
          <el-table-column label="CPU" width="70">
            <template #default="{ row }"><span :style="{ color: colorOf(row.cpu) }">{{ row.cpu }}%</span></template>
          </el-table-column>
          <el-table-column label="内存" width="80">
            <template #default="{ row }"><span :style="{ color: colorOf(row.memPercent) }">{{ row.memPercent }}%</span></template>
          </el-table-column>
          <el-table-column label="磁盘" width="70">
            <template #default="{ row }">{{ row.diskPercent == null ? '—' : row.diskPercent + '%' }}</template>
          </el-table-column>
          <el-table-column label="负载" width="80">
            <template #default="{ row }">{{ row.load1.toFixed(2) }}</template>
          </el-table-column>
        </el-table>
        <div class="table-pager">
          <el-pagination
            layout="total, prev, pager, next"
            :total="samplesDesc.length"
            :page-size="SAMPLE_PAGE_SIZE"
            :current-page="samplePage"
            small
            @current-change="(p) => (samplePage = p)"
          />
        </div>
      </div>

      <!-- Top 进程 -->
      <div class="surface section">
        <div class="section-title">Top 进程（按 CPU）</div>
        <el-table :data="pagedProcesses" size="small" empty-text="暂无进程数据">
          <el-table-column prop="pid" label="PID" width="70" />
          <el-table-column prop="name" label="进程" min-width="140" show-overflow-tooltip />
          <el-table-column label="CPU" width="80">
            <template #default="{ row }"><span :style="{ color: colorOf(row.cpu) }">{{ row.cpu }}%</span></template>
          </el-table-column>
          <el-table-column label="MEM" width="80">
            <template #default="{ row }">{{ row.mem }}%</template>
          </el-table-column>
          <el-table-column label="RSS" width="90">
            <template #default="{ row }">{{ row.rssBytes == null ? '—' : fmtBytes(row.rssBytes) }}</template>
          </el-table-column>
        </el-table>
        <div class="table-pager">
          <el-pagination
            layout="total, prev, pager, next"
            :total="processes.length"
            :page-size="PROC_PAGE_SIZE"
            :current-page="procPage"
            small
            @current-change="(p) => (procPage = p)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.muted {
  color: var(--atlas-muted);
}

/* ---------- 控制台卡片 ---------- */
.card-mode {
  min-height: 96px;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  align-items: center;
}
.card-metric {
  text-align: center;
}
.metric-label {
  font-size: 11px;
  color: var(--atlas-muted);
  margin-top: 2px;
}
.card-meta {
  grid-column: 1 / -1;
  border-top: 1px dashed var(--atlas-stroke);
  margin-top: 6px;
  padding-top: 6px;
  font-size: 12px;
  line-height: 1.7;
}
.meta-host {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta-line {
  color: var(--atlas-text);
}
.card-empty {
  color: var(--atlas-muted);
  font-size: 12px;
  text-align: center;
  padding: 24px 0;
}

/* ---------- 详情模式 ---------- */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.updated {
  font-size: 12px;
}
.error-bar {
  background: var(--atlas-danger-weak);
  color: var(--atlas-danger);
  border-radius: var(--atlas-r-s);
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 13px;
}
.section {
  margin-bottom: 16px;
}
.section-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 12px;
}
.host-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 24px;
  font-size: 13px;
}
.host-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.host-item b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  padding: 16px;
  border-radius: var(--atlas-r-m);
}
.stat-icon {
  font-size: 20px;
  color: var(--atlas-accent);
  margin-bottom: 10px;
}
.stat-num {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 12px;
  color: var(--atlas-muted);
  margin-top: 4px;
}
.trend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.trend-name {
  font-size: 12px;
  color: var(--atlas-muted);
  margin-bottom: 8px;
}
.trend {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 96px;
}
.trend-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}
.trend-bar {
  width: 100%;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  opacity: 0.9;
}
.trend-latest {
  font-size: 11px;
  margin-top: 6px;
}
.grid-2 {
  display: grid;
  /* minmax(0,1fr)：1fr 默认 min-width:auto 会被卡内表格最小宽撑破容器（桌面中等宽度即溢出） */
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 720px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
  /* el-table 固定列宽合计（120+70+80+70+80+边距≈460px）超过手机容器宽，
     会把 grid 轨道撑破导致横向溢出：让表格在卡内横向滚动 */
  .grid-2 :deep(.el-table) {
    width: 100%;
  }
  .section {
    min-width: 0;
    overflow: hidden;
  }
  .section :deep(.el-table) {
    max-width: 100%;
  }
  .toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }
  .toolbar-left {
    flex-wrap: wrap;
  }
  .host-grid {
    grid-template-columns: 1fr;
  }
}

.table-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
}

.empty {
  font-size: 13px;
}
</style>
