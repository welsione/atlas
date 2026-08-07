<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, EditPen, Delete, VideoPlay, Clock } from '@element-plus/icons-vue'
import { get, post, put, del } from '@atlas/runtime'

const props = defineProps({ appId: { type: Number, required: true } })

const rows = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const editing = ref(null)
const form = ref({ name: '', category: 'default', description: '', content: '', variables: '' })
const creating = ref(false)
const renderVisible = ref(false)
const renderTarget = ref(null)
const renderVars = ref('')
const renderResult = ref(null)
const versionsVisible = ref(false)
const versionsTarget = ref(null)
const versions = ref([])

const base = () => `/api/apps/${props.appId}/plugins/prompts/ep`

async function fetchAll() {
  loading.value = true
  try {
    rows.value = await get(base() + '/list')
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

function openCreate() {
  editing.value = null
  form.value = { name: '', category: 'default', description: '', content: '', variables: '' }
  dialogVisible.value = true
}

function openEdit(row) {
  editing.value = row
  form.value = {
    name: row.name,
    category: row.category,
    description: row.description,
    content: row.content,
    variables: (row.variables || []).map((v) => v.name).join(', '),
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.value.name.trim() || !form.value.content.trim()) {
    ElMessage.warning('请填写名称与内容')
    return
  }
  creating.value = true
  try {
    const variables = form.value.variables
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name, description: '', required: false }))
    const payload = { ...form.value, variables }
    if (editing.value) await put(`${base()}/update/${editing.value.id}`, payload)
    else await post(base() + '/create', payload)
    dialogVisible.value = false
    await fetchAll()
  } finally {
    creating.value = false
  }
}

async function handleRemove(row) {
  try {
    await ElMessageBox.confirm(`确认删除「${row.name}」？`, '删除提示词', { type: 'error' })
    await del(`${base()}/delete/${row.id}`)
    await fetchAll()
  } catch {
    // 取消
  }
}

function openRender(row) {
  renderTarget.value = row
  renderVars.value = ''
  renderResult.value = null
  renderVisible.value = true
}

async function doRender() {
  const variables = {}
  for (const line of renderVars.value.split('\n')) {
    const idx = line.indexOf('=')
    if (idx > 0) variables[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  renderResult.value = await post(`${base()}/render/${renderTarget.value.id}`, { variables })
}

async function openVersions(row) {
  versionsTarget.value = row
  versions.value = await get(`${base()}/versions/${row.id}`)
  versionsVisible.value = true
}
</script>

<template>
  <div class="surface">
    <div class="panel-header">
      <el-button type="primary" size="small" :icon="Plus" @click="openCreate">新增提示词</el-button>
      <el-button :icon="Refresh" size="small" circle :loading="loading" @click="fetchAll" />
    </div>
    <el-table v-loading="loading" :data="rows" empty-text="暂无提示词">
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="category" label="分类" width="100" />
      <el-table-column label="内容预览" min-width="220" show-overflow-tooltip>
        <template #default="{ row }"><span class="preview">{{ row.content }}</span></template>
      </el-table-column>
      <el-table-column prop="version" label="版本" width="70" />
      <el-table-column label="启用" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="250" fixed="right">
        <template #default="{ row }">
          <el-button size="small" :icon="VideoPlay" @click="openRender(row)">渲染</el-button>
          <el-button size="small" :icon="Clock" @click="openVersions(row)">历史</el-button>
          <el-button size="small" :icon="EditPen" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" plain :icon="Delete" @click="handleRemove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑提示词' : '新增提示词'" width="600">
      <el-form label-width="80px">
        <el-form-item label="名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="form.category" placeholder="default" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" /></el-form-item>
        <el-form-item label="变量"><el-input v-model="form.variables" placeholder="逗号分隔，如 text,lang" /></el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="form.content" type="textarea" :rows="6" placeholder="支持 {{变量}} 占位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="renderVisible" :title="`渲染测试：${renderTarget?.name ?? ''}`" width="560">
      <el-alert type="info" :closable="false" title="每行一个变量，格式 name=value" style="margin-bottom: 10px" />
      <el-input v-model="renderVars" type="textarea" :rows="4" placeholder="text=你好" />
      <div v-if="renderResult" class="render-result">
        <div class="render-title">结果</div>
        <pre class="render-content">{{ renderResult.content }}</pre>
        <div v-if="Object.keys(renderResult.missingVariables).length" class="missing">
          缺失变量：{{ Object.keys(renderResult.missingVariables).join(', ') }}
        </div>
      </div>
      <template #footer>
        <el-button @click="renderVisible = false">关闭</el-button>
        <el-button type="primary" @click="doRender">渲染</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="versionsVisible" :title="`版本历史：${versionsTarget?.name ?? ''}`" width="560">
      <el-table :data="versions" size="small">
        <el-table-column prop="version" label="版本" width="70" />
        <el-table-column label="内容" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.content }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="170" />
      </el-table>
      <template #footer>
        <el-button type="primary" @click="versionsVisible = false">关闭</el-button>
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
.preview {
  color: var(--aibase-muted);
  font-size: 13px;
}
.render-result {
  margin-top: 14px;
  background: var(--aibase-bg);
  border-radius: 8px;
  padding: 12px;
}
.render-title {
  font-size: 12px;
  color: var(--aibase-muted);
  margin-bottom: 6px;
}
.render-content {
  margin: 0;
  white-space: pre-wrap;
  font-size: 13px;
}
.missing {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 6px;
}
</style>
