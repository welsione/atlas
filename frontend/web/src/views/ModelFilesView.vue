<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, Download, FolderOpened, Document } from '@element-plus/icons-vue'
import { modelFileApi } from '../services/promptApi'
import type { ModelFile } from '../types'

const items = ref<ModelFile[]>([])
const loading = ref(false)
const uploading = ref(false)
const uploadCategory = ref('asr')
const uploadDescription = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const dirInput = ref<HTMLInputElement | null>(null)

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
    ElMessage.success(`已上传「${entry.name}」（${entry.fileCount} 个文件）`)
    fetchAll()
  } catch {
    // 已提示
  } finally {
    uploading.value = false
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

async function handleDelete(row: ModelFile) {
  try {
    await ElMessageBox.confirm(
      `确认删除模型「${row.name}」？磁盘文件将一并删除。`,
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
        <h1 class="page-title">模型文件</h1>
        <p class="page-desc">上传与管理模型文件/目录（如 ASR 模型）；目录整体上传或 zip 自动解压，下载时目录打包为 zip</p>
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
        单文件/多文件上传；zip 上传自动解压为目录；选择目录上传会保留目录内相对路径。
      </p>
      <input
        ref="fileInput"
        type="file"
        multiple
        style="display: none"
        @change="handleFilesSelected"
      />
      <input
        ref="dirInput"
        type="file"
        multiple
        webkitdirectory
        style="display: none"
        @change="handleFilesSelected"
      />
    </div>

    <div class="surface">
      <el-table v-loading="loading" :data="items" empty-text="暂无模型文件">
        <el-table-column label="名称" min-width="220">
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
        <el-table-column label="分类" width="110">
          <template #default="{ row }">
            <el-tag size="small" type="success">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="描述" min-width="140" show-overflow-tooltip prop="description" />
        <el-table-column label="文件数" width="80" prop="fileCount" />
        <el-table-column label="大小" width="110">
          <template #default="{ row }">{{ formatSize(row.totalSize) }}</template>
        </el-table-column>
        <el-table-column label="上传时间" width="170" prop="createdAt" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" circle :icon="Download" title="下载" @click="handleDownload(row)" />
            <el-button size="small" circle type="danger" plain :icon="Delete" title="删除" @click="handleDelete(row)" />
          </template>
        </el-table-column>
      </el-table>
    </div>
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
</style>
