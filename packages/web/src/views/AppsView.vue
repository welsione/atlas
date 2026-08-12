<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, ArrowRight, Lock, Check, InfoFilled, Calendar } from '@element-plus/icons-vue'
import { appApi } from '../services/appApi'
import { pluginApi } from '../services/pluginApi'
import { iconOf, pluginIconUrl } from '../plugin-host/slotRegistry'
import { copyText } from '../clipboard'
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

function statusTag(status: string) {
  return status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : 'danger'
}

function statusLabel(status: string) {
  return status === 'ACTIVE' ? '正常' : status === 'PAUSED' ? '暂停' : '已吊销'
}

async function copySecret() {
  await copyText(secretText.value, '')
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
        <p class="page-desc">应用为平台一级实体：一切数据、插件实例与数据集挂靠其上；点击卡片进入应用空间</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="createVisible = true">创建应用</el-button>
    </div>

    <div v-loading="loading" class="app-grid">
      <div
        v-for="app in apps"
        :key="app.id"
        class="app-card"
        role="button"
        tabindex="0"
        @click="emit('open-space', app)"
        @keydown.enter.space.prevent="emit('open-space', app)"
      >
        <div class="card-head">
          <span class="app-name" :title="app.name">{{ app.name }}</span>
          <el-tag size="small" :type="statusTag(app.status)">{{ statusLabel(app.status) }}</el-tag>
          <div class="spacer" />
          <el-icon class="chevron"><ArrowRight /></el-icon>
        </div>

        <div v-if="app.description" class="app-desc" :title="app.description">{{ app.description }}</div>
        <div v-else class="app-desc muted">暂无描述</div>

        <div class="card-foot">
          <span class="muted foot-item">
            <el-icon><Calendar /></el-icon>
            {{ app.createdAt }}
          </span>
          <div class="spacer" />
          <span class="muted foot-tip">点击进入空间</span>
        </div>
      </div>

      <div v-if="!loading && apps.length === 0" class="empty-state">
        <el-empty description="暂无应用，点击右上角创建" :image-size="80" />
      </div>
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
.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
  min-height: 120px;
}
.app-card {
  border: 1px solid var(--atlas-stroke);
  border-radius: 12px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 150px;
  background: var(--atlas-surface);
  cursor: pointer;
  transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}
.app-card:hover {
  border-color: var(--atlas-accent);
  box-shadow: 0 6px 20px rgba(79, 110, 247, 0.14);
  transform: translateY(-2px);
}
.app-card:active {
  transform: translateY(0);
}
.app-card:focus-visible {
  outline: 2px solid var(--atlas-accent);
  outline-offset: 1px;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.app-name {
  font-size: 16px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron {
  color: var(--atlas-muted);
  font-size: 14px;
  flex-shrink: 0;
  transition: transform 0.18s ease, color 0.18s ease;
}
.app-card:hover .chevron {
  color: var(--atlas-accent);
  transform: translateX(2px);
}
.app-desc {
  font-size: 13px;
  color: var(--atlas-text);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.app-desc.muted {
  color: var(--atlas-muted);
  opacity: 0.7;
}
.card-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--atlas-stroke);
  margin-top: auto;
  font-size: 12px;
}
.foot-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.foot-tip {
  flex-shrink: 0;
}
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
.spacer {
  flex: 1;
}

/* ---------- 创建抽屉（保留原有样式） ---------- */
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
  color: var(--atlas-muted);
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
  color: var(--atlas-muted);
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
  border: 1px solid var(--atlas-stroke);
  border-radius: 10px;
  background: var(--atlas-surface);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  user-select: none;
}

.plugin-card:hover {
  border-color: rgba(79, 110, 247, 0.45);
  box-shadow: 0 2px 8px rgba(79, 110, 247, 0.08);
}

.plugin-card:focus-visible {
  outline: 2px solid var(--atlas-accent);
  outline-offset: 1px;
}

.plugin-card.is-selected {
  border-color: var(--atlas-accent);
  background: rgba(79, 110, 247, 0.05);
  box-shadow: 0 0 0 1px var(--atlas-accent) inset;
}

.card-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--atlas-accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.card-check.is-empty {
  background: transparent;
  border: 1px solid var(--atlas-stroke);
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
  background: var(--atlas-bg);
  border: 1px solid var(--atlas-stroke);
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
  color: var(--atlas-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-desc.muted {
  color: var(--atlas-muted);
  opacity: 0.7;
}

.card-type {
  color: var(--atlas-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.picker-empty {
  padding: 28px 16px;
  text-align: center;
  color: var(--atlas-muted);
  font-size: 13px;
  border: 1px dashed var(--atlas-stroke);
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
  color: var(--atlas-accent);
  background: rgba(79, 110, 247, 0.07);
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
}

.drawer-count.is-zero {
  color: var(--atlas-muted);
  background: var(--atlas-bg);
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
