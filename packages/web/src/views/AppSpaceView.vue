<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Folder, DataLine, Collection, VideoPlay, VideoPause, Delete, Key, SwitchButton, CircleCheck, CopyDocument, Lock, Calendar } from '@element-plus/icons-vue'
import { appApi } from '../services/appApi'
import { pluginApi } from '../services/pluginApi'
import { setPageHeadAction } from '../pageHead'
import type { App, PluginOverviewRow } from '../types'
import PluginMount from '../plugin-host/PluginMount.vue'
import { registerCoreUi, useSlotsOf, toMountEntry, iconOf, pluginIconUrl } from '../plugin-host/slotRegistry'
import { copyText } from '../clipboard'

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

/** 应用本地副本：凭证操作后状态联动刷新。 */
const localApp = ref<App>({ ...props.app })
const secretDialog = ref(false)
const secretText = ref('')
const rotating = ref(false)

const activeTab = ref(localStorage.getItem('atlas-space-tab') || 'instances')
const overview = ref<PluginOverviewRow[]>([])
const loading = ref(false)
const page = ref(1)
const size = ref(10)
const total = ref(0)

const appSpaceSlots = useSlotsOf('app-space')

function statusTag(status: string) {
  return status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : 'danger'
}

function statusLabel(status: string) {
  return status === 'ACTIVE' ? '正常' : status === 'PAUSED' ? '暂停' : '已吊销'
}

async function copyAppId() {
  await copyText(localApp.value.appId, 'App ID ')
}

async function copySecret() {
  await copyText(secretText.value, '')
}

async function handleRotate() {
  try {
    await ElMessageBox.confirm(`轮换后新凭证生效，旧凭证保留可校验。确认轮换「${localApp.value.name}」？`, '轮换凭证', { type: 'warning' })
    rotating.value = true
    const result = await appApi.rotate(localApp.value.id)
    secretText.value = result.secret
    secretDialog.value = true
  } catch {
    // 取消
  } finally {
    rotating.value = false
  }
}

async function handleRevoke() {
  try {
    await ElMessageBox.confirm(`吊销后应用凭证全部失效，令牌即时作废。确认吊销「${localApp.value.name}」？`, '吊销应用', { type: 'error' })
    localApp.value = await appApi.revoke(localApp.value.id)
    ElMessage.success('已吊销')
  } catch {
    // 取消
  }
}

async function handleActivate() {
  localApp.value = await appApi.activate(localApp.value.id)
  ElMessage.success('已恢复')
}

async function handleRemove() {
  try {
    await ElMessageBox.confirm(`删除应用将级联清理其全部数据，不可恢复。确认删除「${localApp.value.name}」？`, '删除应用', { type: 'error' })
    await appApi.remove(localApp.value.id)
    ElMessage.success('已删除')
    emit('back')
  } catch {
    // 取消
  }
}

async function fetchOverview() {
  loading.value = true
  try {
    const res = await pluginApi.overview(props.app.id, page.value, size.value)
    overview.value = res.rows
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function switchPage(p: number) {
  page.value = p
  fetchOverview()
}

function switchSize(s: number) {
  size.value = s
  page.value = 1
  fetchOverview()
}

onMounted(() => {
  fetchOverview()
  setPageHeadAction({ label: '刷新', primary: false, onClick: () => void fetchOverview() })
})

function switchTab(tab: string) {
  activeTab.value = tab
  localStorage.setItem('atlas-space-tab', tab)
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
    <div class="space-bar">
      <el-tooltip content="返回应用列表" placement="bottom">
        <el-button :icon="Back" circle @click="emit('back')" />
      </el-tooltip>
      <el-tag size="small" :type="statusTag(localApp.status)">{{ statusLabel(localApp.status) }}</el-tag>
    </div>

    <!-- 应用信息与凭证操作 -->
    <div class="surface app-info">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">App ID</span>
          <span class="info-value">
            <code class="mono">{{ localApp.appId }}</code>
            <el-tooltip content="复制 App ID" placement="top">
              <el-button size="small" text :icon="CopyDocument" @click="copyAppId" />
            </el-tooltip>
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">App Secret</span>
          <span class="info-value">
            <el-icon class="secret-icon"><Lock /></el-icon>
            <span class="muted">仅创建/轮换时展示一次</span>
            <el-tooltip :content="localApp.status === 'ACTIVE' ? '轮换后新凭证生效，旧凭证保留可校验' : '应用已吊销，请先恢复'" placement="top">
              <el-button size="small" :icon="Key" :disabled="localApp.status !== 'ACTIVE'" :loading="rotating" @click="handleRotate">轮换凭证</el-button>
            </el-tooltip>
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">创建时间</span>
          <span class="info-value">
            <el-icon class="secret-icon"><Calendar /></el-icon>
            <span>{{ localApp.createdAt }}</span>
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">应用操作</span>
          <span class="info-value">
            <template v-if="localApp.status === 'ACTIVE'">
              <el-tooltip content="吊销后凭证全部失效，令牌即时作废" placement="top">
                <el-button size="small" type="danger" plain :icon="SwitchButton" @click="handleRevoke">吊销应用</el-button>
              </el-tooltip>
            </template>
            <el-tooltip v-else content="恢复 ACTIVE 状态，需重新配置凭证" placement="top">
              <el-button size="small" type="success" plain :icon="CircleCheck" @click="handleActivate">恢复应用</el-button>
            </el-tooltip>
            <el-tooltip content="删除应用将级联清理其全部数据，不可恢复" placement="top">
              <el-button size="small" type="danger" :icon="Delete" @click="handleRemove">删除应用</el-button>
            </el-tooltip>
          </span>
        </div>
      </div>
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
          <el-table v-loading="loading" :data="overview" empty-text="暂无已注册插件">            <el-table-column label="插件" min-width="200">
              <template #default="{ row }">
                <div class="plugin-cell">
                  <img
                    v-if="pluginIconUrl(row.plugin.pluginType, iconOf(row.plugin.pluginType))"
                    :src="pluginIconUrl(row.plugin.pluginType, iconOf(row.plugin.pluginType))!"
                    class="plugin-icon"
                    alt=""
                  />
                  <span class="plugin-name">{{ row.plugin.name }}</span>
                  <el-tag size="small" type="warning">外部</el-tag>
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
        <PluginMount v-if="activeTab === slot.key" :load="slot.load" :app-id="app.id" :plugin-type="slot.pluginType" mode="app-space" :refresh="fetchOverview" />
      </el-tab-pane>
    </el-tabs>

    <!-- 凭证展示（仅一次） -->
    <el-dialog v-model="secretDialog" title="应用凭证（仅展示一次，请立即保存）" width="560">
      <el-alert type="warning" :closable="false" title="此凭证仅在创建/轮换时展示一次，关闭后将无法再次查看。" style="margin-bottom: 12px" />
      <el-input :model-value="secretText" readonly>
        <template #append>
          <el-button @click="copySecret">复制</el-button>
        </template>
      </el-input>
      <template #footer>
        <el-button type="primary" @click="secretDialog = false">我已保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.space-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.app-info {
  margin-bottom: 14px;
  padding: 12px 18px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 10px 28px;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 13px;
}
.info-label {
  font-size: 12px;
  color: var(--atlas-muted);
  flex-shrink: 0;
  width: 76px;
}
.info-value {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}
.info-value code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.secret-icon {
  color: var(--atlas-muted);
  font-size: 14px;
  flex-shrink: 0;
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
  color: var(--atlas-accent);
}

.plugin-name {
  font-weight: 600;
}

.space-tabs {
  padding: 0 4px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
}
</style>
