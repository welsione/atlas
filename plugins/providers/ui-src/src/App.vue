<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Connection, EditPen, Delete } from '@element-plus/icons-vue'
import { get, post, put, del } from '@atlas/runtime'

const props = defineProps({ appId: { type: Number, required: true } })

const rows = ref([])
const types = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const editing = ref(null)
const form = ref({ name: '', providerType: 'OPENAI_COMPATIBLE', baseUrl: '', apiKey: '', models: '' })
const creating = ref(false)
const testing = ref(null)

const base = () => `/api/apps/${props.appId}/plugins/providers/ep`

async function fetchAll() {
  loading.value = true
  try {
    rows.value = await get(base() + '/list')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchAll()
  types.value = await get(base() + '/types')
})

function openCreate() {
  editing.value = null
  form.value = { name: '', providerType: 'OPENAI_COMPATIBLE', baseUrl: '', apiKey: '', models: '' }
  dialogVisible.value = true
}

function openEdit(row) {
  editing.value = row
  form.value = {
    name: row.name,
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    apiKey: '',
    models: (row.models || []).map((m) => m.modelId).join('\n'),
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.value.name.trim() || !form.value.baseUrl.trim()) {
    ElMessage.warning('请填写名称与 base_url')
    return
  }
  creating.value = true
  try {
    const models = form.value.models
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((modelId) => ({ modelId, contextTokens: null }))
    const payload = { ...form.value, models }
    if (editing.value) {
      await put(`${base()}/update/${editing.value.id}`, payload)
    } else {
      await post(base() + '/create', payload)
    }
    dialogVisible.value = false
    await fetchAll()
  } finally {
    creating.value = false
  }
}

async function handleRemove(row) {
  try {
    await ElMessageBox.confirm(`确认删除「${row.name}」？`, '删除供应商', { type: 'error' })
    await del(`${base()}/delete/${row.id}`)
    await fetchAll()
  } catch {
    // 取消
  }
}

async function handleSetDefault(row) {
  await put(`${base()}/default/${row.id}`)
  await fetchAll()
}

async function handleToggle(row) {
  await put(`${base()}/enabled/${row.id}`, { enabled: !row.enabled })
  await fetchAll()
}

async function handleTest(row) {
  testing.value = row.id
  try {
    const result = await post(`${base()}/test`, { baseUrl: row.baseUrl, apiKey: row.apiKey })
    if (result.success) ElMessage.success(`连接成功（${result.latencyMs}ms）`)
    else ElMessage.error(`连接失败：${result.message}`)
  } finally {
    testing.value = null
  }
}
</script>

<template>
  <div class="surface">
    <div class="panel-header">
      <el-button type="primary" size="small" :icon="Plus" @click="openCreate">新增供应商</el-button>
      <el-button :icon="Refresh" size="small" circle :loading="loading" @click="fetchAll" />
    </div>
    <el-table v-loading="loading" :data="rows" empty-text="暂无供应商">
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column label="类型" width="160">
        <template #default="{ row }"><code class="mono">{{ row.providerType }}</code></template>
      </el-table-column>
      <el-table-column label="模型" min-width="160">
        <template #default="{ row }">
          <div v-for="m in row.models" :key="m.modelId" class="model-chip">{{ m.modelId }}</div>
        </template>
      </el-table-column>
      <el-table-column label="API Key" width="100">
        <template #default="{ row }">{{ row.apiKey ? '••••••••' : '未配置' }}</template>
      </el-table-column>
      <el-table-column label="默认" width="70">
        <template #default="{ row }">
          <el-tag v-if="row.isDefault" size="small" type="warning">默认</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="启用" width="80">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" @change="handleToggle(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" :icon="Connection" :loading="testing === row.id" @click="handleTest(row)">测试</el-button>
          <el-button size="small" :icon="EditPen" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" @click="handleSetDefault(row)">默认</el-button>
          <el-button size="small" type="danger" plain :icon="Delete" @click="handleRemove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑供应商' : '新增供应商'" width="560">
      <el-form label-width="90px">
        <el-form-item label="名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.providerType">
            <el-option v-for="t in types" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="Base URL" required><el-input v-model="form.baseUrl" placeholder="https://api.example.com/v1" /></el-form-item>
        <el-form-item label="API Key"><el-input v-model="form.apiKey" type="password" show-password :placeholder="editing ? '留空保持不变' : ''" /></el-form-item>
        <el-form-item label="模型 ID"><el-input v-model="form.models" type="textarea" :rows="3" placeholder="每行一个模型 ID" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleSave">保存</el-button>
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
.model-chip {
  font-size: 12px;
  background: var(--aibase-bg);
  border-radius: 4px;
  padding: 1px 6px;
  margin: 2px 0;
  display: inline-block;
}
</style>
