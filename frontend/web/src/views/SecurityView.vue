<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Refresh } from '@element-plus/icons-vue'
import { securityApi } from '../services/securityApi'

type SettingItem = { key: string; label: string; value: string; hint: string }
type BlockedIp = { id: number; ip: string; type: string; reason: string; createdAt: string }

const settings = ref<SettingItem[]>([])
const blockedIps = ref<BlockedIp[]>([])
const loading = ref(false)
const saving = ref(false)
const newIp = ref('')
const newReason = ref('')
const blockedIpsLoading = ref(false)

async function fetchAll() {
  loading.value = true
  try {
    settings.value = await securityApi.settings()
    await fetchBlockedIps()
  } finally {
    loading.value = false
  }
}

async function fetchBlockedIps() {
  blockedIpsLoading.value = true
  try {
    blockedIps.value = await securityApi.blockedIps()
  } finally {
    blockedIpsLoading.value = false
  }
}

onMounted(fetchAll)

async function handleSave(item: SettingItem, value: string) {
  if (!value) {
    ElMessage.warning('请输入数值')
    return
  }
  saving.value = true
  try {
    await securityApi.updateSetting(item.key, value)
    item.value = value
    ElMessage.success(`已更新${item.label}`)
  } finally {
    saving.value = false
  }
}

async function handleBlock() {
  if (!newIp.value.trim()) {
    ElMessage.warning('请输入要封禁的 IP')
    return
  }
  try {
    await securityApi.block(newIp.value.trim(), newReason.value.trim())
    ElMessage.success(`已封禁 ${newIp.value.trim()}`)
    newIp.value = ''
    newReason.value = ''
    fetchBlockedIps()
  } catch {
    // 已提示
  }
}

async function handleUnblock(row: BlockedIp) {
  try {
    await ElMessageBox.confirm(`确认解封 ${row.ip}？`, '解封确认', { type: 'warning' })
    await securityApi.unblock(row.ip)
    ElMessage.success('已解封')
    fetchBlockedIps()
  } catch {
    // 取消
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">安全</h1>
        <p class="page-desc">IP 黑名单（手动/自动封禁）与限流策略配置，防止恶意访问</p>
      </div>
      <el-button :icon="Refresh" circle :loading="loading" @click="fetchAll" />
    </div>

    <div class="surface section">
      <p class="section-title">限流设置（持久化，立即生效）</p>
      <div class="settings-grid">
        <div v-for="item in settings" :key="item.key" class="setting-item">
          <div class="setting-label">
            {{ item.label }}
            <span class="setting-hint">{{ item.hint }}</span>
          </div>
          <el-input
            :model-value="item.value"
            :disabled="item.key === 'rateLimitEnabled' && item.value !== 'true' && item.value !== 'false'"
            placeholder="值"
            class="setting-input"
            @change="(value: string | number) => handleSave(item, String(value))"
          />
        </div>
      </div>
    </div>

    <div class="surface section">
      <p class="section-title">IP 黑名单（被禁 IP 拒绝全部 API 访问，且流量不计入 Top 排名）</p>
      <div class="block-form">
        <el-input v-model="newIp" placeholder="IP 地址，如 203.0.113.9" class="ip-input" />
        <el-input v-model="newReason" placeholder="原因（可选）" class="reason-input" />
        <el-button type="danger" plain :icon="Plus" @click="handleBlock">封禁</el-button>
      </div>
      <el-table v-loading="blockedIpsLoading" :data="blockedIps" empty-text="暂无封禁 IP" size="small">
        <el-table-column prop="ip" label="IP" width="180" />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'AUTO_BLOCK' ? 'danger' : 'warning'">
              {{ row.type === 'AUTO_BLOCK' ? '自动封禁' : '手动封禁' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="时间" width="180" />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" circle type="success" plain :icon="Delete" title="解封" @click="handleUnblock(row)" />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="surface section">
      <p class="section-title">部署安全建议</p>
      <ul class="advice-list">
        <li>生产环境必须设置 <code>AIBASE_ADMIN_PASSWORD</code>（管理登录）与 <code>AIBASE_ADMIN_KEY</code>（脚本管理 Token）</li>
        <li>对外提供服务请配置 HTTPS 反向代理（nginx TLS），避免明文传输</li>
        <li>云安全组仅放行必要端口（18081）给可信来源</li>
        <li>自动封禁的 IP 可在此页面手动解封</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #6e6e78;
  margin: 0 0 12px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setting-label {
  flex: 1;
  font-size: 13px;
}

.setting-hint {
  display: block;
  font-size: 11px;
  color: #9ca3af;
}

.setting-input {
  width: 120px;
}

.block-form {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.ip-input {
  width: 220px;
}

.reason-input {
  flex: 1;
}

.advice-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.9;
  color: #44444e;
}

.advice-list code {
  background: #f3f4f6;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
