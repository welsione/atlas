<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, Download, Link, Upload, CopyDocument, Search, FolderOpened, Files } from '@element-plus/icons-vue'
import { get, post, del } from '@atlas/runtime'

const props = defineProps({ appId: { type: Number, required: true } })

const rows = ref([])
const loading = ref(false)
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

async function fetchAll() {
  loading.value = true
  try {
    rows.value = await get(base() + '/list')
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

function onFilesChange(fileList) {
  selectedFiles.value = fileList
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

function fmtBytes(n) {
  if (n == null) return '—'
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`
}

function fmtTime(ts) {
  return ts ? ts.replace('T', ' ').slice(0, 16) : '—'
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
      <el-upload drag multiple :auto-upload="false" :on-change="onFilesChange" :file-list="selectedFiles" class="dropzone">
        <el-icon class="el-icon--upload"><Upload /></el-icon>
        <div class="el-upload__text">拖拽文件到此处，或<em>点击选择</em>（多选 = 目录形式）</div>
      </el-upload>
      <div class="upload-row">
        <el-input v-model="category" placeholder="分类（default）" style="width: 160px" />
        <el-input v-model="description" placeholder="描述（可选）" style="width: 260px" />
        <el-button type="primary" :loading="uploading" @click="handleUpload">{{ updateTarget ? '更新文件' : '上传' }}</el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-radio-group v-model="categoryFilter" size="small">
        <el-radio-button v-for="c in categories" :key="c" :value="c">{{ c }}</el-radio-button>
      </el-radio-group>
      <div class="spacer" />
      <el-input v-model="keyword" class="search" :prefix-icon="Search" placeholder="搜索名称 / 描述" clearable />
      <el-button :icon="Refresh" size="small" circle :loading="loading" @click="fetchAll" />
    </div>

    <el-table v-loading="loading" :data="filtered" empty-text="暂无模型文件">
      <el-table-column label="名称" min-width="170">
        <template #default="{ row }">
          <div class="name-cell">
            <el-icon v-if="row.kind === 'DIRECTORY'" class="dir-icon"><FolderOpened /></el-icon>
            <el-icon v-else class="file-icon"><Files /></el-icon>
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
            <el-button size="small" text type="primary" :icon="CopyDocument" @click="handleCopyLink(row)">复制</el-button>
          </div>
          <el-tag v-else size="small" type="info" effect="plain">未托管</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="140">
        <template #default="{ row }">{{ fmtTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" :icon="Upload" @click="enterUpdate(row)">更新</el-button>
          <el-button size="small" type="primary" plain :icon="Download" :disabled="row.kind === 'DIRECTORY' && !row.token" @click="handleDownload(row)">下载</el-button>
          <el-button size="small" type="danger" plain :icon="Delete" @click="handleRemove(row)">删除</el-button>
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
  border-radius: 8px;
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
.dir-icon { color: #e6a23c; }
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
  font-family: monospace;
}
.f-size { width: 64px; text-align: right; flex-shrink: 0; }
.f-sha { width: 60px; flex-shrink: 0; }
.muted { color: var(--atlas-muted); }
</style>
