<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, Download, FolderOpened, Document, Link, Upload, Clock } from '@element-plus/icons-vue'
import { modelFileApi } from '../services/promptApi'
import type { ModelFile, DownloadLogEntry } from '../types'

const items = ref<ModelFile[]>([])
const loading = ref(false)
const uploading = ref(false)
const uploadCategory = ref('asr')
const uploadDescription = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const dirInput = ref<HTMLInputElement | null>(null)
const updateTarget = ref<ModelFile | null>(null)
const updateInput = ref<HTMLInputElement | null>(null)
const logsDialogVisible = ref(false)
const logsLoading = ref(false)
const logs = ref<DownloadLogEntry[]>([])
const logsTitle = ref('')

async function fetchAll() {
  loading.value = true
  try {
    items.value = await modelFileApi.list()
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

function openFilePicker() {
  fileInput.value?.click()
}

function openDirPicker() {
  dirInput.value?.click()
}

async function handleFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || !files.length) return
  await doUpload(Array.from(files))
  input.value = ''
}

async function doUpload(files: File[]) {
  uploading.value = true
  try {
    const entry = await modelFileApi.upload(uploadCategory.value || 'default', uploadDescription.value, files)
    ElMessage.success(`已上传「${entry.name}」（v${entry.version}，${entry.fileCount} 个文件）`)
    fetchAll()
  } catch {
    // 已提示
  } finally {
    uploading.value = false
  }
}

/** 更新条目内容（替换 + 版本自增，链接/token 不变）。 */
function openUpdate(row: ModelFile) {
  updateTarget.value = row
  updateInput.value?.click()
}

async function handleUpdateSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  input.value = ''
  if (!files || !files.length || !updateTarget.value) return
  const target = updateTarget.value
  uploading.value = true
  try {
    const entry = await modelFileApi.upload(target.category, target.description, Array.from(files), target.token)
    ElMessage.success(`「${entry.name}」已更新到 v${entry.version}，下载链接不变`)
    fetchAll()
  } catch {
    // 已提示
  } finally {
    uploading.value = false
    updateTarget.value = null
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return bytes + ' B'
}

function handleDownload(row: ModelFile) {
  window.open(modelFileApi.downloadUrl(row.id), '_blank')
}

/** 复制固定下载链接（随机 token，防穷举；创建后不变）。 */
async function handleCopyLink(row: ModelFile) {
  if (!row.token) {
    ElMessage.warning('该条目缺少下载凭证')
    return
  }
  const url = `${window.location.origin}${modelFileApi.tokenDownloadUrl(row.token)}`
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('下载链接已复制')
  } catch {
    await ElMessageBox.alert(url, '复制下载链接', {
      confirmButtonText: '完成',
    })
  }
}

async function handleViewLogs(row: ModelFile) {
  logsTitle.value = `下载日志：${row.name}（累计 ${row.downloadCount} 次）`
  logsDialogVisible.value = true
  logsLoading.value = true
  try {
    logs.value = await modelFileApi.downloadLogs(row.id)
  } finally {
    logsLoading.value = false
  }
}

async function handleDelete(row: ModelFile) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${row.name}」？磁盘文件与下载日志将一并删除，下载链接随即失效。`,
      '删除确认',
      { type: 'warning' },
    )
    await modelFileApi.remove(row.id)
    ElMessage.success('已删除')
    fetchAll()
  } catch {
    // 取消
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">文件管理</h1>
        <p class="page-desc">上传/更新模型文件与任意文件；固定下载链接（随机凭证）+ 版本/HASH 条件下载 + 下载审计</p>
      </div>
      <div>
        <el-button :icon="Refresh" circle :loading="loading" @click="fetchAll" />
      </div>
    </div>

    <div class="surface upload-panel">
      <div class="upload-fields">
        <el-input v-model="uploadCategory" placeholder="分类，如 asr / llm / tts" class="category-input">
          <template #prepend>分类</template>
        </el-input>
        <el-input v-model="uploadDescription" placeholder="描述（可选）" class="desc-input" />
        <el-button type="primary" :loading="uploading" @click="openFilePicker">选择文件上传</el-button>
        <el-button :loading="uploading" @click="openDirPicker">选择目录上传</el-button>
      </div>
      <p class="upload-tip">
        单文件/多文件上传；zip 上传自动解压为目录；选择目录上传保留相对路径。
      </p>
      <input ref="fileInput" type="file" multiple style="display: none" @change="handleFilesSelected" />
      <input ref="dirInput" type="file" multiple webkitdirectory style="display: none" @change="handleFilesSelected" />
      <input ref="updateInput" type="file" multiple style="display: none" @change="handleUpdateSelected" />
    </div>

    <div class="surface">
      <el-table v-loading="loading" :data="items" empty-text="暂无文件">
        <el-table-column label="名称" min-width="200">
          <template #default="{ row }">
            <span class="name-cell">
              <el-icon :size="16" class="muted"><FolderOpened v-if="row.kind === 'DIRECTORY'" /><Document v-else /></el-icon>
              <span>{{ row.name }}</span>
              <el-tag size="small" :type="row.kind === 'DIRECTORY' ? 'warning' : 'info'">
                {{ row.kind === 'DIRECTORY' ? '目录' : '文件' }}
              </el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="success">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="70" prop="version" />
        <el-table-column label="HASH (SHA-256)" min-width="130">
          <template #default="{ row }">
            <span v-if="row.contentHash" class="mono hash-cell">{{ row.contentHash.slice(0, 12) }}…</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="下载" width="90">
          <template #default="{ row }">{{ row.downloadCount }} 次</template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ formatSize(row.totalSize) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="170" prop="updatedAt" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button size="small" circle :icon="Upload" title="更新（替换内容，链接不变）" @click="openUpdate(row)" />
            <el-button size="small" circle :icon="Clock" title="下载日志" @click="handleViewLogs(row)" />
            <el-button size="small" circle :icon="Link" title="复制固定下载链接" @click="handleCopyLink(row)" />
            <el-button size="small" circle :icon="Download" title="下载" @click="handleDownload(row)" />
            <el-button size="small" circle type="danger" plain :icon="Delete" title="删除" @click="handleDelete(row)" />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="logsDialogVisible" :title="logsTitle" width="720px">
      <el-table v-loading="logsLoading" :data="logs" empty-text="暂无下载记录">
        <el-table-column prop="downloadedAt" label="时间" width="180" />
        <el-table-column prop="ip" label="IP" width="150" />
        <el-table-column prop="userAgent" label="User-Agent" show-overflow-tooltip />
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
.upload-panel {
  margin-bottom: 16px;
}

.upload-fields {
  display: flex;
  gap: 10px;
  align-items: center;
}

.category-input {
  width: 200px;
}

.desc-input {
  flex: 1;
}

.upload-tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: #6e6e78;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hash-cell {
  color: #6e6e78;
}
</style>
