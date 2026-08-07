<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { get } from '../services/http'

const status = ref<{ authEnabled: boolean } | null>(null)

onMounted(async () => {
  try {
    status.value = await get<{ authEnabled: boolean }>('/api/auth/status')
  } catch {
    status.value = { authEnabled: false }
  }
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">安全设置</h1>
        <p class="page-desc">管理认证与平台安全配置（环境变量驱动）</p>
      </div>
    </div>

    <div class="surface">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="管理认证">
          <el-tag size="small" :type="status?.authEnabled ? 'success' : 'warning'">
            {{ status?.authEnabled ? '已启用' : '未启用（本地开发模式）' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="登录密码">
          <code class="mono">AIBASE_ADMIN_PASSWORD</code>
        </el-descriptions-item>
        <el-descriptions-item label="固定管理 Token">
          <code class="mono">AIBASE_ADMIN_KEY</code>（请求头 <code class="mono">X-AIBase-Key</code>）
        </el-descriptions-item>
        <el-descriptions-item label="数据集加密密钥">
          <code class="mono">AIBASE_ENC_KEY</code>（SECRET 级数据集信封加密 KEK）
        </el-descriptions-item>
        <el-descriptions-item label="数据目录">
          <code class="mono">AIBASE_DATA_DIR</code>（默认 ./data；外部插件目录 data/plugins/）
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>
