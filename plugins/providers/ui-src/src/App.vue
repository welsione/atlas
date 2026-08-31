<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Connection, EditPen, Delete, Search, Grid, Key, Star, Upload, Close, Check, Link, ArrowRight, Setting } from '@element-plus/icons-vue'
import { get, post, put, del } from '@atlas/runtime'

const props = defineProps({ appId: { type: Number, required: true } })

const rows = ref([])
const builtinIcons = ref([])
const customIcons = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const editing = ref(null)
const creating = ref(false)
const testing = ref(null)   // 'openai' | 'anthropic' | null
const keyword = ref('')
const drawerVisible = ref(false)
const detailRow = ref(null)
const settingsVisible = ref(false)
const exposeApiKey = ref(false)
const savingSettings = ref(false)

const base = () => `/api/apps/${props.appId}/plugins/providers/ep`
/** 对外数据面访问 URL（应用凭证 Bearer）。 */
const externalUrl = () => `/api/v1/app/${props.appId}/plugins/providers/ep/config`
/** 图标 URL：data:/http(s): 原样返回，相对路径（内置）走插件图标服务。 */
const iconUrl = (icon) => (/^(data:|https?:)/i.test(icon || '') ? icon : `/_pluginui/providers/${icon}`)

/** 接口品牌图标（内置图标库）。 */
const OPENAI_ICON = 'icons/vendors/openai.svg'
const ANTHROPIC_ICON = 'icons/vendors/anthropic.svg'

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return rows.value
  return rows.value.filter((r) => r.name.toLowerCase().includes(kw) || r.openai.baseUrl.toLowerCase().includes(kw) || r.anthropic.baseUrl.toLowerCase().includes(kw))
})

const stats = computed(() => ({
  total: rows.value.length,
  withOpenai: rows.value.filter((r) => r.openai.baseUrl).length,
  withAnthropic: rows.value.filter((r) => r.anthropic.baseUrl).length,
  modelCount: rows.value.reduce((s, r) => s + (r.models?.length ?? 0), 0),
}))

/** 打开详情抽屉；rows 刷新后同步引用。 */
function openDetail(row) {
  detailRow.value = row
  drawerVisible.value = true
}

function syncDetail() {
  if (detailRow.value) {
    detailRow.value = rows.value.find((r) => r.id === detailRow.value.id) ?? null
    if (!detailRow.value) drawerVisible.value = false
  }
}

async function fetchAll() {
  loading.value = true
  try {
    rows.value = await get(base() + '/list')
    syncDetail()
  } finally {
    loading.value = false
  }
}

async function fetchIcons() {
  const res = await get(base() + '/icons/list')
  builtinIcons.value = res.builtin ?? []
  customIcons.value = res.custom ?? []
}

// ================= 对外接口设置 =================
async function openSettings() {
  try {
    const res = await get(base() + '/config')
    exposeApiKey.value = res?.exposeApiKey === true
  } catch {
    exposeApiKey.value = false
  }
  settingsVisible.value = true
}

async function saveSettings() {
  savingSettings.value = true
  try {
    await post(`/api/apps/${props.appId}/plugins/providers/config`, { exposeApiKey: exposeApiKey.value })
    settingsVisible.value = false
    ElMessage.success('已保存')
  } finally {
    savingSettings.value = false
  }
}

onMounted(async () => {
  await fetchAll()
  await fetchIcons()
})

// ================= 模型参考库（快速选择） =================
const refQuery = ref('')
const refSearching = ref(false)
const refResults = ref([])
let refTimer = null

const fmtCtx = (n) => {
  if (n == null) return ''
  const f = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })
  return n >= 1048576 ? `${f.format(n / 1048576)}M` : n >= 1024 ? `${f.format(n / 1024)}K` : `${n}`
}

async function searchReference() {
  const q = refQuery.value.trim()
  if (q.length < 2) {
    refResults.value = []
    return
  }
  refSearching.value = true
  try {
    const res = await post(base() + '/reference/search', { q, limit: 30 })
    refResults.value = res.models ?? []
  } catch {
    refResults.value = []
  } finally {
    refSearching.value = false
  }
}

function onRefInput() {
  clearTimeout(refTimer)
  refTimer = setTimeout(searchReference, 300)
}

watch(refQuery, onRefInput)
onBeforeUnmount(() => clearTimeout(refTimer))

function addRefModel(m) {
  const hit = selectedModels.value.find((x) => x.modelId === m.modelId)
  if (hit) return
  selectedModels.value.push({ modelId: m.modelId, contextTokens: m.contextTokens ?? null })
  refQuery.value = ''
  refResults.value = []
}

// ================= 图标 =================
const iconQuery = ref('')
const uploadingIcon = ref(false)

const filteredBuiltin = computed(() => {
  const q = iconQuery.value.trim().toLowerCase()
  if (!q) return builtinIcons.value
  return builtinIcons.value.filter((i) => i.name.toLowerCase().includes(q))
})

function pickIcon(path) {
  form.value.icon = form.value.icon === path ? '' : path
}

async function handleIconUpload(file) {
  if (!file) return false
  if (!/\.svg$/i.test(file.name)) {
    ElMessage.warning('仅支持 SVG 图标')
    return false
  }
  if (file.size > 64 * 1024) {
    ElMessage.warning(`图标过大（${(file.size / 1024).toFixed(1)}KB），上限 64KB`)
    return false
  }
  uploadingIcon.value = true
  try {
    const reader = new FileReader()
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const data = String(dataUrl).split(',')[1]
    const name = file.name.replace(/\.svg$/i, '').replace(/[^a-zA-Z0-9_-]/g, '')
    const res = await post(base() + '/icons/upload', { data, name })
    customIcons.value.push(res)
    form.value.icon = res.path
    await fetchIcons()
    ElMessage.success('图标已上传')
  } catch (e) {
    ElMessage.error((e && e.message) || '上传失败')
  } finally {
    uploadingIcon.value = false
  }
  return false
}

async function handleIconRemove(icon) {
  try {
    await ElMessageBox.confirm(`确认删除自定义图标「${icon.name}」？使用该图标的供应商将回退为色点。`, '删除图标', { type: 'warning' })
    await del(`${base()}/icons/${icon.name}`)
    if (form.value.icon === icon.path) form.value.icon = ''
    await fetchIcons()
    ElMessage.success('已删除')
  } catch {
    // 取消
  }
}

// ================= 表单 =================
const form = ref({ name: '', icon: '', iconColor: '#4D6BFE', openai: { baseUrl: '', apiKey: '' }, anthropic: { baseUrl: '', apiKey: '' }, models: '' })
const selectedModels = ref([])
const modelMode = ref('quick')

const emptyForm = () => ({ name: '', icon: '', iconColor: '#4D6BFE', openai: { baseUrl: '', apiKey: '' }, anthropic: { baseUrl: '', apiKey: '' }, models: '' })

function openCreate() {
  editing.value = null
  form.value = emptyForm()
  selectedModels.value = []
  modelMode.value = 'quick'
  refQuery.value = ''
  refResults.value = []
  iconQuery.value = ''
  dialogVisible.value = true
}

function openEdit(row) {
  editing.value = row
  form.value = {
    name: row.name,
    icon: row.icon || '',
    iconColor: row.iconColor || '#4D6BFE',
    openai: { baseUrl: row.openai.baseUrl, apiKey: '' },
    anthropic: { baseUrl: row.anthropic.baseUrl, apiKey: '' },
    models: (row.models || []).map((m) => (m.contextTokens ? `${m.modelId}:${m.contextTokens}` : m.modelId)).join('\n'),
  }
  selectedModels.value = (row.models || []).map((m) => ({ modelId: m.modelId, contextTokens: m.contextTokens ?? null }))
  modelMode.value = 'quick'
  refQuery.value = ''
  refResults.value = []
  iconQuery.value = ''
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写名称')
    return
  }
  const openaiBase = form.value.openai.baseUrl.trim()
  const anthropicBase = form.value.anthropic.baseUrl.trim()
  if (!openaiBase && !anthropicBase) {
    ElMessage.warning('OpenAI 兼容与 Anthropic 兼容接口至少配置一个 BaseUrl')
    return
  }
  creating.value = true
  try {
    const models =
      modelMode.value === 'quick'
        ? selectedModels.value.map((m) => ({ modelId: m.modelId, contextTokens: m.contextTokens ?? null }))
        : form.value.models
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((line) => {
              const [modelId, ctx] = line.split(':')
              const contextTokens = ctx && !Number.isNaN(Number(ctx)) ? Number(ctx) : null
              return { modelId: modelId.trim(), contextTokens }
            })
    const payload = {
      name: form.value.name,
      icon: form.value.icon,
      iconColor: form.value.iconColor,
      openai: { baseUrl: openaiBase, apiKey: form.value.openai.apiKey },
      anthropic: { baseUrl: anthropicBase, apiKey: form.value.anthropic.apiKey },
      models,
    }
    if (editing.value) await put(`${base()}/update/${editing.value.id}`, payload)
    else await post(base() + '/create', payload)
    dialogVisible.value = false
    await fetchAll()
    ElMessage.success('已保存')
  } finally {
    creating.value = false
  }
}

async function handleRemove(row) {
  try {
    await ElMessageBox.confirm(`确认删除「${row.name}」？`, '删除供应商', { type: 'error' })
    await del(`${base()}/delete/${row.id}`)
    drawerVisible.value = false
    await fetchAll()
    ElMessage.success('已删除')
  } catch {
    // 取消
  }
}

async function handleTest(row, compat) {
  const endpoint = compat === 'anthropic' ? row.anthropic : row.openai
  if (!endpoint.baseUrl) return
  testing.value = `${row.id}:${compat}`
  try {
    const result = await post(`${base()}/test`, { id: row.id, compat, timeoutSeconds: 5 })
    if (result.success) ElMessage.success(`${compat === 'anthropic' ? 'Anthropic' : 'OpenAI'} 连接成功（${result.latencyMs}ms${result.modelCount != null ? ` · ${result.modelCount} 个模型` : ''}）`)
    else ElMessage.error(`${compat === 'anthropic' ? 'Anthropic' : 'OpenAI'} 连接失败：${result.message}`)
  } finally {
    testing.value = null
  }
}
</script>

<template>
  <div class="surface">
    <!-- 统计条 -->
    <div class="stats-bar">
      <div class="stat-block">
        <span class="stat-icon accent"><el-icon aria-hidden="true"><Grid /></el-icon></span>
        <div class="stat-text">
          <span class="stat-num accent">{{ stats.total }}</span>
          <span class="stat-label">供应商</span>
        </div>
      </div>
      <div class="stat-block">
        <span class="stat-icon"><el-icon aria-hidden="true"><Link /></el-icon></span>
        <div class="stat-text">
          <span class="stat-num">{{ stats.withOpenai }}</span>
          <span class="stat-label">已配 OpenAI 兼容</span>
        </div>
      </div>
      <div class="stat-block">
        <span class="stat-icon"><el-icon aria-hidden="true"><Star /></el-icon></span>
        <div class="stat-text">
          <span class="stat-num">{{ stats.withAnthropic }}</span>
          <span class="stat-label">已配 Anthropic 兼容</span>
        </div>
      </div>
      <div class="stat-block">
        <span class="stat-icon"><el-icon aria-hidden="true"><Key /></el-icon></span>
        <div class="stat-text">
          <span class="stat-num">{{ stats.modelCount }}</span>
          <span class="stat-label">模型总数</span>
        </div>
      </div>
    </div>

    <!-- 筛选与操作 -->
    <div class="toolbar">
      <el-input v-model="keyword" class="search" :prefix-icon="Search" placeholder="搜索名称 / BaseUrl…" clearable />
      <div class="spacer" />
      <el-tooltip content="对外接口设置" placement="top">
        <el-button :icon="Setting" circle aria-label="对外接口设置" @click="openSettings" />
      </el-tooltip>
      <el-tooltip content="刷新列表" placement="top">
        <el-button :icon="Refresh" circle aria-label="刷新列表" :loading="loading" @click="fetchAll" />
      </el-tooltip>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增供应商</el-button>
    </div>

    <!-- 供应商卡片网格 -->
    <div v-loading="loading" class="card-grid">
      <div
        v-for="row in filtered"
        :key="row.id"
        class="provider-card"
        role="button"
        tabindex="0"
        @click="openDetail(row)"
        @keydown.enter.space.prevent="openDetail(row)"
      >
        <div class="card-head">
          <img v-if="row.icon" :src="iconUrl(row.icon)" class="p-icon" :alt="row.name" @error="$event.target.style.display = 'none'" />
          <span v-else class="dot" :style="{ background: row.iconColor || 'var(--atlas-accent)' }" />
          <span class="p-name" :title="row.name">{{ row.name }}</span>
          <div class="spacer" />
          <el-icon class="chevron" aria-hidden="true"><ArrowRight /></el-icon>
        </div>

        <div v-if="row.openai.baseUrl" class="compat-row" :title="row.openai.baseUrl">
          <img :src="iconUrl(OPENAI_ICON)" class="compat-icon" alt="OpenAI" @error="$event.target.style.display = 'none'" />
          <span class="compat-url mono">{{ row.openai.baseUrl }}</span>
        </div>
        <div v-if="row.anthropic.baseUrl" class="compat-row" :title="row.anthropic.baseUrl">
          <img :src="iconUrl(ANTHROPIC_ICON)" class="compat-icon" alt="Anthropic" @error="$event.target.style.display = 'none'" />
          <span class="compat-url mono">{{ row.anthropic.baseUrl }}</span>
        </div>

        <div class="card-models">
          <template v-if="row.models.length">
            <el-tooltip v-for="m in row.models.slice(0, 3)" :key="m.modelId" :content="m.contextTokens ? `${m.modelId} · ${m.contextTokens} tokens` : m.modelId" placement="top">
              <span class="model-chip">{{ m.modelId }}</span>
            </el-tooltip>
            <el-tag v-if="row.models.length > 3" size="small" type="warning" effect="plain">+{{ row.models.length - 3 }}</el-tag>
          </template>
          <span v-else class="model-chip muted-chip">未配置模型</span>
        </div>

        <div class="card-foot">
          <span class="muted foot-tip">点击查看详情</span>
          <el-tag v-if="row.openai.apiKeySet || row.anthropic.apiKeySet" size="small" type="success" effect="plain">已配置密钥</el-tag>
          <el-tag v-else size="small" type="info" effect="plain">未配置密钥</el-tag>
        </div>
      </div>

      <div v-if="!loading && filtered.length === 0" class="empty-state">
        <el-empty :description="rows.length === 0 ? '暂无供应商，点击「新增供应商」创建' : '没有匹配的供应商'" :image-size="80" />
      </div>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" :title="detailRow?.name ?? ''" direction="rtl" size="440px" :with-header="false">
      <div v-if="detailRow" class="drawer-body">
        <div class="drawer-head">
          <img v-if="detailRow.icon" :src="iconUrl(detailRow.icon)" class="drawer-icon" :alt="detailRow.name" @error="$event.target.style.display = 'none'" />
          <span v-else class="dot" :style="{ background: detailRow.iconColor || 'var(--atlas-accent)' }" />
          <div class="drawer-title">
            <div class="drawer-name">{{ detailRow.name }}</div>
            <div class="muted drawer-sub">供应商详情</div>
          </div>
        </div>

        <!-- OpenAI 兼容接口 -->
        <div class="endpoint-block">
          <div class="endpoint-title">
            <img :src="iconUrl(OPENAI_ICON)" class="endpoint-icon" alt="OpenAI" @error="$event.target.style.display = 'none'" />
            <span>OpenAI 兼容接口</span>
          </div>
          <div v-if="detailRow.openai.baseUrl" class="endpoint-url mono" :title="detailRow.openai.baseUrl">{{ detailRow.openai.baseUrl }}</div>
          <div v-else class="endpoint-empty muted">未配置</div>
          <div class="endpoint-meta">
            <el-tag v-if="detailRow.openai.apiKeySet" size="small" type="success" effect="plain">API Key 已配置</el-tag>
            <el-tag v-else size="small" type="warning" effect="plain">API Key 未配置</el-tag>
            <el-button
              v-if="detailRow.openai.baseUrl"
              size="small"
              :icon="Connection"
              :loading="testing === detailRow.id + ':openai'"
              @click="handleTest(detailRow, 'openai')"
            >测试连接</el-button>
          </div>
        </div>

        <!-- Anthropic 兼容接口 -->
        <div class="endpoint-block">
          <div class="endpoint-title">
            <img :src="iconUrl(ANTHROPIC_ICON)" class="endpoint-icon" alt="Anthropic" @error="$event.target.style.display = 'none'" />
            <span>Anthropic 兼容接口</span>
          </div>
          <div v-if="detailRow.anthropic.baseUrl" class="endpoint-url mono" :title="detailRow.anthropic.baseUrl">{{ detailRow.anthropic.baseUrl }}</div>
          <div v-else class="endpoint-empty muted">未配置</div>
          <div class="endpoint-meta">
            <el-tag v-if="detailRow.anthropic.apiKeySet" size="small" type="success" effect="plain">API Key 已配置</el-tag>
            <el-tag v-else size="small" type="warning" effect="plain">API Key 未配置</el-tag>
            <el-button
              v-if="detailRow.anthropic.baseUrl"
              size="small"
              :icon="Connection"
              :loading="testing === detailRow.id + ':anthropic'"
              @click="handleTest(detailRow, 'anthropic')"
            >测试连接</el-button>
          </div>
        </div>

        <!-- 模型 -->
        <div class="endpoint-block">
          <div class="endpoint-title"><el-icon aria-hidden="true"><Key /></el-icon><span>模型（{{ detailRow.models?.length ?? 0 }} 个）</span></div>
          <div v-if="detailRow.models?.length" class="drawer-models">
            <el-tooltip v-for="m in detailRow.models" :key="m.modelId" :content="m.contextTokens ? `${m.modelId} · ${m.contextTokens} tokens` : m.modelId" placement="top">
              <span class="model-chip">{{ m.modelId }}</span>
            </el-tooltip>
          </div>
          <div v-else class="endpoint-empty muted">未配置模型</div>
        </div>

        <!-- 底部操作 -->
        <div class="drawer-foot">
          <span class="muted foot-info">
            <span class="dot" :style="{ background: detailRow.iconColor || 'var(--atlas-accent)' }" />
            标识色 {{ detailRow.iconColor || '未设置' }}
          </span>
          <div class="spacer" />
          <el-button size="small" type="danger" plain :icon="Delete" @click="handleRemove(detailRow)">删除</el-button>
          <el-button size="small" type="primary" :icon="EditPen" @click="openEdit(detailRow)">编辑</el-button>
        </div>
      </div>
    </el-drawer>

    <!-- 对外接口设置 -->
    <el-dialog v-model="settingsVisible" title="对外接口设置" width="520">
      <div class="settings-body">
        <div class="settings-section">
          <div class="settings-title">外部访问地址</div>
          <code class="settings-url mono">{{ externalUrl() }}</code>
          <div class="muted settings-tip">外部系统用应用凭证换取 Bearer 令牌后访问：<br />1. <code class="mono">POST /api/v1/app/auth</code>（appId + appSecret）→ token<br />2. <code class="mono">GET /api/v1/app/{{ props.appId }}/plugins/providers/ep/config</code>（Authorization: Bearer &lt;token&gt;）</div>
        </div>
        <div class="settings-section">
          <div class="settings-title">返回 API Key</div>
          <div class="settings-switch">
            <el-switch v-model="exposeApiKey" aria-label="在对外配置中返回 API Key 明文" />
            <div class="settings-switch-text">
              <div>在对外配置中返回 API Key 明文</div>
              <div class="muted settings-tip">默认关闭；开启后外部应用经凭证认证即可拿到各接口的明文 Key（供实际调用 LLM），请确认调用方可信。</div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="settingsVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingSettings" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑供应商' : '新增供应商'" width="680">
      <el-form label-width="110px">
        <el-form-item label="名称" required><el-input v-model="form.name" name="provider-name" autocomplete="off" placeholder="如 DeepSeek" /></el-form-item>
        <el-form-item label="图标">
          <div class="icon-picker-wrap">
            <div class="icon-tools">
              <el-input v-model="iconQuery" class="icon-search" size="small" placeholder="搜索内置图标" clearable :prefix-icon="Search" />
              <el-upload :auto-upload="true" :show-file-list="false" :before-upload="handleIconUpload" accept=".svg">
                <el-button size="small" type="primary" plain :icon="Upload" :loading="uploadingIcon">上传图标</el-button>
              </el-upload>
            </div>
            <div v-if="customIcons.length" class="icon-group-title">自定义（{{ customIcons.length }}/20）</div>
            <div class="icon-picker">
              <div
                v-for="icon in customIcons"
                :key="icon.name"
                class="icon-item"
                :class="{ active: form.icon === icon.path }"
                :title="icon.name"
                role="button"
                tabindex="0"
                :aria-label="`选择图标 ${icon.name}`"
                @click="pickIcon(icon.path)"
                @keydown.enter.space.prevent="pickIcon(icon.path)"
              >
                <img :src="iconUrl(icon.path)" :alt="icon.name" loading="lazy" />
                <el-icon v-if="form.icon === icon.path" class="check" aria-hidden="true"><Check /></el-icon>
                <button type="button" class="icon-remove" :aria-label="`删除图标 ${icon.name}`" title="删除图标" @click.stop="handleIconRemove(icon)">
                  <el-icon aria-hidden="true"><Close /></el-icon>
                </button>
              </div>
            </div>
            <div class="icon-group-title">内置</div>
            <div class="icon-picker">
              <div
                v-for="icon in filteredBuiltin"
                :key="icon.path"
                class="icon-item"
                :class="{ active: form.icon === icon.path }"
                :title="icon.name.replace(/\.svg$/, '')"
                role="button"
                tabindex="0"
                :aria-label="`选择图标 ${icon.name.replace(/\.svg$/, '')}`"
                @click="pickIcon(icon.path)"
                @keydown.enter.space.prevent="pickIcon(icon.path)"
              >
                <img :src="iconUrl(icon.path)" :alt="icon.name" loading="lazy" />
                <el-icon v-if="form.icon === icon.path" class="check" aria-hidden="true"><Check /></el-icon>
              </div>
              <span v-if="!filteredBuiltin.length" class="muted">无匹配图标</span>
            </div>
            <el-button v-if="form.icon" size="small" text type="info" :icon="Close" @click="form.icon = ''">清除图标</el-button>
          </div>
        </el-form-item>
        <el-form-item label="标识颜色">
          <el-color-picker v-model="form.iconColor" />
          <span class="muted hint">未设图标时显示的圆点颜色</span>
        </el-form-item>

        <el-divider content-position="left">OpenAI 兼容接口</el-divider>
        <el-form-item label="Base URL">
          <el-input v-model="form.openai.baseUrl" type="url" name="openai-base-url" autocomplete="off" placeholder="https://api.example.com/v1" clearable />
        </el-form-item>
        <el-form-item label="API Key">
          <div class="key-row">
            <el-input v-model="form.openai.apiKey" type="password" name="openai-api-key" autocomplete="new-password" show-password :placeholder="editing && form.openai.apiKey === '' ? '留空保持不变' : ''" clearable />
            <el-button v-if="editing && editing.openai.apiKeySet" size="small" text type="danger" @click="form.openai.apiKey = null">清除密钥</el-button>
          </div>
        </el-form-item>

        <el-divider content-position="left">Anthropic 兼容接口</el-divider>
        <el-form-item label="Base URL">
          <el-input v-model="form.anthropic.baseUrl" type="url" name="anthropic-base-url" autocomplete="off" placeholder="https://api.example.com" clearable />
        </el-form-item>
        <el-form-item label="API Key">
          <div class="key-row">
            <el-input v-model="form.anthropic.apiKey" type="password" name="anthropic-api-key" autocomplete="new-password" show-password :placeholder="editing && form.anthropic.apiKey === '' ? '留空保持不变' : ''" clearable />
            <el-button v-if="editing && editing.anthropic.apiKeySet" size="small" text type="danger" @click="form.anthropic.apiKey = null">清除密钥</el-button>
          </div>
        </el-form-item>

        <el-divider content-position="left">模型（两接口共享）</el-divider>
        <el-form-item label="模型">
          <div class="model-editor">
            <el-radio-group v-model="modelMode" size="small">
              <el-radio-button value="quick">快速选择（参考库）</el-radio-button>
              <el-radio-button value="manual">手动输入</el-radio-button>
            </el-radio-group>

            <template v-if="modelMode === 'quick'">
              <el-input v-model="refQuery" placeholder="搜索 models.dev 参考库，如 deepseek / claude / gpt-4o，点击结果加入" clearable :prefix-icon="Search" @keyup.enter="searchReference" />
              <div v-if="refSearching" class="ref-hint muted">搜索中…</div>
              <div v-else-if="refResults.length" class="ref-list">
                <div
                  v-for="m in refResults"
                  :key="m.provider + '/' + m.modelId"
                  class="ref-item"
                  role="button"
                  tabindex="0"
                  @click="addRefModel(m)"
                  @keydown.enter.space.prevent="addRefModel(m)"
                >
                  <span class="mono ref-id">{{ m.provider }}/{{ m.modelId }}</span>
                  <span class="muted ref-ctx">{{ fmtCtx(m.contextTokens) }} ctx</span>
                  <el-icon class="ref-add" aria-hidden="true"><Plus /></el-icon>
                </div>
              </div>
              <div v-else-if="refQuery.trim().length >= 2" class="ref-hint muted">无匹配结果，试试其他关键词或切换手动输入</div>
              <div class="selected-models">
                <el-tag v-for="(m, i) in selectedModels" :key="m.modelId" closable size="small" @close="selectedModels.splice(i, 1)">
                  {{ m.modelId }}<span v-if="m.contextTokens" class="tag-ctx"> · {{ fmtCtx(m.contextTokens) }} ctx</span>
                </el-tag>
                <span v-if="!selectedModels.length" class="muted">尚未选择模型</span>
              </div>
            </template>

            <el-input v-else v-model="form.models" type="textarea" :rows="5" placeholder="每行一个，格式 modelId 或 modelId:上下文tokens，如&#10;deepseek-chat:64000&#10;deepseek-reasoner" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* ---------- 统计条 ---------- */
.stats-bar {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 12px 0;
  border-bottom: 1px dashed var(--atlas-stroke);
  margin-bottom: 14px;
}
.stat-block {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  min-width: 0;
}
.stat-block + .stat-block {
  border-left: 1px solid var(--atlas-stroke);
}
.stat-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--atlas-r-s);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  background: var(--atlas-bg);
  color: var(--atlas-text);
  flex-shrink: 0;
}
.stat-icon.accent { background: var(--atlas-accent-soft); color: var(--atlas-accent); }
.stat-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.stat-num {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  color: var(--atlas-text);
}
.stat-num.accent { color: var(--atlas-accent); }
.stat-label {
  font-size: 12px;
  color: var(--atlas-muted);
}

/* ---------- 工具栏 ---------- */
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.search { width: 280px; }
.spacer { flex: 1; }

/* ---------- 卡片网格 ---------- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
  min-height: 120px;
}
.provider-card {
  border: 1px solid var(--atlas-stroke);
  border-radius: var(--atlas-r-m);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 210px;
  background: var(--atlas-surface);
  cursor: pointer;
  transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}
.provider-card:hover {
  border-color: var(--atlas-accent);
  box-shadow: var(--atlas-shadow-hover);
  transform: translateY(-1px);
}
.provider-card:active {
  transform: translateY(0);
}
.provider-card:focus-visible,
.ref-item:focus-visible,
.icon-item:focus-visible {
  outline: 2px solid var(--atlas-accent);
  outline-offset: 1px;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-bottom: 2px;
}
.chevron {
  color: var(--atlas-muted);
  font-size: 13px;
  flex-shrink: 0;
  transition: transform 0.18s ease, color 0.18s ease;
}
.provider-card:hover .chevron {
  color: var(--atlas-accent);
  transform: translateX(2px);
}
.p-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  flex-shrink: 0;
  object-fit: contain;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.p-name {
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.compat-row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  padding: 5px 9px;
  background: var(--atlas-bg);
  border-radius: var(--atlas-r-s);
  overflow: hidden;
}
.compat-row.empty {
  opacity: 0.55;
  font-style: italic;
}
.compat-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
  object-fit: contain;
}
.compat-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--atlas-text);
}
.card-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--atlas-stroke);
  margin-top: auto;
  min-height: 26px;
}
.foot-tip {
  font-size: 12px;
  flex: 1;
}
.card-models {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-content: flex-start;
  min-height: 22px;
}
.model-chip {
  font-size: 11px;
  background: var(--atlas-bg);
  border: 1px solid var(--atlas-stroke);
  border-radius: 5px;
  padding: 1px 7px;
  color: var(--atlas-text);
  cursor: default;
}
.muted-chip {
  color: var(--atlas-muted);
  font-style: italic;
}
.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--atlas-stroke);
  margin-top: auto;
  min-height: 26px;
}
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  padding: 30px 0;
}

/* ---------- 详情抽屉 ---------- */
.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px;
}
.drawer-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--atlas-stroke);
}
.drawer-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: contain;
  background: var(--atlas-bg);
  padding: 6px;
}
.drawer-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.drawer-name {
  font-size: 15px;
  font-weight: 700;
}
.drawer-sub {
  font-size: 12px;
}
.endpoint-block {
  border: 1px solid var(--atlas-stroke);
  border-radius: var(--atlas-r-m);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.endpoint-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
}
.endpoint-icon {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  object-fit: contain;
}
.endpoint-url {
  font-size: 12px;
  color: var(--atlas-text);
  background: var(--atlas-bg);
  border-radius: var(--atlas-r-s);
  padding: 7px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.endpoint-empty {
  font-size: 12px;
  font-style: italic;
}
.endpoint-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
}
.drawer-models {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.drawer-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px dashed var(--atlas-stroke);
  margin-top: auto;
}
.foot-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

/* ---------- 图标选择器 ---------- */
.icon-picker-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.icon-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}
.icon-search {
  width: 240px;
}
.icon-group-title {
  font-size: 12px;
  color: var(--atlas-muted);
  margin-top: 2px;
}
.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  max-height: 168px;
  overflow: auto;
  padding: 2px;
}
.icon-item {
  position: relative;
  width: 40px;
  height: 40px;
  border: 1px solid var(--atlas-stroke);
  border-radius: var(--atlas-r-s);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--atlas-surface);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.icon-item:hover {
  border-color: var(--atlas-accent);
}
.icon-item.active {
  border-color: var(--atlas-accent);
  box-shadow: 0 0 0 2px var(--atlas-accent-line);
}
.icon-item img {
  max-width: 26px;
  max-height: 26px;
}
.icon-item .check {
  position: absolute;
  right: -4px;
  top: -4px;
  background: var(--atlas-accent);
  color: var(--atlas-bg);
  border-radius: 50%;
  font-size: 11px;
  padding: 1px;
}
.icon-remove {
  position: absolute;
  left: -6px;
  top: -6px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  padding: 0;
  background: var(--atlas-danger);
  color: var(--atlas-bg);
  border-radius: 50%;
  font-size: 10px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.icon-item:hover .icon-remove,
.icon-remove:focus-visible {
  opacity: 1;
}

/* ---------- 模型编辑器 ---------- */
.model-editor {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ref-list {
  max-height: 180px;
  overflow: auto;
  border: 1px solid var(--atlas-stroke);
  border-radius: var(--atlas-r-s);
}
.ref-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
}
.ref-item:hover {
  background: var(--atlas-accent-weak);
}
.ref-id {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ref-ctx {
  font-size: 12px;
  flex-shrink: 0;
}
.ref-add {
  color: var(--atlas-accent);
  flex-shrink: 0;
}
.ref-hint {
  font-size: 12px;
}
.selected-models {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 26px;
}
.tag-ctx {
  font-size: 11px;
  opacity: 0.8;
}

/* ---------- 其他 ---------- */
.hint { font-size: 12px; margin-left: 10px; color: var(--atlas-muted); }
.muted { color: var(--atlas-muted); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.key-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.key-row .el-input { flex: 1; }

/* ---------- 对外接口设置 ---------- */
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.settings-title {
  font-size: 13px;
  font-weight: 600;
}
.settings-url {
  font-size: 12px;
  background: var(--atlas-bg);
  border-radius: var(--atlas-r-s);
  padding: 8px 10px;
  word-break: break-all;
  user-select: all;
}
.settings-tip {
  font-size: 12px;
  line-height: 1.8;
}
.settings-switch {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.settings-switch-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
</style>
