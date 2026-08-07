<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { datasetApi } from '../../services/datasetApi'
import type { Dataset, DatasetSensitivity } from '../../types'

const props = defineProps<{ appId: number }>()

const rows = ref<Dataset[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const form = ref({ name: '', description: '', sensitivity: 'PUBLIC' as DatasetSensitivity, contentJson: '{}' })
const creating = ref(false)

async function fetchAll() {
  loading.value = true
  try {
    rows.value = await datasetApi.list(props.appId)
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

async function handleCreate() {
  if (!form.value.name.trim()) return
  creating.value = true
  try {
    await datasetApi.create(props.appId, {
      name: form.value.name.trim(),
      description: form.value.description,
      sensitivity: form.value.sensitivity,
      contentJson: form.value.contentJson || '{}',
    })
    dialogVisible.value = false
    form.value = { name: '', description: '', sensitivity: 'PUBLIC', contentJson: '{}' }
    await fetchAll()
  } finally {
    creating.value = false
  }
}

async function handleRefresh(row: Dataset) {
  await datasetApi.refresh(props.appId, row.id)
  await fetchAll()
}

async function handleRemove(row: Dataset) {
  await datasetApi.remove(props.appId, row.id)
  await fetchAll()
}

function sensTag(s: string) {
  return s === 'PUBLIC' ? 'success' : s === 'INTERNAL' ? 'warning' : 'danger'
}
</script>

<template>
  <div class="surface">
    <div class="panel-header">
      <el-button type="primary" size="small" @click="dialogVisible = true">新建数据集</el-button>
      <el-button :icon="Refresh" size="small" circle :loading="loading" @click="fetchAll" />
    </div>
    <el-table v-loading="loading" :data="rows" empty-text="暂无数据集">
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="datasetKey" label="Key" min-width="120">
        <template #default="{ row }"><code class="mono">{{ row.datasetKey || '—' }}</code></template>
      </el-table-column>
      <el-table-column label="敏感度" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="sensTag(row.sensitivity)">{{ row.sensitivity }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="version" label="版本" width="70" />
      <el-table-column label="Token" min-width="200">
        <template #default="{ row }"><code class="mono">{{ row.token.slice(0, 16) }}…</code></template>
      </el-table-column>
      <el-table-column label="刷新" width="80">
        <template #default="{ row }">{{ row.refreshMode === 'SCHEDULED' ? '定时' : '手动' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleRefresh(row)">刷新</el-button>
          <el-button size="small" type="danger" plain @click="handleRemove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="新建数据集" width="520">
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
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.panel-header {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
