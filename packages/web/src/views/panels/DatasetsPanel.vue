<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Refresh, Setting, Upload, Warning, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { datasetApi } from '../../services/datasetApi'
import { copyText as copyShared } from '../../clipboard'
import type { Dataset, DatasetSensitivity } from '../../types'

const props = defineProps<{ appId: number; mode?: string; refresh?: () => void }>()

const rows = ref<Dataset[]>([])
const loading = ref(false)
const page = ref(1)
const size = ref(10)
const total = ref(0)
const drawerVisible = ref(false)
const form = ref({ name: '', description: '', sensitivity: 'PUBLIC' as DatasetSensitivity, contentJson: '{}' })
const creating = ref(false)
const detailVisible = ref(false)
const detailRow = ref<Dataset | null>(null)
const detailSens = ref<DatasetSensitivity>('PUBLIC')
const savingSens = ref(false)
const editForm = ref({ name: '', description: '', contentJson: '{}' })
const savingContent = ref(false)
const detailFiles = ref<File[]>([])
const uploading = ref(false)

const baseUrl = window.location.origin

function isPlugin(row: Dataset) {
  return !!row.pluginType
}

function openDetail(row: Dataset) {
  detailRow.value = row
  detailSens.value = row.sensitivity
  editForm.value = {
    name: row.name,
    description: row.description,
    contentJson: row.contentJson || '{}',
  }
  detailFiles.value = []
  detailVisible.value = true
}

function refreshDetail() {
  if (!detailRow.value) return
  detailRow.value = rows.value.find((r) => r.id === detailRow.value?.id) ?? detailRow.value
}

function onFileSelected(files: FileList | null) {
  if (!files) {
    detailFiles.value = []
    return
  }
  const MAX = 64 * 1024 * 1024
  const oversized = [...files].filter((f) => f.size > MAX)
  if (oversized.length > 0) {
    ElMessage.warning(`已忽略 ${oversized.length} 个超过 64MB 的文件：${oversized.map((f) => f.name).join('、')}`)
  }
  detailFiles.value = [...files].filter((f) => f.size <= MAX)
}

async function fileToBase64(f: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(f)
  })
}

async function handleSensSave() {
  const row = detailRow.value
  if (!row) return
  savingSens.value = true
  try {
    await datasetApi.update(props.appId, row.id, { sensitivity: detailSens.value })
    ElMessage.success('敏感度已更新')
    await fetchAll()
    refreshDetail()
  } finally {
    savingSens.value = false
  }
}

async function handleContentSave() {
  const row = detailRow.value
  if (!row) return
  savingContent.value = true
  try {
    await datasetApi.update(props.appId, row.id, {
      name: editForm.value.name.trim(),
      description: editForm.value.description,
      contentJson: editForm.value.contentJson || '{}',
    })
    ElMessage.success('已保存')
    await fetchAll()
    refreshDetail()
  } finally {
    savingContent.value = false
  }
}

async function handleUpload() {
  const row = detailRow.value
  if (!row || detailFiles.value.length === 0) return
  uploading.value = true
  try {
    for (const f of detailFiles.value) {
      const base64 = await fileToBase64(f)
      await datasetApi.uploadAsset(props.appId, row.id, f.name, base64, f.type || 'application/octet-stream')
    }
    ElMessage.success(`已上传 ${detailFiles.value.length} 个文件`)
    detailFiles.value = []
    await fetchAll()
    refreshDetail()
  } finally {
    uploading.value = false
  }
}

async function handleRemoveAsset(path: string) {
  const row = detailRow.value
  if (!row) return
  try {
    await ElMessageBox.confirm(`确认删除资产「${path}」？`, '删除资产', { type: 'warning' })
    await datasetApi.removeAsset(props.appId, row.id, path)
    ElMessage.success('资产已删除')
    await fetchAll()
    refreshDetail()
  } catch {
    // 取消
  }
}

async function handleRefresh() {
  const row = detailRow.value
  if (!row) return
  await datasetApi.refresh(props.appId, row.id)
  ElMessage.success('已刷新')
  await fetchAll()
  refreshDetail()
}

async function handleRemove() {
  const row = detailRow.value
  if (!row) return
  try {
    await ElMessageBox.confirm(`删除应用将级联清理其全部数据，不可恢复。确认删除数据集「${row.name}」？`, '删除数据集', { type: 'error' })
    await datasetApi.remove(props.appId, row.id)
    ElMessage.success('已删除')
    detailVisible.value = false
    await fetchAll()
  } catch {
    // 取消
  }
}

function assetUrl(row: Dataset, path: string) {
  return `${baseUrl}/api/v1/datasets/${row.token}/assets/${path.split('/').map(encodeURIComponent).join('/')}`
}

async function copyText(text: string, label: string) {
  await copyShared(text, label)
}

function accessMetaUrl(row: Dataset) {
  return `${baseUrl}/api/v1/datasets/${row.token}/meta`
}

function accessDataUrl(row: Dataset) {
  return `${baseUrl}/api/v1/datasets/${row.token}/data`
}

function accessSecretsUrl(row: Dataset) {
  return `${baseUrl}/api/v1/datasets/${row.token}/secrets`
}

function curlExample(row: Dataset) {
  if (row.sensitivity === 'PUBLIC') {
    return `# 直接访问（token 即钥匙）
curl '${accessDataUrl(row)}'

# 元信息
curl '${accessMetaUrl(row)}'`
  }
  const bearer = `# 1) 用应用凭证换短时效令牌（应用空间 → 轮换凭证可查看）
curl -X POST '${baseUrl}/api/v1/app/auth' \\
  -H 'content-type: application/json' \\
  -d '{"appId":"app_xxx","appSecret":"应用密钥"}'

# 2) 带 Bearer 令牌访问（消费方需在数据集授权白名单内）
curl '${accessDataUrl(row)}' \\
  -H "Authorization: Bearer <令牌>"`
  if (row.sensitivity === 'SECRET') {
    return `${bearer}

# 3) SECRET 级敏感凭证（每次访问审计）
curl '${accessSecretsUrl(row)}' \\
  -H "Authorization: Bearer <令牌>"`
  }
  return bearer
}

async function fetchAll() {
  loading.value = true
  try {
    const res = await datasetApi.list(props.appId, page.value, size.value)
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

onMounted(fetchAll)

function openCreate() {
  form.value = { name: '', description: '', sensitivity: 'PUBLIC', contentJson: '{}' }
  drawerVisible.value = true
}

async function handleSave() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入数据集名称')
    return
  }
  creating.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      description: form.value.description,
      sensitivity: form.value.sensitivity,
      contentJson: form.value.contentJson || '{}',
    }
    await datasetApi.create(props.appId, payload)
    drawerVisible.value = false
    await fetchAll()
  } finally {
    creating.value = false
  }
}

function sensTag(s: string) {
  return s === 'PUBLIC' ? 'success' : s === 'INTERNAL' ? 'warning' : 'danger'
}
</script>

<template>
  <div class="surface">
    <div class="panel-header">
      <el-button type="primary" size="small" @click="openCreate">新建数据集</el-button>
      <el-button :icon="Refresh" size="small" circle :loading="loading" @click="fetchAll" />
    </div>
    <el-table v-loading="loading" :data="rows" empty-text="暂无数据集">
      <el-table-column prop="name" label="名称" min-width="140">
        <template #default="{ row }">
          <span>{{ row.name }}</span>
          <el-tag v-if="isPlugin(row)" size="small" type="info" style="margin-left: 6px">插件</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="datasetKey" label="Key" min-width="120">
        <template #default="{ row }"><code class="mono">{{ row.datasetKey || '—' }}</code></template>
      </el-table-column>
      <el-table-column label="敏感度" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="sensTag(row.sensitivity)">{{ row.sensitivity }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="version" label="版本" width="70" />
      <el-table-column label="资产" width="70">
        <template #default="{ row }">
          <span v-if="row.assets?.length">{{ row.assets.length }}</span>
          <span v-else class="dim">—</span>
        </template>
      </el-table-column>
      <el-table-column label="Token" min-width="200">
        <template #default="{ row }"><code class="mono">{{ row.token.slice(0, 16) }}…</code></template>
      </el-table-column>
      <el-table-column label="刷新" width="80">
        <template #default="{ row }">{{ row.refreshMode === 'SCHEDULED' ? '定时' : '手动' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button size="small" :icon="Setting" @click="openDetail(row)">管理</el-button>
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

    <el-drawer v-model="drawerVisible" title="新建数据集" direction="rtl" size="560px">
      <el-form label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="数据集名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="可选" />
        </el-form-item>
        <el-form-item label="敏感度">
          <el-select v-model="form.sensitivity">
            <el-option label="PUBLIC（token 直达）" value="PUBLIC" />
            <el-option label="INTERNAL（Bearer + 白名单）" value="INTERNAL" />
            <el-option label="SECRET（信封加密 + 逐项授权）" value="SECRET" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容 JSON">
          <el-input v-model="form.contentJson" type="textarea" :rows="4" placeholder='{"key": "value"}' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="drawerVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleSave">创建</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="detailVisible" title="管理数据集" direction="rtl" size="560px">
      <template v-if="detailRow">
        <div class="detail-head">
          <span class="detail-name">{{ detailRow.name }}</span>
          <el-tag v-if="isPlugin(detailRow)" size="small" type="info">插件</el-tag>
          <el-tag size="small" :type="sensTag(detailRow.sensitivity)">{{ detailRow.sensitivity }}</el-tag>
          <el-tag size="small" type="info">v{{ detailRow.version }}</el-tag>
        </div>
        <code class="mono detail-key">{{ detailRow.datasetKey || 'manual' }}</code>

        <div class="detail-section">
          <div class="section-title">基本信息</div>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">Token</span><code class="mono">{{ detailRow.token.slice(0, 20) }}…</code></div>
            <div class="info-item"><span class="info-label">创建时间</span><span>{{ detailRow.createdAt }}</span></div>
            <div class="info-item"><span class="info-label">刷新模式</span><span>{{ detailRow.refreshMode === 'SCHEDULED' ? '定时' : '手动' }}</span></div>
            <div class="info-item"><span class="info-label">资产数</span><span>{{ detailRow.assets?.length ?? 0 }}</span></div>
          </div>
          <el-button size="small" link type="primary" @click="copyText(detailRow.token, 'Token')">复制 Token</el-button>
        </div>

        <div class="detail-section">
          <div class="section-title">访问方式</div>
          <el-alert
            :type="detailRow.sensitivity === 'PUBLIC' ? 'success' : 'warning'"
            :closable="false"
            show-icon
            :title="
              detailRow.sensitivity === 'PUBLIC'
                ? 'PUBLIC：无需鉴权，URL 中 token 即访问钥匙'
                : detailRow.sensitivity === 'INTERNAL'
                  ? 'INTERNAL：需要 Bearer 应用令牌，且消费方应用须在本数据集授权白名单内'
                  : 'SECRET：需要 Bearer 应用令牌 + 授权白名单，每次访问审计'
            "
            style="margin-bottom: 10px"
          />
          <div class="access-url-row" v-for="u in [
            { label: '元信息', url: accessMetaUrl(detailRow) },
            { label: '内容数据', url: accessDataUrl(detailRow) },
            ...(detailRow.sensitivity === 'SECRET' ? [{ label: '敏感凭证', url: accessSecretsUrl(detailRow) }] : []),
          ]" :key="u.label">
            <span class="access-label">{{ u.label }}</span>
            <code class="access-url mono">{{ u.url }}</code>
            <el-button size="small" link type="primary" @click="copyText(u.url, u.label)">复制</el-button>
          </div>
          <div class="access-curl">
            <div class="access-curl-head">
              <span>curl 示例</span>
              <el-button size="small" link type="primary" @click="copyText(curlExample(detailRow), 'curl 示例')">复制</el-button>
            </div>
            <pre class="mono">{{ curlExample(detailRow) }}</pre>
          </div>
        </div>

        <div class="detail-section">
          <div class="section-title">敏感度</div>
          <p v-if="isPlugin(detailRow)" class="sens-tip">插件注册数据集内容由插件管理；敏感度属密级管理，可调整（SECRET 级才有敏感凭证接口）。</p>
          <div class="sens-row">
            <el-select v-model="detailSens" style="width: 220px">
              <el-option label="PUBLIC（token 直达）" value="PUBLIC" />
              <el-option label="INTERNAL（Bearer + 白名单）" value="INTERNAL" />
              <el-option label="SECRET（信封加密 + 逐项授权）" value="SECRET" />
            </el-select>
            <el-button type="primary" size="small" :loading="savingSens" @click="handleSensSave">保存</el-button>
          </div>
        </div>

        <div v-if="!isPlugin(detailRow)" class="detail-section">
          <div class="section-title">内容</div>
          <el-form label-width="56px" label-position="top">
            <el-form-item label="名称" required>
              <el-input v-model="editForm.name" placeholder="数据集名称" />
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="editForm.description" placeholder="可选" />
            </el-form-item>
            <el-form-item label="内容 JSON">
              <el-input v-model="editForm.contentJson" type="textarea" :rows="4" placeholder='{"key": "value"}' />
            </el-form-item>
          </el-form>
          <el-button type="primary" size="small" :loading="savingContent" @click="handleContentSave">保存内容</el-button>
        </div>

        <div class="detail-section">
          <div class="section-title">文件资产（{{ detailRow.assets?.length ?? 0 }}）</div>
          <template v-if="!isPlugin(detailRow)">
            <div class="upload-row">
              <input type="file" multiple @change="(e: Event) => onFileSelected((e.target as HTMLInputElement).files)" />
              <el-button type="primary" size="small" :icon="Upload" :loading="uploading" :disabled="detailFiles.length === 0" @click="handleUpload">上传</el-button>
            </div>
            <p v-if="detailFiles.length" class="sens-tip">已选择 {{ detailFiles.length }} 个文件，单文件 ≤ 64MB</p>
          </template>
          <div v-for="a in detailRow.assets ?? []" :key="a.path" class="access-url-row">
            <span class="access-label">资产</span>
            <code class="access-url mono">{{ a.path }} <span class="asset-meta">({{ a.size ?? '?' }}B · {{ a.mime }})</span></code>
            <el-button size="small" link type="primary" @click="copyText(assetUrl(detailRow, a.path), a.path)">复制链接</el-button>
            <el-button v-if="!isPlugin(detailRow)" size="small" link type="danger" @click="handleRemoveAsset(a.path)">删除</el-button>
          </div>
          <div v-if="!detailRow.assets?.length" class="dim">暂无资产</div>
        </div>

        <div class="detail-actions">
          <el-button size="small" :icon="Refresh" @click="handleRefresh">刷新</el-button>
        </div>

        <div class="danger-card">
          <div class="danger-head">
            <el-icon class="danger-ico"><Warning /></el-icon>
            <span class="danger-title">危险操作</span>
            <span class="danger-sub">删除即不可恢复</span>
          </div>
          <div class="danger-body">
            <p class="danger-desc">删除数据集将清除其全部内容与文件资产，不可恢复。</p>
            <div class="danger-ops">
              <el-button v-if="!isPlugin(detailRow)" size="small" type="danger" plain :icon="Delete" @click="handleRemove">删除数据集</el-button>
            </div>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.panel-header {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-name {
  font-size: 15px;
  font-weight: 600;
}

.detail-key {
  display: inline-block;
  margin-top: 6px;
  color: var(--atlas-muted);
  font-size: 12px;
}

.detail-section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--atlas-stroke);
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--atlas-text);
  margin-bottom: 10px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 14px;
  margin-bottom: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.info-label {
  color: var(--atlas-muted);
}

.sens-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.detail-actions {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--atlas-stroke);
  display: flex;
  gap: 8px;
}

.access-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.access-url-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.access-label {
  width: 56px;
  flex-shrink: 0;
  color: var(--atlas-muted);
  font-size: 13px;
}

.access-url {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--atlas-layer);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
}

.access-curl {
  margin-top: 14px;
}

.access-curl-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--atlas-muted);
}

.access-curl pre {
  margin: 0;
  background: var(--atlas-code-bg);
  color: var(--atlas-code-text);
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
}

.access-assets {
  margin-top: 14px;
}

.asset-meta {
  color: var(--atlas-muted);
}

.sens-tip {
  margin: 0 0 10px;
  color: var(--atlas-muted);
  font-size: 13px;
  line-height: 1.6;
}

.dim {
  color: var(--atlas-faint);
}

/* 危险操作分区（ui-design.md §4.9） */
.danger-card {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--atlas-stroke);
}

.danger-card .danger-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 14px;
  border: 1px solid var(--atlas-danger-line);
  border-bottom: 0;
  border-radius: var(--atlas-r-m) var(--atlas-r-m) 0 0;
  background: var(--atlas-danger-soft);
}

.danger-ico {
  font-size: 18px;
  color: var(--atlas-danger);
  flex-shrink: 0;
}

.danger-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--atlas-danger);
}

.danger-sub {
  font-size: 12px;
  color: var(--atlas-muted);
}

.danger-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 14px;
  border: 1px solid var(--atlas-danger-line);
  border-radius: 0 0 var(--atlas-r-m) var(--atlas-r-m);
}

.danger-desc {
  flex: 1;
  min-width: 200px;
  margin: 0;
  font-size: 12px;
  color: var(--atlas-muted);
  line-height: 1.6;
}

.danger-ops {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}
</style>
