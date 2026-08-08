<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, EditPen, Delete, VideoPlay, Clock, Search, Back } from '@element-plus/icons-vue'
import { get, post, put, del } from '@atlas/runtime'

const props = defineProps({ appId: { type: Number, required: true } })

const rows = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const editing = ref(null)
const creating = ref(false)
const renderVisible = ref(false)
const renderTarget = ref(null)
const renderValues = ref({})
const renderResult = ref(null)
const renderLoading = ref(false)
const versionsVisible = ref(false)
const versionsTarget = ref(null)
const versions = ref([])
const keyword = ref('')
const categoryFilter = ref('')

const base = () => `/api/apps/${props.appId}/plugins/prompts/ep`

const categories = computed(() => ['全部', ...[...new Set(rows.value.map((r) => r.category))].sort()])

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (categoryFilter.value && categoryFilter.value !== '全部' && r.category !== categoryFilter.value) return false
    if (!kw) return true
    return r.name.toLowerCase().includes(kw) || r.content.toLowerCase().includes(kw) || (r.description || '').toLowerCase().includes(kw)
  })
})

/** 编辑表单中的变量行（name + required）。 */
const varRows = ref([])

async function fetchAll() {
  loading.value = true
  try {
    rows.value = await get(base() + '/list')
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

const emptyForm = () => ({ name: '', category: 'default', description: '', content: '', enabled: true })

function openCreate() {
  editing.value = null
  form.value = emptyForm()
  varRows.value = []
  dialogVisible.value = true
}

function openEdit(row) {
  editing.value = row
  form.value = { name: row.name, category: row.category, description: row.description, content: row.content, enabled: row.enabled }
  varRows.value = (row.variables || []).map((v) => ({ name: v.name, required: !!v.required }))
  dialogVisible.value = true
}

const form = ref(emptyForm())

async function handleSave() {
  if (!form.value.name.trim() || !form.value.content.trim()) {
    ElMessage.warning('请填写名称与内容')
    return
  }
  const variables = varRows.value
    .map((v) => ({ name: v.name.trim(), description: '', required: v.required }))
    .filter((v) => v.name)
  creating.value = true
  try {
    const payload = { ...form.value, variables }
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
    await ElMessageBox.confirm(`确认删除「${row.name}」？`, '删除提示词', { type: 'error' })
    await del(`${base()}/delete/${row.id}`)
    await fetchAll()
    ElMessage.success('已删除')
  } catch {
    // 取消
  }
}

async function handleToggle(row) {
  await put(`${base()}/update/${row.id}`, { enabled: !row.enabled })
  await fetchAll()
}

/** 自动提取内容中的 {{变量}}（含手动声明的必填变量）。 */
function extractVars(content, declared) {
  const found = new Set()
  for (const m of content.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) found.add(m[1])
  for (const v of declared || []) if (v.name) found.add(v.name)
  return [...found]
}

function openRender(row) {
  renderTarget.value = row
  const names = extractVars(row.content, row.variables)
  const values = {}
  for (const v of row.variables || []) if (v.name) values[v.name] = ''
  for (const n of names) if (values[n] === undefined) values[n] = ''
  renderValues.value = values
  renderResult.value = null
  renderVisible.value = true
}

const declaredRequired = computed(() => new Set((renderTarget.value?.variables || []).filter((v) => v.required).map((v) => v.name)))

async function doRender() {
  renderLoading.value = true
  try {
    renderResult.value = await post(`${base()}/render/${renderTarget.value.id}`, { variables: renderValues.value })
  } finally {
    renderLoading.value = false
  }
}

async function openVersions(row) {
  versionsTarget.value = row
  versions.value = await get(`${base()}/versions/${row.id}`)
  versionsVisible.value = true
}

async function handleRestore(v) {
  try {
    await ElMessageBox.confirm(`确认将「${versionsTarget.value.name}」恢复到 v${v.version}？将生成新版本 ${versionsTarget.value.version + 1}。`, '恢复版本', { type: 'warning' })
    await post(`${base()}/restore/${versionsTarget.value.id}`, { version: v.version })
    versionsVisible.value = false
    await fetchAll()
    ElMessage.success('已恢复')
  } catch {
    // 取消
  }
}

function fmtTime(ts) {
  return ts ? ts.replace('T', ' ').slice(0, 16) : ''
}
</script>

<template>
  <div class="surface">
    <div class="filter-bar">
      <el-radio-group v-model="categoryFilter" size="small">
        <el-radio-button v-for="c in categories" :key="c" :value="c">{{ c }}</el-radio-button>
      </el-radio-group>
      <div class="spacer" />
      <el-input v-model="keyword" class="search" :prefix-icon="Search" placeholder="搜索名称 / 内容" clearable />
      <el-button type="primary" size="small" :icon="Plus" @click="openCreate">新增提示词</el-button>
      <el-button :icon="Refresh" size="small" circle :loading="loading" @click="fetchAll" />
    </div>

    <el-table v-loading="loading" :data="filtered" empty-text="暂无提示词">
      <el-table-column label="名称" min-width="140">
        <template #default="{ row }">
          <div class="name-cell">
            <span class="main">{{ row.name }}</span>
            <el-tag v-if="row.category !== 'default'" size="small" effect="plain">{{ row.category }}</el-tag>
          </div>
          <div v-if="row.description" class="desc muted">{{ row.description }}</div>
        </template>
      </el-table-column>
      <el-table-column label="内容预览" min-width="220" show-overflow-tooltip>
        <template #default="{ row }"><span class="preview">{{ row.content }}</span></template>
      </el-table-column>
      <el-table-column label="变量" min-width="150">
        <template #default="{ row }">
          <div class="var-chips">
            <el-tag v-if="!row.variables.length" size="small" type="info" effect="plain">无</el-tag>
            <el-tag v-for="v in row.variables" :key="v.name" size="small" :type="v.required ? 'danger' : 'info'" effect="plain">
              {{ v.name }}{{ v.required ? ' *' : '' }}
            </el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="版本" width="80" align="center">
        <template #default="{ row }">
          <el-tag size="small" type="warning" effect="plain">v{{ row.version }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="启用" width="80">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" @change="handleToggle(row)" />
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

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑提示词' : '新增提示词'" width="640">
      <el-form label-width="80px">
        <el-form-item label="名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" allow-create filterable default-first-option style="width: 240px">
            <el-option v-for="c in categories.filter((c) => c !== '全部')" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" placeholder="一句话说明用途（列表展示）" /></el-form-item>
        <el-form-item label="变量">
          <div class="var-editor">
            <div v-for="(v, i) in varRows" :key="i" class="var-row">
              <el-input v-model="v.name" size="small" placeholder="变量名，如 text" class="var-name" />
              <el-checkbox v-model="v.required" size="small">必填</el-checkbox>
              <el-button size="small" text type="danger" :icon="Delete" @click="varRows.splice(i, 1)" />
            </div>
            <el-button size="small" plain :icon="Plus" @click="varRows.push({ name: '', required: false })">添加变量</el-button>
          </div>
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="form.content" type="textarea" :rows="7" placeholder="支持 {{变量}} 占位" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="renderVisible" :title="`渲染测试：${renderTarget?.name ?? ''}`" width="600">
      <div class="render-vars">
        <div v-for="(name) in Object.keys(renderValues)" :key="name" class="render-var-row">
          <span class="render-var-name" :class="{ required: declaredRequired.has(name) }">
            {{ name }}<span v-if="declaredRequired.has(name)" class="star">*</span>
          </span>
          <el-input v-model="renderValues[name]" size="small" :placeholder="`{{${name}}}`" @keyup.enter="doRender" />
        </div>
      </div>
      <div v-if="renderResult" class="render-result">
        <div class="render-title">结果</div>
        <pre class="render-content">{{ renderResult.content }}</pre>
        <div v-if="Object.keys(renderResult.missingVariables).length" class="missing">
          缺失必填变量：{{ Object.keys(renderResult.missingVariables).join(', ') }}
        </div>
      </div>
      <template #footer>
        <el-button @click="renderVisible = false">关闭</el-button>
        <el-button type="primary" :loading="renderLoading" @click="doRender">渲染</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="versionsVisible" :title="`版本历史：${versionsTarget?.name ?? ''}`" width="640">
      <el-table :data="versions" size="small" empty-text="暂无历史版本">
        <el-table-column label="版本" width="90">
          <template #default="{ row }"><el-tag size="small" type="warning" effect="plain">v{{ row.version }}</el-tag></template>
        </el-table-column>
        <el-table-column label="内容" min-width="260" show-overflow-tooltip>
          <template #default="{ row }"><span class="preview">{{ row.content }}</span></template>
        </el-table-column>
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" :icon="Back" @click="handleRestore(row)">恢复</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button type="primary" @click="versionsVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
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
}
.name-cell .main {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.desc {
  font-size: 12px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}
.preview {
  color: var(--aibase-muted);
  font-size: 13px;
}
.var-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.var-editor {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.var-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.var-name { flex: 1; }
.render-vars {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.render-var-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.render-var-name {
  width: 120px;
  font-size: 13px;
  font-family: monospace;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.render-var-name.required { color: #f56c6c; }
.star { margin-left: 2px; }
.render-result {
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
.muted { color: var(--aibase-muted); }
</style>
