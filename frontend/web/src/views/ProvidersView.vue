<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Connection, EditPen, Delete } from '@element-plus/icons-vue'
import { providerApi } from '../services/providerApi'
import type { Provider, ProviderRequest, ProviderModel } from '../types'

const providers = ref<Provider[]>([])
const types = ref<string[]>([])
const loading = ref(false)
const drawerVisible = ref(false)
const editingId = ref<number | null>(null)
const formSaving = ref(false)
const formTesting = ref(false)
const testResult = ref<string>('')
const testResultOk = ref(false)

const initialForm = (): ProviderRequest => ({
  name: '',
  providerType: 'ANTHROPIC_COMPATIBLE',
  apiKey: '',
  baseUrl: '',
  icon: '',
  iconColor: '',
  models: [],
  defaultModel: '',
  maxTokens: undefined,
  timeoutSeconds: 240,
  extraConfig: '{}',
  enabled: true,
  isDefault: false,
})

const form = ref<ProviderRequest>(initialForm())

async function fetchAll() {
  loading.value = true
  try {
    providers.value = await providerApi.list()
    types.value = await providerApi.types()
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

function mask(key: string): string {
  if (!key || key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

function iconUrl(icon: string): string {
  return icon ? `/icons/${icon.split('/').pop()}` : ''
}

function openCreate() {
  editingId.value = null
  form.value = initialForm()
  testResult.value = ''
  drawerVisible.value = true
}

function openEdit(p: Provider) {
  editingId.value = p.id
  form.value = {
    name: p.name,
    providerType: p.providerType,
    apiKey: '',
    baseUrl: p.baseUrl,
    icon: p.icon,
    iconColor: p.iconColor,
    models: p.models,
    defaultModel: p.defaultModel,
    maxTokens: p.maxTokens ?? undefined,
    timeoutSeconds: p.timeoutSeconds,
    extraConfig: p.extraConfig,
    enabled: p.enabled,
    isDefault: p.isDefault,
  }
  testResult.value = ''
  drawerVisible.value = true
}

function onDrawerClosed() {
  editingId.value = null
  form.value = initialForm()
  testResult.value = ''
}

function addModel() {
  form.value.models = [...(form.value.models ?? []), { modelId: '', contextTokens: null }]
}

function removeModel(index: number) {
  form.value.models = (form.value.models ?? []).filter((_, i) => i !== index)
}

function applyDefaultModel() {
  const first = form.value.models?.[0]
  if (first?.modelId) {
    form.value.defaultModel = first.modelId
    if (!form.value.maxTokens) form.value.maxTokens = first.contextTokens ?? undefined
  }
}

async function handleTest() {
  if (!form.value.baseUrl || !form.value.apiKey) {
    ElMessage.warning('请先填写 Base URL 和 API Key')
    return
  }
  formTesting.value = true
  testResult.value = ''
  try {
    const result = await providerApi.testConfig({ ...form.value })
    testResultOk.value = result.success
    testResult.value = result.success
      ? `连接成功（${result.latencyMs}ms）`
      : result.message
    if (result.success) ElMessage.success('连接成功')
    else ElMessage.error(result.message)
  } catch {
    testResultOk.value = false
    testResult.value = '连接测试请求失败'
  } finally {
    formTesting.value = false
  }
}

async function handleSubmit() {
  if (!form.value.name || !form.value.baseUrl) {
    ElMessage.warning('请填写名称和 Base URL')
    return
  }
  formSaving.value = true
  try {
    const payload = { ...form.value }
    if (editingId.value && !payload.apiKey) delete payload.apiKey
    if (editingId.value) {
      await providerApi.update(editingId.value, payload)
      ElMessage.success('供应商已更新')
    } else {
      if (!payload.apiKey) {
        ElMessage.warning('新增供应商时 API Key 不能为空')
        return
      }
      await providerApi.create(payload)
      ElMessage.success('供应商已创建')
    }
    drawerVisible.value = false
    fetchAll()
  } finally {
    formSaving.value = false
  }
}

async function handleDelete(p: Provider) {
  try {
    await ElMessageBox.confirm(`确认删除供应商「${p.name}」？`, '删除确认', { type: 'warning' })
    await providerApi.remove(p.id)
    ElMessage.success('已删除')
    fetchAll()
  } catch {
    // 取消
  }
}

async function handleTestStored(p: Provider) {
  const result = await providerApi.test(p.id)
  if (result.success) ElMessage.success(`连接成功（${result.latencyMs}ms）`)
  else ElMessage.error(result.message)
}

async function handleSetDefault(p: Provider) {
  if (p.isDefault) return
  await providerApi.setDefault(p.id)
  fetchAll()
}

async function handleToggleEnabled(p: Provider, enabled: boolean) {
  try {
    await providerApi.updateEnabled(p.id, enabled)
    fetchAll()
  } catch {
    fetchAll()
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">供应商配置</h1>
        <p class="page-desc">AI 服务商连接配置管理：API Key 加密存储、模型窗口、连接测试</p>
      </div>
      <div>
        <el-button :icon="Refresh" circle :loading="loading" @click="fetchAll" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新增供应商</el-button>
      </div>
    </div>

    <div class="surface">
      <el-table v-loading="loading" :data="providers" empty-text="暂无供应商">
        <el-table-column label="名称" min-width="160">
          <template #default="{ row }">
            <span class="provider-name-cell">
              <img v-if="iconUrl(row.icon)" :src="iconUrl(row.icon)" class="provider-icon" :alt="row.name" />
              <span>{{ row.name }}</span>
              <el-tag v-if="row.isDefault" size="small" type="success">默认</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="150">
          <template #default="{ row }">
            <el-tag size="small" :type="row.providerType.includes('ANTHROPIC') ? 'warning' : 'info'">
              {{ row.providerType.includes('ANTHROPIC') ? 'Anthropic 兼容' : 'OpenAI 兼容' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="模型" min-width="180">
          <template #default="{ row }">
            <div v-for="m in row.models.slice(0, 2)" :key="m.modelId" class="model-line">
              <code class="mono">{{ m.modelId }}</code>
              <span v-if="m.contextTokens" class="muted"> {{ m.contextTokens.toLocaleString() }} tokens</span>
            </div>
            <span v-if="row.models.length > 2" class="muted">+{{ row.models.length - 2 }} 个</span>
          </template>
        </el-table-column>
        <el-table-column label="API Key" width="160">
          <template #default="{ row }">
            <code class="mono">{{ mask(row.apiKey) }}</code>
          </template>
        </el-table-column>
        <el-table-column label="默认" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.isDefault" @change="handleSetDefault(row)" />
          </template>
        </el-table-column>
        <el-table-column label="启用" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="handleToggleEnabled(row, $event)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" circle :icon="Connection" title="测试连接" @click="handleTestStored(row)" />
            <el-button size="small" circle :icon="EditPen" title="编辑" @click="openEdit(row)" />
            <el-button size="small" circle type="danger" plain :icon="Delete" title="删除" @click="handleDelete(row)" />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="editingId ? '编辑供应商' : '新增供应商'"
      direction="rtl"
      size="560px"
      destroy-on-close
      @closed="onDrawerClosed"
    >
      <div class="drawer-form">
        <p class="section-title">基础信息</p>
        <div class="form-grid">
          <div>
            <label class="field-label">名称</label>
            <el-input v-model="form.name" placeholder="例如 DeepSeek" maxlength="120" />
          </div>
          <div>
            <label class="field-label">协议类型</label>
            <el-select v-model="form.providerType" style="width: 100%">
              <el-option v-for="t in types" :key="t" :value="t" :label="t.includes('ANTHROPIC') ? 'Anthropic 兼容' : 'OpenAI 兼容'" />
            </el-select>
          </div>
          <div>
            <label class="field-label">Base URL</label>
            <el-input v-model="form.baseUrl" placeholder="https://api.deepseek.com/anthropic" />
          </div>
          <div>
            <label class="field-label">图标（static/icons 下的文件名）</label>
            <el-input v-model="form.icon" placeholder="icons/deepseek.svg" />
          </div>
          <div>
            <label class="field-label">图标颜色</label>
            <el-input v-model="form.iconColor" placeholder="#1E88E5" />
          </div>
          <div>
            <label class="field-label">timeoutSeconds</label>
            <el-input-number v-model="form.timeoutSeconds" :min="1" :max="3600" style="width: 100%" />
          </div>
        </div>

        <p class="section-title">模型列表（modelId + 上下文窗口）</p>
        <div v-for="(model, index) in form.models" :key="index" class="model-row">
          <el-input v-model="model.modelId" placeholder="deepseek-v4-pro" class="model-id-input" />
          <el-input-number v-model="model.contextTokens" :min="1" :max="10000000" :step="1024" class="model-token-input" placeholder="窗口" />
          <el-button type="danger" plain size="small" :icon="Delete" @click="removeModel(index)" />
        </div>
        <div class="model-actions">
          <el-button size="small" @click="addModel">+ 添加模型</el-button>
          <el-button size="small" type="primary" plain @click="applyDefaultModel">以首个模型为默认</el-button>
        </div>

        <p class="section-title">连接参数</p>
        <div class="form-grid">
          <div>
            <label class="field-label">默认模型 ID</label>
            <el-input v-model="form.defaultModel" placeholder="deepseek-v4-pro" />
          </div>
          <div>
            <label class="field-label">maxTokens</label>
            <el-input-number v-model="form.maxTokens" :min="1" :max="10000000" :step="1024" style="width: 100%" />
          </div>
          <div class="span-2">
            <label class="field-label">API Key</label>
            <el-input v-model="form.apiKey" type="password" show-password :placeholder="editingId ? '留空保留原值' : '输入 API Key'" />
          </div>
        </div>

        <div class="test-actions">
          <el-button type="success" plain :loading="formTesting" :icon="Connection" @click="handleTest">
            测试连接
          </el-button>
          <span v-if="testResult" class="test-result" :class="testResultOk ? 'ok' : 'fail'">{{ testResult }}</span>
        </div>

        <p class="section-title">启用状态</p>
        <div class="switch-line">
          <span>启用</span>
          <el-switch v-model="form.enabled" />
          <span class="gap">设为默认</span>
          <el-switch v-model="form.isDefault" />
        </div>
      </div>

      <template #footer>
        <el-button @click="drawerVisible = false">取消</el-button>
        <el-button type="primary" :loading="formSaving" @click="handleSubmit">
          {{ editingId ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.provider-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.model-line {
  display: flex;
  gap: 6px;
  align-items: baseline;
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

.model-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.model-id-input {
  flex: 1;
}

.model-token-input {
  width: 180px;
}

.model-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.test-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.test-result {
  font-size: 13px;
}

.test-result.ok {
  color: #059669;
}

.test-result.fail {
  color: #dc2626;
}

.switch-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-line .gap {
  margin-left: 16px;
}
</style>
