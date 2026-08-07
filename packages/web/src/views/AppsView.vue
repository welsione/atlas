<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Key, SwitchButton, CircleCheck, Delete, ArrowRight } from '@element-plus/icons-vue'
import { appApi } from '../services/appApi'
import type { App } from '../types'

const emit = defineEmits<{ (e: 'open-space', app: App): void }>()

const apps = ref<App[]>([])
const loading = ref(false)
const createVisible = ref(false)
const createName = ref('')
const createDesc = ref('')
const creating = ref(false)
const secretDialog = ref(false)
const secretText = ref('')

async function fetchAll() {
  loading.value = true
  try {
    apps.value = await appApi.list()
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

async function handleCreate() {
  if (!createName.value.trim()) {
    ElMessage.warning('请填写应用名称')
    return
  }
  creating.value = true
  try {
    const result = await appApi.create(createName.value.trim(), createDesc.value)
    secretText.value = result.secret
    secretDialog.value = true
    createVisible.value = false
    createName.value = ''
    createDesc.value = ''
    await fetchAll()
  } finally {
    creating.value = false
  }
}

async function handleRotate(app: App) {
  try {
    await ElMessageBox.confirm(`轮换后新凭证生效，旧凭证保留可校验。确认轮换「${app.name}」？`, '轮换凭证', { type: 'warning' })
    const result = await appApi.rotate(app.id)
    secretText.value = result.secret
    secretDialog.value = true
    await fetchAll()
  } catch {
    // 取消
  }
}

async function handleRevoke(app: App) {
  try {
    await ElMessageBox.confirm(`吊销后应用凭证全部失效，令牌即时作废。确认吊销「${app.name}」？`, '吊销应用', { type: 'error' })
    await appApi.revoke(app.id)
    ElMessage.success('已吊销')
    await fetchAll()
  } catch {
    // 取消
  }
}

async function handleActivate(app: App) {
  await appApi.activate(app.id)
  ElMessage.success('已恢复')
  await fetchAll()
}

async function handleRemove(app: App) {
  try {
    await ElMessageBox.confirm(`删除应用将级联清理其全部数据。确认删除「${app.name}」？`, '删除应用', { type: 'error' })
    await appApi.remove(app.id)
    ElMessage.success('已删除')
    await fetchAll()
  } catch {
    // 取消
  }
}

function statusTag(status: string) {
  return status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : 'danger'
}

function statusLabel(status: string) {
  return status === 'ACTIVE' ? '正常' : status === 'PAUSED' ? '暂停' : '已吊销'
}

function copySecret() {
  navigator.clipboard?.writeText(secretText.value)
  ElMessage.success('已复制')
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">应用管理</h1>
        <p class="page-desc">应用为平台一级实体：一切数据、插件实例与数据集挂靠其上；凭证打包进应用，可轮换/吊销</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="createVisible = true">创建应用</el-button>
    </div>

    <div class="surface">
      <el-table v-loading="loading" :data="apps" empty-text="暂无应用，点击右上角创建">
        <el-table-column label="应用" min-width="220">
          <template #default="{ row }">
            <div class="app-cell">
              <span class="app-name">{{ row.name }}</span>
              <code class="mono">{{ row.appId }}</code>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTag(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="凭证" min-width="140">
          <template #default="{ row }">
            <span class="mono secret-hint">{{ row.appSecretHash || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="emit('open-space', row)">进入空间<el-icon class="el-icon--right"><ArrowRight /></el-icon></el-button>
            <el-button v-if="row.status === 'ACTIVE'" size="small" :icon="Key" @click="handleRotate(row)">轮换</el-button>
            <el-button v-if="row.status === 'ACTIVE'" size="small" type="danger" plain :icon="SwitchButton" @click="handleRevoke(row)">吊销</el-button>
            <el-button v-else-if="row.status === 'REVOKED'" size="small" type="success" plain :icon="CircleCheck" @click="handleActivate(row)">恢复</el-button>
            <el-button size="small" type="danger" :icon="Delete" @click="handleRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 创建应用 -->
    <el-dialog v-model="createVisible" title="创建应用" width="480">
      <el-form label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="createName" placeholder="应用名称" maxlength="40" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createDesc" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 凭证展示（仅一次） -->
    <el-dialog v-model="secretDialog" title="应用凭证（仅展示一次，请立即保存）" width="560">
      <el-alert type="warning" :closable="false" title="此凭证仅在创建/轮换时展示一次，关闭后将无法再次查看。" style="margin-bottom: 12px" />
      <el-input :model-value="secretText" readonly>
        <template #append>
          <el-button @click="copySecret">复制</el-button>
        </template>
      </el-input>
      <template #footer>
        <el-button type="primary" @click="secretDialog = false">我已保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.app-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-name {
  font-weight: 600;
}

.secret-hint {
  color: var(--aibase-muted);
}
</style>
