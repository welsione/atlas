<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh, Connection, DataLine, Select, CircleClose, SetUp, TrendCharts } from '@element-plus/icons-vue'
import { monitorApi, type MonitorOverview, type MonitorRow, type MonitorRange, type MonitorInterfaceRow } from '../../services/monitorApi'
import { fmtTime } from '../../format'

const props = defineProps<{ appId: number; mode?: string; refresh?: () => void }>()

const monitorTab = ref('manage')

const range = ref<MonitorRange>('24h')
const overview = ref<MonitorOverview>({
  total: 0, totalBytes: 0, notModified: 0, failures: 0, activeApps: 0, activeIps: 0,
})
const series = ref<MonitorRow[]>([])
const loading = ref(false)

// 接口管理（分页 10/页）
const interfaces = ref<MonitorInterfaceRow[]>([])
const interfaceLoading = ref(false)
const ifPage = ref(1)
const ifSize = ref(10)
const ifTotal = ref(0)

// 流量分析各表独立分页
const endpoints = ref<MonitorRow[]>([])
const epPage = ref(1)
const epSize = ref(10)
const epTotal = ref(0)
const topResources = ref<MonitorRow[]>([])
const resPage = ref(1)
const resSize = ref(10)
const resTotal = ref(0)
const topIps = ref<MonitorRow[]>([])
const ipPage = ref(1)
const ipSize = ref(10)
const ipTotal = ref(0)
const topApps = ref<MonitorRow[]>([])
const appPage = ref(1)
const appSize = ref(10)
const appTotal = ref(0)
const recent = ref<MonitorRow[]>([])
const recPage = ref(1)
const recSize = ref(10)
const recTotal = ref(0)

// ---------- 接口管理 ----------

async function fetchInterfaces() {
  interfaceLoading.value = true
  try {
    const res = await monitorApi.interfaces(props.appId, ifPage.value, ifSize.value)
    interfaces.value = res.rows
    ifTotal.value = res.total
  } finally {
    interfaceLoading.value = false
  }
}

function switchInterfacePage(p: number) {
  ifPage.value = p
  fetchInterfaces()
}

const interfaceKindLabel = (k: string) =>
  ({ DATASET: '数据集', PLUGIN_EP: '插件端点', PUBLIC_FILE: '文件下载' } as Record<string, string>)[k] ?? k
const interfaceGroups = computed(() => {
  const order = ['PLUGIN_EP', 'DATASET', 'PUBLIC_FILE'] as const
  const map = new Map<string, { kind: string; label: string; rows: MonitorInterfaceRow[] }>()
  for (const r of interfaces.value) {
    let g = map.get(r.kind)
    if (!g) {
      g = { kind: r.kind, label: interfaceKindLabel(r.kind), rows: [] }
      map.set(r.kind, g)
    }
    g.rows.push(r)
  }
  return [...map.values()]
    .sort((a, b) => order.indexOf(a.kind as (typeof order)[number]) - order.indexOf(b.kind as (typeof order)[number]))
    .map((g) => ({ ...g, disabledCount: g.rows.filter((r) => !r.enabled).length }))
})

async function toggleInterface(row: MonitorInterfaceRow, enabled: boolean) {
  await monitorApi.setInterfaceEnabled(props.appId, row.kind, row.key, enabled)
  row.enabled = enabled
}

async function resetInterface(row: MonitorInterfaceRow) {
  await monitorApi.resetInterfaceRule(props.appId, row.kind, row.key)
  row.enabled = true
}

// ---------- 流量分析 ----------

async function fetchEndpoints() {
  const res = await monitorApi.endpoints(props.appId, range.value, epPage.value, epSize.value)
  endpoints.value = res.rows
  epTotal.value = res.total
}

async function fetchTopResources() {
  const res = await monitorApi.topResources(props.appId, range.value, resPage.value, resSize.value)
  topResources.value = res.rows
  resTotal.value = res.total
}

async function fetchTopIps() {
  const res = await monitorApi.topIps(props.appId, range.value, ipPage.value, ipSize.value)
  topIps.value = res.rows
  ipTotal.value = res.total
}

async function fetchTopApps() {
  const res = await monitorApi.topApps(props.appId, range.value, appPage.value, appSize.value)
  topApps.value = res.rows
  appTotal.value = res.total
}

async function fetchRecent() {
  const res = await monitorApi.recent(props.appId, recPage.value, recSize.value)
  recent.value = res.rows
  recTotal.value = res.total
}

async function fetchAll() {
  loading.value = true
  try {
    const r = range.value
    ;[overview.value, series.value] = await Promise.all([
      monitorApi.overview(props.appId, r),
      monitorApi.series(props.appId, r),
    ])
    await Promise.all([fetchEndpoints(), fetchTopResources(), fetchTopIps(), fetchTopApps(), fetchRecent()])
  } finally {
    loading.value = false
  }
}

function switchRange(r: MonitorRange) {
  range.value = r
  epPage.value = 1
  resPage.value = 1
  ipPage.value = 1
  appPage.value = 1
  fetchAll()
}

function switchTab(tab: string) {
  // MonitorPanel 的 Tab 是面板内部状态（不参与全局路由），会话内存态即可，无需持久化
  monitorTab.value = tab
}

onMounted(() => {
  fetchAll()
  fetchInterfaces()
})

const notModifiedRate = computed(() =>
  overview.value.total > 0 ? Math.round((overview.value.notModified / overview.value.total) * 100) : 0,
)
const failureRate = computed(() =>
  overview.value.total > 0 ? Math.round((overview.value.failures / overview.value.total) * 100) : 0,
)
const maxSeries = () => Math.max(1, ...series.value.map((s) => Number(s.count ?? 0)))
const byteFmt = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })
const fmtBytes = (b: number) => (b >= 1048576 ? `${byteFmt.format(b / 1048576)} MB` : b >= 1024 ? `${byteFmt.format(b / 1024)} KB` : `${b} B`)
const statusTag = (s: number) => (s >= 400 ? 'danger' : s === 304 ? 'warning' : 'success')
const methodTag = (m: string) => (m === 'GET' ? 'success' : m === 'POST' ? 'primary' : m === 'PUT' ? 'warning' : 'danger')
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
        <el-button :icon="Refresh" circle aria-label="刷新监控数据" :loading="loading" @click="fetchAll" />
      </el-tooltip>
    </div>

    <el-tabs :model-value="monitorTab" class="monitor-tabs" @tab-change="switchTab">
      <!-- ==================== 接口管理 ==================== -->
      <el-tab-pane name="manage">
        <template #label>
          <span class="tab-label"><el-icon aria-hidden="true"><SetUp /></el-icon>接口管理</span>
        </template>
        <div v-loading="interfaceLoading" class="if-list">
          <div v-for="group in interfaceGroups" :key="group.kind" class="plugin-card surface">
            <div class="plugin-card-head">
              <span class="plugin-name">{{ group.label }}</span>
              <span v-if="group.disabledCount > 0" class="disabled-badge">{{ group.disabledCount }} 个已停用</span>
              <div class="spacer" />
              <span class="muted">{{ group.rows.length }} 个对外接口</span>
            </div>
            <div class="ep-rows">
              <div
                v-for="ep in group.rows"
                :key="`${ep.kind}-${ep.key}`"
                class="ep-row"
                :class="{ 'is-disabled': !ep.enabled }"
              >
                <el-tag v-if="ep.method" size="small" :type="methodTag(ep.method)">{{ ep.method }}</el-tag>
                <el-tag v-else size="small" type="info">{{ ep.kind === 'DATASET' ? 'DS' : 'FILE' }}</el-tag>
                <div class="ep-main">
                  <div class="ep-line1">
                    <span v-if="ep.pluginName" class="ep-plugin">{{ ep.pluginName }}</span>
                    <code v-if="ep.pluginType" class="mono muted">{{ ep.pluginType }}</code>
                    <span v-if="ep.path" class="ep-path-label">/{{ ep.path }}</span>
                    <span v-else class="ep-path-label">{{ ep.name }}</span>
                    <span v-if="ep.summary" class="muted ep-summary" :title="ep.summary">{{ ep.summary }}</span>
                  </div>
                  <code v-if="ep.accessPath" class="mono ep-access" :title="ep.accessPath">{{ ep.accessPath }}</code>
                </div>
                <el-tag size="small" :type="ep.sensitivity === 'SECRET' ? 'danger' : ep.sensitivity === 'INTERNAL' ? 'warning' : 'success'">
                  {{ ep.sensitivity }}
                </el-tag>
                <span class="muted ep-stats" :title="`调用 ${ep.count} 次，失败 ${ep.failures}`">
                  {{ ep.count }} 次
                  <span v-if="ep.failures > 0" class="is-error">· {{ ep.failures }} 失败</span>
                </span>
                <span v-if="!ep.enabled" class="ep-disabled-tag">已停用</span>
                <div class="spacer" />
                <el-switch
                  :model-value="ep.enabled"
                  :loading="interfaceLoading"
                  inline-prompt
                  :aria-label="`启用或停用 ${ep.name || ep.path || '接口'}`"
                  style="--el-switch-on-color: var(--atlas-accent)"
                  @change="(v: string | number | boolean) => toggleInterface(ep, !!v)"
                />
                <el-button v-if="!ep.enabled" size="small" text type="warning" @click="resetInterface(ep)">恢复默认</el-button>
              </div>
            </div>
          </div>
          <el-empty v-if="!interfaceLoading && interfaces.length === 0" description="暂无对外暴露的接口" :image-size="80" />
          <div v-if="ifTotal > ifSize" class="pager">
            <el-pagination layout="total, prev, pager, next" :total="ifTotal" :page-size="ifSize" :current-page="ifPage" @current-change="switchInterfacePage" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ==================== 流量分析 ==================== -->
      <el-tab-pane name="analytics">
        <template #label>
          <span class="tab-label"><el-icon aria-hidden="true"><TrendCharts /></el-icon>流量分析</span>
        </template>

        <!-- 统计卡片 -->
        <div class="stat-grid">
          <el-tooltip content="数据面消费总调用次数" placement="top">
            <div class="stat-card surface"><el-icon class="stat-icon" aria-hidden="true"><Connection /></el-icon><div class="stat-num">{{ overview.total }}</div><div class="stat-label">总调用</div></div>
          </el-tooltip>
          <el-tooltip content="响应体累计流量（不含 304）" placement="top">
            <div class="stat-card surface"><el-icon class="stat-icon" aria-hidden="true"><DataLine /></el-icon><div class="stat-num">{{ fmtBytes(overview.totalBytes) }}</div><div class="stat-label">流量</div></div>
          </el-tooltip>
          <el-tooltip content="条件请求命中（304）占比，越高缓存越有效" placement="top">
            <div class="stat-card surface"><el-icon class="stat-icon" aria-hidden="true"><Select /></el-icon><div class="stat-num">{{ overview.notModified }}（{{ notModifiedRate }}%）</div><div class="stat-label">304 命中</div></div>
          </el-tooltip>
          <el-tooltip content="4xx/5xx 失败请求数与占比" placement="top">
            <div class="stat-card surface"><el-icon class="stat-icon" :class="{ 'is-error': overview.failures > 0 }" aria-hidden="true"><CircleClose /></el-icon><div class="stat-num" :class="{ 'is-error': overview.failures > 0 }">{{ overview.failures }}（{{ failureRate }}%）</div><div class="stat-label">失败</div></div>
          </el-tooltip>
        </div>

        <!-- 趋势 -->
        <div class="surface section">
          <div class="ttl-row"><h2>调用趋势（按小时）</h2></div>
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
            <div class="ttl-row"><h2>端点分布</h2></div>
            <el-table :data="endpoints" size="small" empty-text="暂无">
              <el-table-column prop="endpoint" label="端点" show-overflow-tooltip />
              <el-table-column prop="count" label="调用" width="70" />
              <el-table-column prop="bytes" label="流量" width="80">
                <template #default="{ row }">{{ fmtBytes(Number(row.bytes)) }}</template>
              </el-table-column>
              <el-table-column prop="failures" label="失败" width="60" />
            </el-table>
            <div v-if="epTotal > epSize" class="pager">
              <el-pagination layout="total, prev, pager, next" :total="epTotal" :page-size="epSize" :current-page="epPage" @current-change="(p: number) => { epPage = p; fetchEndpoints() }" />
            </div>
          </div>

          <!-- Top 资源 -->
          <div class="surface section">
            <div class="ttl-row"><h2>Top 资源</h2></div>
            <el-table :data="topResources" size="small" empty-text="暂无">
              <el-table-column label="资源" min-width="120" show-overflow-tooltip>
                <template #default="{ row }">{{ row.name || `${row.resource_type}#${row.resource_id}` }}</template>
              </el-table-column>
              <el-table-column prop="count" label="调用" width="70" />
              <el-table-column prop="bytes" label="流量" width="80">
                <template #default="{ row }">{{ fmtBytes(Number(row.bytes)) }}</template>
              </el-table-column>
            </el-table>
            <div v-if="resTotal > resSize" class="pager">
              <el-pagination layout="total, prev, pager, next" :total="resTotal" :page-size="resSize" :current-page="resPage" @current-change="(p: number) => { resPage = p; fetchTopResources() }" />
            </div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Top IP -->
          <div class="surface section">
            <div class="ttl-row"><h2>Top IP</h2></div>
            <el-table :data="topIps" size="small" empty-text="暂无">
              <el-table-column prop="ip" label="IP" show-overflow-tooltip />
              <el-table-column prop="count" label="调用" width="80" />
              <el-table-column prop="bytes" label="流量" width="90">
                <template #default="{ row }">{{ fmtBytes(Number(row.bytes)) }}</template>
              </el-table-column>
            </el-table>
            <div v-if="ipTotal > ipSize" class="pager">
              <el-pagination layout="total, prev, pager, next" :total="ipTotal" :page-size="ipSize" :current-page="ipPage" @current-change="(p: number) => { ipPage = p; fetchTopIps() }" />
            </div>
          </div>

          <!-- Top 消费应用 -->
          <div class="surface section">
            <div class="ttl-row"><h2>Top 消费应用</h2></div>
            <el-table :data="topApps" size="small" empty-text="暂无">
              <el-table-column label="消费方" min-width="120">
                <template #default="{ row }">{{ Number(row.app_id) === 0 ? '匿名 token' : `应用 #${row.app_id}` }}</template>
              </el-table-column>
              <el-table-column prop="count" label="调用" width="80" />
              <el-table-column prop="bytes" label="流量" width="90">
                <template #default="{ row }">{{ fmtBytes(Number(row.bytes)) }}</template>
              </el-table-column>
            </el-table>
            <div v-if="appTotal > appSize" class="pager">
              <el-pagination layout="total, prev, pager, next" :total="appTotal" :page-size="appSize" :current-page="appPage" @current-change="(p: number) => { appPage = p; fetchTopApps() }" />
            </div>
          </div>
        </div>

        <!-- 最近调用 -->
        <div class="surface section">
          <div class="ttl-row"><h2>最近调用</h2></div>
          <el-table :data="recent" size="small" empty-text="暂无">
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ fmtTime(String(row.accessed_at ?? '')) }}</template>
            </el-table-column>
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
          <div v-if="recTotal > recSize" class="pager">
            <el-pagination layout="total, prev, pager, next" :total="recTotal" :page-size="recSize" :current-page="recPage" @current-change="(p: number) => { recPage = p; fetchRecent() }" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.tab-label .el-icon {
  color: var(--atlas-accent);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  padding: 16px;
  border-radius: var(--atlas-r-m);
}

.stat-icon {
  font-size: 18px;
  color: var(--atlas-accent);
  margin-bottom: 8px;
}

.stat-icon.is-error {
  color: var(--atlas-danger);
}

.stat-num {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--atlas-text);
}

.stat-num.is-error {
  color: var(--atlas-danger);
}

.stat-label {
  font-size: 12px;
  color: var(--atlas-muted);
  margin-top: 4px;
}

.section {
  margin-bottom: 16px;
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
  background: var(--atlas-accent);
  border-radius: 6px 6px 0 0;
  opacity: 0.85;
  flex: 1;
  min-height: 2px;
}

.trend-label {
  font-size: 11px;
  color: var(--atlas-muted);
  margin-top: 4px;
}

.empty {
  color: var(--atlas-muted);
  font-size: 13px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

/* ---------- 接口管理 ---------- */
.if-list {
  min-height: 120px;
}

.plugin-card {
  border-radius: var(--atlas-r-m);
  margin-bottom: 12px;
  padding: 12px 16px;
}

.plugin-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--atlas-stroke);
}

.plugin-name {
  font-weight: 600;
  font-size: 13px;
}

.disabled-badge {
  font-size: 11px;
  color: var(--atlas-danger);
  background: var(--atlas-danger-weak);
  border-radius: var(--atlas-r-s);
  padding: 1px 8px;
}

.spacer {
  flex: 1;
}

.ep-rows {
  display: flex;
  flex-direction: column;
}

.ep-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 4px;
  border-radius: var(--atlas-r-s);
  font-size: 13px;
}

.ep-row:hover {
  background: var(--atlas-layer);
}

.ep-row.is-disabled {
  opacity: 0.55;
  background: var(--atlas-danger-weak);
}

.ep-path {
  font-size: 12px;
}

.ep-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ep-line1 {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ep-plugin {
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
}

.ep-path-label {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--atlas-text);
  white-space: nowrap;
}

.ep-access {
  font-size: 11px;
  color: var(--atlas-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ep-summary {
  font-size: 12px;
  color: var(--atlas-muted);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 4px;
}

.ep-stats {
  font-size: 12px;
  flex-shrink: 0;
}

.ep-disabled-tag {
  font-size: 11px;
  color: var(--atlas-danger);
  border: 1px solid var(--atlas-danger-line);
  border-radius: var(--atlas-r-s);
  padding: 0 6px;
  flex-shrink: 0;
}

.muted {
  color: var(--atlas-muted);
}

.is-error {
  color: var(--atlas-danger);
}
</style>
