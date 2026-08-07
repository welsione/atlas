<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, EditPen, Delete, VideoPlay, Clock } from '@element-plus/icons-vue'
import { promptApi } from '../services/promptApi'
import type { Prompt, PromptRequest, PromptVariable } from '../types'

const prompts = ref<Prompt[]>([])
const loading = ref(false)
const drawerVisible = ref(false)
const editingId = ref<number | null>(null)
const formSaving = ref(false)
const renderDialogVisible = ref(false)
const renderResult = ref('')
const renderMissing = ref<string[]>([])
const versionDialogVisible = ref(false)
const versions = ref<Array<{ version: number; content: string; createdAt: string }>>([])
const activeVersion = ref(0)

const initialForm = (): PromptRequest => ({
  name: '',
  category: 'default',
  description: '',
  content: '',
  variables: [],
  enabled: true,
})

const form = ref<PromptRequest>(initialForm())

async function fetchAll() {
  loading.value = true
  try {
    prompts.value = await promptApi.list()
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

function openCreate() {
  editingId.value = null
  form.value = initialForm()
  drawerVisible.value = true
}

function openEdit(p: Prompt) {
  editingId.value = p.id
  form.value = {
    name: p.name,
    category: p.category,
    description: p.description,
    content: p.content,
    variables: p.variables,
    enabled: p.enabled,
  }
  drawerVisible.value = true
}

function onDrawerClosed() {
  editingId.value = null
  form.value = initialForm()
}

function addVariable() {
  form.value.variables = [...(form.value.variables ?? []), { name: '', description: '', required: false }]
}

function removeVariable(index: number) {
  form.value.variables = (form.value.variables ?? []).filter((_, i) => i !== index)
}

async function handleSubmit() {
  if (!form.value.name || !form.value.content) {
    ElMessage.warning('请填写名称和内容')
    return
  }
  formSaving.value = true
  try {
    if (editingId.value) {
      await promptApi.update(editingId.value, { ...form.value })
      ElMessage.success('提示词已更新')
    } else {
      await promptApi.create({ ...form.value })
      ElMessage.success('提示词已创建')
    }
    drawerVisible.value = false
    fetchAll()
  } finally {
    formSaving.value = false
  }
}

async function handleDelete(p: Prompt) {
  try {
    await ElMessageBox.confirm(`确认删除提示词「${p.name}」？`, '删除确认', { type: 'warning' })
    await promptApi.remove(p.id)
    ElMessage.success('已删除')
    fetchAll()
  } catch {
    // 取消
  }
}

const renderForm = ref<{ variables: Record<string, string> }>({ variables: {} })
const renderTarget = ref<Prompt | null>(null)

async function openRender(p: Prompt) {
  renderTarget.value = p
  activeVersion.value = p.version
  renderForm.value = { variables: {} }
  renderResult.value = ''
  renderMissing.value = []
  try {
    const result = await promptApi.render(p.id, {})
    renderResult.value = result.content
    renderMissing.value = Object.keys(result.missingVariables)
  } catch {
    // 已提示
  }
  renderDialogVisible.value = true
}

async function doRender() {
  if (!renderTarget.value) return
  const result = await promptApi.render(renderTarget.value.id, renderForm.value.variables)
  renderResult.value = result.content
  renderMissing.value = Object.keys(result.missingVariables)
}

async function openVersions(p: Prompt) {
  versions.value = await promptApi.versions(p.id)
  versionDialogVisible.value = true
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">提示词管理</h1>
        <p class="page-desc">提示词模板：花括号变量占位、分类、版本历史与渲染预览</p>
      </div>
      <div>
        <el-button :icon="Refresh" circle :loading="loading" @click="fetchAll" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新增提示词</el-button>
      </div>
    </div>

    <div class="surface">
      <el-table v-loading="loading" :data="prompts" empty-text="暂无提示词">
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column label="分类" width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="描述" min-width="180" show-overflow-tooltip prop="description" />
        <el-table-column label="内容预览" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <code class="mono content-preview">{{ row.content }}</code>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="70" prop="version" />
        <el-table-column label="启用" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" circle :icon="VideoPlay" title="渲染预览" @click="openRender(row)" />
            <el-button size="small" circle :icon="Clock" title="版本历史" @click="openVersions(row)" />
            <el-button size="small" circle :icon="EditPen" title="编辑" @click="openEdit(row)" />
            <el-button size="small" circle type="danger" plain :icon="Delete" title="删除" @click="handleDelete(row)" />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="editingId ? '编辑提示词' : '新增提示词'"
      direction="rtl"
      size="640px"
      destroy-on-close
      @closed="onDrawerClosed"
    >
      <div class="drawer-form">
        <div class="form-grid">
          <div>
            <label class="field-label">名称</label>
            <el-input v-model="form.name" maxlength="120" />
          </div>
          <div>
            <label class="field-label">分类</label>
            <el-input v-model="form.category" placeholder="default" />
          </div>
          <div class="span-2">
            <label class="field-label">描述</label>
            <el-input v-model="form.description" maxlength="200" />
          </div>
        </div>

        <p class="section-title">变量定义（花括号变量名）</p>
        <div v-for="(variable, index) in form.variables" :key="index" class="variable-row">
          <el-input v-model="variable.name" placeholder="变量名" class="var-name" />
          <el-input v-model="variable.description" placeholder="说明" class="var-desc" />
          <el-checkbox v-model="variable.required">必填</el-checkbox>
          <el-button type="danger" plain size="small" :icon="Delete" @click="removeVariable(index)" />
        </div>
        <el-button size="small" @click="addVariable">+ 添加变量</el-button>

        <p class="section-title">内容</p>
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="12"
          placeholder="提示词内容，使用 {{变量名}} 占位"
        />

        <div class="switch-line">
          <span>启用</span>
          <el-switch v-model="form.enabled" />
        </div>
      </div>

      <template #footer>
        <el-button @click="drawerVisible = false">取消</el-button>
        <el-button type="primary" :loading="formSaving" @click="handleSubmit">
          {{ editingId ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-drawer>

    <el-dialog v-model="renderDialogVisible" title="渲染预览" width="640px">
      <template v-if="renderTarget">
        <div class="render-vars">
          <div v-for="variable in renderTarget.variables" :key="variable.name" class="render-var-row">
            <el-input v-model="renderForm.variables[variable.name]" :placeholder="'{{' + variable.name + '}}' + (variable.required ? '（必填）' : '')" />
          </div>
          <span v-if="!renderTarget.variables.length" class="muted">该提示词没有定义变量</span>
        </div>
        <el-button type="primary" plain @click="doRender">重新渲染</el-button>
      </template>
      <el-alert v-if="renderMissing.length" type="warning" :title="`缺少变量：${renderMissing.join(', ')}`" show-icon :closable="false" class="render-alert" />
      <pre class="render-output">{{ renderResult }}</pre>
    </el-dialog>

    <el-dialog v-model="versionDialogVisible" title="版本历史" width="720px">
      <el-table :data="versions" empty-text="暂无历史版本">
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column prop="createdAt" label="归档时间" width="180" />
        <el-table-column label="内容" show-overflow-tooltip>
          <template #default="{ row }">
            <code class="mono">{{ row.content }}</code>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
.content-preview {
  white-space: pre-wrap;
  word-break: break-all;
}

.drawer-form {
  padding: 4px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #6e6e78;
  margin: 20px 0 10px;
}

.section-title:first-child {
  margin-top: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.form-grid .span-2 {
  grid-column: span 2;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #44444e;
}

.variable-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.var-name {
  width: 140px;
}

.var-desc {
  flex: 1;
}

.switch-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}

.render-vars {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.render-alert {
  margin: 12px 0;
}

.render-output {
  background: #f5f5f7;
  border: 1px solid #e4e4e8;
  border-radius: 8px;
  padding: 12px;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  max-height: 320px;
  overflow: auto;
}
</style>
