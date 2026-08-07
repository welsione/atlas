<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, Download, Link, Upload } from '@element-plus/icons-vue'
import { get, post, del } from '@atlas/runtime'

const props = defineProps({ appId: { type: Number, required: true } })

const rows = ref([])
const loading = ref(false)
const category = ref('default')
const description = ref('')
const selectedFiles = ref([])
const uploading = ref(false)

const base = () => `/api/apps/${props.appId}/plugins/model-files/ep`

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
    for (const f of selectedFiles.value) {
      form.append('files', f.raw, f.name)
    }
    await post(base() + '/upload', form)
    ElMessage.success('上传成功')
    selectedFiles.value = []
    category.value = 'default'
    description.value = ''
    await fetchAll()
  } finally {
    uploading.value = false
  }
}

async function handleRemove(row) {
  try {
    await ElMessageBox.confirm(`确认删除「${row.name}」？`, '删除模型文件', { type: 'error' })
    await del(`${base()}/delete/${row.id}`)
    await fetchAll()
  } catch {
    // 取消
  }
}

async function handlePublish(row) {
  const result = await post(`${base()}/publish/${row.id}`)
  ElMessage.success('已公开托管')
  await fetchAll()
  return result
}

function tokenUrl(row) {
  return row.token ? `/api/files/${row.token}/download` : ''
}

function fmtBytes(n) {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`
}
</script>

<template>
  <div class="surface">
    <div class="panel-header">
      <el-button :icon="Refresh" size="small" circle :loading="loading" @click="fetchAll" />
    </div>

    <!-- 上传区 -->
    <div class="upload-box">
      <div class="upload-row">
        <el-input v-model="category" placeholder="分类（default）" style="width: 160px" />
        <el-input v-model="description" placeholder="描述（可选）" style="width: 220px" />
        <el-upload :auto-upload="false" :on-change="onFilesChange" multiple :show-file-list="true">
          <el-button type="primary" :icon="Upload" plain>选择文件</el-button>
        </el-upload>
        <el-button type="primary" :loading="uploading" @click="handleUpload">上传</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" empty-text="暂无模型文件">
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="category" label="分类" width="100" />
      <el-table-column prop="kind" label="类型" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.kind === 'DIRECTORY' ? 'warning' : 'info'">{{ row.kind === 'DIRECTORY' ? '目录' : '文件' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ fmtBytes(row.totalSize) }}</template>
      </el-table-column>
      <el-table-column prop="version" label="版本" width="70" />
      <el-table-column prop="downloadCount" label="下载" width="80" />
      <el-table-column label="公开链接" min-width="160">
        <template #default="{ row }">
          <code v-if="row.token" class="mono">{{ row.token.slice(0, 12) }}…</code>
          <span v-else class="muted">未托管</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="handlePublish(row)">托管</el-button>
          <el-button size="small" type="primary" plain :icon="Link" @click="window.open(tokenUrl(row), '_blank')">下载</el-button>
          <el-button size="small" type="danger" plain :icon="Delete" @click="handleRemove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.panel-header {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}
.upload-box {
  margin-bottom: 14px;
  padding: 14px;
  background: var(--aibase-bg);
  border-radius: 8px;
}
.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.muted {
  color: var(--aibase-muted);
  font-size: 12px;
}
</style>
