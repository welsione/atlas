<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, Download, Link, Upload, CopyDocument, Search, FolderOpened, Files } from '@element-plus/icons-vue'
import { get, post, del } from '@atlas/runtime'

const props = defineProps({ appId: { type: Number, required: true } })

const rows = ref([])
const loading = ref(false)
const loadError = ref('')
const category = ref('default')
const description = ref('')
const selectedFiles = ref([])
const uploading = ref(false)
const keyword = ref('')
const categoryFilter = ref('')
const updateTarget = ref(null)

const base = () => `/api/apps/${props.appId}/plugins/model-files/ep`

const categories = computed(() => ['全部', ...[...new Set(rows.value.map((r) => r.category))].sort()])

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (categoryFilter.value && categoryFilter.value !== '全部' && r.category !== categoryFilter.value) return false
    if (!kw) return true
    return r.name.toLowerCase().includes(kw) || (r.description || '').toLowerCase().includes(kw)
  })
})

/* 请求序号守卫：切应用复用面板时旧响应晚到不得覆盖新数据 */
let fetchSeq = 0
async function fetchAll() {
  const seq = ++fetchSeq
  loading.value = true
  try {
    const rows = await get(base() + '/list')
    if (seq !== fetchSeq) return
    rows.value = rows
    loadError.value = ''
  } catch (e) {
    if (seq === fetchSeq) loadError.value = e?.message || '加载失败，请刷新重试'
  } finally {
    if (seq === fetchSeq) loading.value = false
  }
}

onMounted(fetchAll)

function onFilesChange(file, uploadFiles) {
  // 只认 status==='ready' 的文件选择事件；uploadFiles 为 el-upload 本次会话全量，用它整体同步
  // （过滤掉拖拽经过触发的 start/success 等中间态与空文件）
  selectedFiles.value = (uploadFiles ?? []).filter((f) => f.status === 'ready' && f.raw)
}

function removePicked(index) {
  selectedFiles.value = selectedFiles.value.filter((_, i) => i !== index)
}

function fmtSize(bytes) {
  if (bytes == null) return ''
  return new Intl.NumberFormat('zh-CN', { style: 'unit', unit: 'byte', notation: 'compact', maximumFractionDigits: 1 }).format(bytes)
}

function enterUpdate(row) {
  updateTarget.value = row
  category.value = row.category
  description.value = row.description || ''
  selectedFiles.value = []
}

function exitUpdate() {
  updateTarget.value = null
  category.value = 'default'
  description.value = ''
  selectedFiles.value = []
}

async function handleUpload() {
  if (!selectedFiles.value.length) {
    ElMessage.warning('请选择文件')
    return
  }
  uploading.value = true
  try {
    const form = new FormData()
    form.append('category', category.value)
    form.append('description', description.value)
    if (updateTarget.value) form.append('updateId', String(updateTarget.value.id))
    for (const f of selectedFiles.value) {
      form.append('files', f.raw, f.name)
    }
    const result = await post(base() + '/upload', form)
    ElMessage.success(updateTarget.value ? `「${updateTarget.value.name}」已更新为 v${result.version}` : '上传成功')
    exitUpdate()
    await fetchAll()
  } finally {
    uploading.value = false
  }
}

async function handleRemove(row) {
  const label = row.kind === 'DIRECTORY' ? `${row.name}（${row.fileCount} 个文件）` : row.name
  try {
    await ElMessageBox.confirm(`确认删除「${label}」？删除后公开链接失效，不可恢复。`, '删除模型文件', { type: 'error' })
    await del(`${base()}/delete/${row.id}`)
    await fetchAll()
    ElMessage.success('已删除')
  } catch {
    // 取消
  }
}

async function ensureToken(row) {
  if (row.token) return row.token
  if (row.kind === 'DIRECTORY') {
    ElMessage.warning('目录（多文件）不支持公开下载链接')
    return null
  }
  const result = await post(`${base()}/publish/${row.id}`)
  ElMessage.success('已生成公开链接')
  await fetchAll()
  return result.token
}

async function handleDownload(row) {
  const token = await ensureToken(row)
  if (token) window.open(`/api/files/${token}/download`, '_blank')
}

async function handleCopyLink(row) {
  const token = await ensureToken(row)
  if (!token) return
  try {
    await navigator.clipboard.writeText(`${location.origin}/api/files/${token}/download`)
    ElMessage.success('下载链接已复制')
  } catch {
    ElMessage.warning('复制失败，请手动复制 token')
  }
}

const byteFmt = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })
function fmtBytes(n) {
  if (n == null) return '—'
  return n >= 1048576 ? `${byteFmt.format(n / 1048576)} MB` : n >= 1024 ? `${byteFmt.format(n / 1024)} KB` : `${n} B`
}

/** 后端 UTC 时间 → 本地时区「YYYY/MM/DD HH:mm」。 */
const timeFmt = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
function fmtTime(ts) {
  if (!ts) return '—'
  const iso = ts.includes('T') ? ts : `${ts.replace(' ', 'T')}Z`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? ts : timeFmt.format(d)
}
</script>

<template>
  <div class="surface">
    <!-- 上传区 -->
    <div class="upload-box">
      <div v-if="updateTarget" class="update-banner">
        <el-tag type="warning" size="small" effect="dark">更新模式</el-tag>
        <span class="update-name">正在更新「{{ updateTarget.name }}」（v{{ updateTarget.version }}），上传文件将替换全部内容</span>
        <el-button size="small" text type="info" @click="exitUpdate">取消更新</el-button>
      </div>
      <!-- show-file-list 关闭：el-upload 内部列表对空文件/拖拽经过会追加空名条目（一次选择显示多条），
           已选文件改由下方 selectedFiles 自渲染（唯一事实来源 = on-change ready 回调同步） -->
      <el-upload drag multiple :auto-upload="false" :show-file-list="false" :on-change="onFilesChange" class="dropzone">
        <el-icon class="el-icon--upload"><Upload /></el-icon>
        <div class="el-upload__text">拖拽文件到此处，或<em>点击选择</em>（多选 = 目录形式）</div>
      </el-upload>
      <ul v-if="selectedFiles.length" class="picked-list" aria-label="已选择的上传文件">
        <li v-for="(f, i) in selectedFiles" :key="`${f.name}-${i}`" class="picked-item">
          <el-icon class="picked-ico"><Files /></el-icon>
          <span class="picked-name" :title="f.name">{{ f.name || '(未命名文件)' }}</span>
          <span class="picked-size muted">{{ fmtSize(f.size) }}</span>
          <el-tooltip :content="`移除 ${f.name || '未命名文件'}`" placement="top">
            <el-button size="small" text type="danger" :icon="Delete" :aria-label="`移除 ${f.name || '未命名文件'}`" @click="removePicked(i)" />
          </el-tooltip>
        </li>
      </ul>
      <div class="upload-row">
        <el-input v-model="category" name="file-category" autocomplete="off" placeholder="分类（default）" style="width: 160px" />
        <el-input v-model="description" name="file-desc" autocomplete="off" placeholder="描述（可选）" style="width: 260px" />
        <el-button type="primary" :loading="uploading" @click="handleUpload">{{ updateTarget ? '更新文件' : '上传' }}</el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-radio-group v-model="categoryFilter" size="small">
        <el-radio-button v-for="c in categories" :key="c" :value="c">{{ c }}</el-radio-button>
      </el-radio-group>
      <div class="spacer" />
      <el-input v-model="keyword" class="search" :prefix-icon="Search" placeholder="搜索名称 / 描述…" clearable />
      <el-button :icon="Refresh" size="small" circle aria-label="刷新列表" :loading="loading" @click="fetchAll" />
    </div>

    <el-table v-loading="loading" :data="filtered" :empty-text="loadError || '暂无模型文件'">
      <el-table-column label="名称" min-width="170">
        <template #default="{ row }">
          <div class="name-cell">
            <el-icon v-if="row.kind === 'DIRECTORY'" class="dir-icon" aria-hidden="true"><FolderOpened /></el-icon>
            <el-icon v-else class="file-icon" aria-hidden="true"><Files /></el-icon>
            <span class="main">{{ row.name }}</span>
            <el-tag v-if="row.fileCount > 1" size="small" type="warning" effect="plain">{{ row.fileCount }} 文件</el-tag>
            <el-popover v-if="row.fileCount > 1" placement="right" width="320" trigger="hover">
              <template #reference>
                <el-button size="small" text type="primary">查看清单</el-button>
              </template>
              <div class="file-list">
                <div v-for="f in row.files" :key="f.path" class="file-item">
                  <span class="f-name" :title="f.path">{{ f.path }}</span>
                  <span class="f-size muted">{{ fmtBytes(f.sizeBytes) }}</span>
                  <span class="f-sha muted" :title="f.checksum">{{ f.checksum.slice(0, 8) }}</span>
                </div>
              </div>
            </el-popover>
          </div>
          <div v-if="row.description" class="desc muted">{{ row.description }}</div>
        </template>
      </el-table-column>
      <el-table-column label="分类" width="90">
        <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.category }}</el-tag></template>
      </el-table-column>
      <el-table-column label="大小" width="90" align="right">
        <template #default="{ row }">{{ fmtBytes(row.totalSize) }}</template>
      </el-table-column>
      <el-table-column label="版本" width="70" align="center">
        <template #default="{ row }"><el-tag size="small" type="warning" effect="plain">v{{ row.version }}</el-tag></template>
      </el-table-column>
      <el-table-column label="下载" width="70" align="center">
        <template #default="{ row }">{{ row.downloadCount }}</template>
      </el-table-column>
      <el-table-column label="公开链接" min-width="150">
        <template #default="{ row }">
          <div v-if="row.token" class="token-cell">
            <code class="mono">{{ row.token.slice(0, 12) }}…</code>
            <el-tooltip content="复制公开下载链接" placement="top">
              <el-button size="small" text type="primary" :icon="CopyDocument" aria-label="复制公开下载链接" @click="handleCopyLink(row)" />
            </el-tooltip>
          </div>
          <el-tag v-else size="small" type="info" effect="plain">未托管</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="140">
        <template #default="{ row }">{{ fmtTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="上传新版本替换全部内容" placement="top">
            <el-button size="small" :icon="Upload" aria-label="更新文件" @click="enterUpdate(row)">更新</el-button>
          </el-tooltip>
          <el-tooltip :content="row.kind === 'DIRECTORY' && !row.token ? '目录（多文件）不支持公开下载' : '下载到本地'" placement="top">
            <el-button size="small" type="primary" plain :icon="Download" aria-label="下载文件" :disabled="row.kind === 'DIRECTORY' && !row.token" @click="handleDownload(row)">下载</el-button>
          </el-tooltip>
          <el-tooltip content="删除后公开链接失效，不可恢复" placement="top">
            <el-button size="small" type="danger" plain :icon="Delete" aria-label="删除文件" @click="handleRemove(row)">删除</el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.upload-box {
  margin-bottom: 14px;
  padding: 14px;
  background: var(--atlas-bg);
  border-radius: var(--atlas-r-s);
}
.update-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
}
.update-name { flex: 1; }
.dropzone :deep(.el-upload-dragger) {
  padding: 18px;
}
.picked-list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  border: 1px solid var(--atlas-stroke);
  border-radius: var(--atlas-r-s);
  max-height: 220px;
  overflow: auto;
}
.picked-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
}
.picked-item + .picked-item {
  border-top: 1px solid var(--atlas-stroke);
}
.picked-ico {
  color: var(--atlas-muted);
  flex-shrink: 0;
}
.picked-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picked-size {
  flex-shrink: 0;
}
.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.spacer { flex: 1; }
.search { width: 200px; }
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}
.name-cell .main {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dir-icon { color: var(--atlas-warning); }
.file-icon { color: var(--atlas-muted); }
.desc {
  font-size: 12px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}
.token-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}
.file-list {
  max-height: 260px;
  overflow: auto;
}
.file-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
  align-items: baseline;
}
.f-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.f-size { width: 64px; text-align: right; flex-shrink: 0; }
.f-sha { width: 60px; flex-shrink: 0; }
.muted { color: var(--atlas-muted); }

@media (max-width: 640px) {
  .search {
    width: 100%;
    order: -1;
  }
  .spacer {
    display: none;
  }
  .upload-row {
    gap: 8px;
  }
  .upload-row .el-input {
    flex: 1 1 100%;
  }
  .upload-row .el-input[style*='260'],
  .upload-row .el-input[style*='160'] {
    width: 100% !important;
  }
  .picked-item .el-button {
    flex-shrink: 0;
  }
}
</style>
