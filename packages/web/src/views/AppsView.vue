<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Key, SwitchButton, CircleCheck, Delete, ArrowRight, CopyDocument, Lock, Check, InfoFilled } from '@element-plus/icons-vue'
import { appApi } from '../services/appApi'
import { pluginApi } from '../services/pluginApi'
import { iconOf, pluginIconUrl } from '../plugin-host/slotRegistry'
import type { App, PluginDef } from '../types'

const emit = defineEmits<{ (e: 'open-space', app: App): void }>()

const apps = ref<App[]>([])
const loading = ref(false)
const createVisible = ref(false)
const createName = ref('')
const createDesc = ref('')
const creating = ref(false)
const secretDialog = ref(false)
const secretText = ref('')
/** 插件勾选（创建应用时实例化哪些插件）：默认全选。 */
const pluginDefs = ref<PluginDef[]>([])
const selectedPlugins = ref<string[]>([])

async function fetchAll() {
  loading.value = true
  try {
    apps.value = await appApi.list()
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

async function openCreate() {
  createVisible.value = true
  if (pluginDefs.value.length === 0) {
    try {
      pluginDefs.value = (await pluginApi.listDefs()).map((r) => r.plugin)
      selectedPlugins.value = pluginDefs.value.map((p) => p.pluginType)
    } catch {
      pluginDefs.value = []
    }
  }
}

async function handleCreate() {
  if (!createName.value.trim()) {
    ElMessage.warning('请填写应用名称')
    return
  }
  creating.value = true
  try {
    const result = await appApi.create(createName.value.trim(), createDesc.value, selectedPlugins.value)
    secretText.value = result.secret
    secretDialog.value = true
    createVisible.value = false
    createName.value = ''
    createDesc.value = ''
    await fetchAll()
  } finally {
    creating.value = false
  }
}

async function handleRotate(app: App) {
  try {
    await ElMessageBox.confirm(`轮换后新凭证生效，旧凭证保留可校验。确认轮换「${app.name}」？`, '轮换凭证', { type: 'warning' })
    const result = await appApi.rotate(app.id)
    secretText.value = result.secret
    secretDialog.value = true
    await fetchAll()
  } catch {
    // 取消
  }
}

async function handleRevoke(app: App) {
  try {
    await ElMessageBox.confirm(`吊销后应用凭证全部失效，令牌即时作废。确认吊销「${app.name}」？`, '吊销应用', { type: 'error' })
    await appApi.revoke(app.id)
    ElMessage.success('已吊销')
    await fetchAll()
  } catch {
    // 取消
  }
}

async function handleActivate(app: App) {
  await appApi.activate(app.id)
  ElMessage.success('已恢复')
  await fetchAll()
}

async function handleRemove(app: App) {
  try {
    await ElMessageBox.confirm(`删除应用将级联清理其全部数据。确认删除「${app.name}」？`, '删除应用', { type: 'error' })
    await appApi.remove(app.id)
    ElMessage.success('已删除')
    await fetchAll()
  } catch {
    // 取消
  }
}

function statusTag(status: string) {
  return status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : 'danger'
}

function statusLabel(status: string) {
  return status === 'ACTIVE' ? '正常' : status === 'PAUSED' ? '暂停' : '已吊销'
}

function copySecret() {
  navigator.clipboard?.writeText(secretText.value)
  ElMessage.success('已复制')
}

async function copyAppId(appId: string) {
  await navigator.clipboard?.writeText(appId)
  ElMessage.success('App ID 已复制')
}

function togglePlugin(pluginType: string) {
  const idx = selectedPlugins.value.indexOf(pluginType)
  if (idx >= 0) selectedPlugins.value.splice(idx, 1)
  else selectedPlugins.value.push(pluginType)
}

function selectAllPlugins() {
  selectedPlugins.value = pluginDefs.value.map((p) => p.pluginType)
}

function clearPlugins() {
  selectedPlugins.value = []
}

function isPluginSelected(pluginType: string) {
  return selectedPlugins.value.includes(pluginType)
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">应用管理</h1>
        <p class="page-desc">应用为平台一级实体：一切数据、插件实例与数据集挂靠其上；凭证打包进应用，可轮换/吊销</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="createVisible = true">创建应用</el-button>
    </div>

    <div class="surface">
      <el-table v-loading="loading" :data="apps" empty-text="暂无应用，点击右上角创建">
        <el-table-column label="应用" min-width="240">
          <template #default="{ row }">
            <div class="app-cell">
              <span class="app-name">{{ row.name }}</span>
              <span class="app-id-row">
                <code class="mono">{{ row.appId }}</code>
                <el-tooltip content="复制 App ID" placement="top">
                  <el-button size="small" text :icon="CopyDocument" @click.stop="copyAppId(row.appId)" />
                </el-tooltip>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTag(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="凭证" width="90">
          <template #default="{ row }">
            <el-tooltip content="凭证仅在创建/轮换时展示一次，此界面不保存明文" placement="top">
              <el-icon class="cred-hint" :class="{ 'is-revoked': row.status === 'REVOKED' }"><Lock /></el-icon>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="330" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="进入应用空间" placement="top">
              <el-button size="small" type="primary" :icon="ArrowRight" @click="emit('open-space', row)">进入空间</el-button>
            </el-tooltip>
            <el-tooltip v-if="row.status === 'ACTIVE'" content="轮换后新凭证生效，旧凭证保留可校验" placement="top">
              <el-button size="small" :icon="Key" @click="handleRotate(row)">轮换</el-button>
            </el-tooltip>
            <el-tooltip v-if="row.status === 'ACTIVE'" content="吊销后凭证全部失效，令牌即时作废" placement="top">
              <el-button size="small" type="danger" plain :icon="SwitchButton" @click="handleRevoke(row)">吊销</el-button>
            </el-tooltip>
            <el-tooltip v-else-if="row.status === 'REVOKED'" content="恢复 ACTIVE 状态，需重新配置凭证" placement="top">
              <el-button size="small" type="success" plain :icon="CircleCheck" @click="handleActivate(row)">恢复</el-button>
            </el-tooltip>
            <el-tooltip content="删除应用将级联清理其全部数据，不可恢复" placement="top">
              <el-button size="small" type="danger" :icon="Delete" circle @click="handleRemove(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 创建应用（右侧抽屉） -->
    <el-drawer v-model="createVisible" title="创建应用" direction="rtl" size="560px" @open="openCreate">
      <el-form label-position="top" class="create-form">
        <el-form-item label="名称" required>
          <el-input v-model="createName" placeholder="应用名称" maxlength="40" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createDesc" type="textarea" :rows="1" placeholder="可选" />
        </el-form-item>
        <el-form-item label="实例化插件">
          <div class="plugin-picker">
            <div class="picker-toolbar">
              <div class="picker-hint">
                <span>选择创建后自动实例化的插件</span>
                <span class="picker-sub">可后续在应用空间启用/停用</span>
              </div>
            </div>

            <div v-if="selectedPlugins.length === 0 && pluginDefs.length" class="picker-empty-warn">
              <el-icon><InfoFilled /></el-icon><span>未勾选任何插件：应用创建后不预装插件，可在应用空间随时启用</span>
            </div>

            <div v-if="pluginDefs.length" class="picker-grid">
              <div
                v-for="p in pluginDefs"
                :key="p.pluginType"
                class="plugin-card"
                :class="{ 'is-selected': isPluginSelected(p.pluginType) }"
                role="checkbox"
                :aria-checked="isPluginSelected(p.pluginType)"
                tabindex="0"
                @click="togglePlugin(p.pluginType)"
                @keydown.enter.space.prevent="togglePlugin(p.pluginType)"
              >
                <span class="card-check" :class="{ 'is-empty': !isPluginSelected(p.pluginType) }">
                  <el-icon v-if="isPluginSelected(p.pluginType)"><Check /></el-icon>
                </span>
                <div class="card-main">
                  <span class="card-icon-box">
                    <img
                      v-if="pluginIconUrl(p.pluginType, iconOf(p.pluginType))"
                      :src="pluginIconUrl(p.pluginType, iconOf(p.pluginType))!"
                      class="card-icon"
                      alt=""
                    />
                  </span>
                  <div class="card-text">
                    <div class="card-title-row">
                      <span class="card-name">{{ p.name }}</span>
                      <el-tag size="small" :type="p.defaultDataScope === 'GLOBAL_SHARED' ? 'warning' : 'success'" class="card-scope">
                        {{ p.defaultDataScope === 'GLOBAL_SHARED' ? '全局共享' : '应用独立' }}
                      </el-tag>
                    </div>
                    <el-tooltip v-if="p.description" :content="p.description" placement="top">
                      <p class="card-desc">{{ p.description }}</p>
                    </el-tooltip>
                    <p v-else class="card-desc muted">暂无说明</p>
                    <code class="mono card-type">{{ p.pluginType }}</code>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="picker-empty">
              <span>暂无已注册插件，应用创建后可在应用空间单独启用</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="drawer-footer">
          <span class="drawer-count" :class="{ 'is-zero': selectedPlugins.length === 0 }">已选 {{ selectedPlugins.length }} 项 / 共 {{ pluginDefs.length }}</span>
          <div class="drawer-actions">
            <el-button size="small" text type="primary" :disabled="selectedPlugins.length === pluginDefs.length" @click="selectAllPlugins">全选</el-button>
            <el-button size="small" text :disabled="selectedPlugins.length === 0" @click="clearPlugins">清空</el-button>
            <el-divider direction="vertical" />
            <el-button @click="createVisible = false">取消</el-button>
            <el-tooltip :content="selectedPlugins.length === 0 ? '不实例化任何插件，仅创建应用' : `自动创建 ${selectedPlugins.length} 个插件实例`" placement="top">
              <el-button type="primary" :loading="creating" @click="handleCreate">
                创建应用<el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </template>
    </el-drawer>

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
.app-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-name {
  font-weight: 600;
}

.app-id-row {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.cred-hint {
  color: var(--aibase-muted);
  font-size: 16px;
}

.cred-hint.is-revoked {
  color: #f56c6c;
}

.plugin-picker {
  width: 100%;
}

.picker-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.picker-hint {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.picker-sub {
  font-size: 12px;
  color: var(--aibase-muted);
}

.picker-empty-warn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(79, 110, 247, 0.05);
  border: 1px solid rgba(79, 110, 247, 0.18);
  color: var(--aibase-muted);
  font-size: 12px;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
  padding: 2px;
  min-width: 0;
  width: 100%;
}

.plugin-card {
  position: relative;
  display: flex;
  align-items: stretch;
  min-height: 84px;
  border: 1px solid var(--aibase-stroke);
  border-radius: 10px;
  background: var(--aibase-surface);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  user-select: none;
}

.plugin-card:hover {
  border-color: rgba(79, 110, 247, 0.45);
  box-shadow: 0 2px 8px rgba(79, 110, 247, 0.08);
}

.plugin-card:focus-visible {
  outline: 2px solid var(--aibase-accent);
  outline-offset: 1px;
}

.plugin-card.is-selected {
  border-color: var(--aibase-accent);
  background: rgba(79, 110, 247, 0.05);
  box-shadow: 0 0 0 1px var(--aibase-accent) inset;
}

.card-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--aibase-accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.card-check.is-empty {
  background: transparent;
  border: 1px solid var(--aibase-stroke);
}

.card-main {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 26px 10px 10px;
  min-width: 0;
  width: 100%;
}

.card-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--aibase-bg);
  border: 1px solid var(--aibase-stroke);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.plugin-card.is-selected .card-icon-box {
  border-color: rgba(79, 110, 247, 0.4);
}

.card-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.card-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.card-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-scope {
  flex-shrink: 0;
}

.card-desc {
  margin: 0;
  font-size: 12px;
  color: var(--aibase-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-desc.muted {
  color: var(--aibase-muted);
  opacity: 0.7;
}

.card-type {
  color: var(--aibase-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.picker-empty {
  padding: 28px 16px;
  text-align: center;
  color: var(--aibase-muted);
  font-size: 13px;
  border: 1px dashed var(--aibase-stroke);
  border-radius: 10px;
}

.create-form {
  padding-right: 4px;
}

.create-form .el-form-item {
  margin-bottom: 14px;
}

.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.drawer-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--aibase-accent);
  background: rgba(79, 110, 247, 0.07);
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
}

.drawer-count.is-zero {
  color: var(--aibase-muted);
  background: var(--aibase-bg);
}

.drawer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.drawer-actions .el-divider {
  margin: 0 4px;
}
</style>
