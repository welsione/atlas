<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CopyDocument, Lock } from '@element-plus/icons-vue'
import { get } from '../services/http'
import { copyText } from '../clipboard'

const status = ref<{ authEnabled: boolean } | null>(null)

onMounted(async () => {
  try {
    status.value = await get<{ authEnabled: boolean }>('/api/auth/status')
  } catch {
    status.value = { authEnabled: false }
  }
})

async function copyVar(name: string) {
  await copyText(name, `${name} `)
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">安全设置</h1>
        <p class="page-desc">管理认证与平台安全配置（环境变量驱动，修改需重启服务生效）</p>
      </div>
    </div>

    <div class="surface">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="管理认证">
          <el-tag size="small" :type="status?.authEnabled ? 'success' : 'warning'">
            {{ status?.authEnabled ? '已启用' : '未启用（本地开发模式）' }}
          </el-tag>
          <span class="auth-hint">启用任一认证变量即开启管理端鉴权</span>
        </el-descriptions-item>
        <el-descriptions-item label="登录密码">
          <el-tooltip content="管理登录密码（Bearer token 签发依据），复制变量名" placement="top">
            <span class="env-chip">
              <code class="mono">ATLAS_ADMIN_PASSWORD</code>
              <el-button size="small" text :icon="CopyDocument" @click="copyVar('ATLAS_ADMIN_PASSWORD')" />
            </span>
          </el-tooltip>
        </el-descriptions-item>
        <el-descriptions-item label="固定管理 Token">
          <el-tooltip content="固定管理令牌，请求头 X-Atlas-Key，复制变量名" placement="top">
            <span class="env-chip">
              <code class="mono">ATLAS_ADMIN_KEY</code>
              <el-button size="small" text :icon="CopyDocument" @click="copyVar('ATLAS_ADMIN_KEY')" />
            </span>
          </el-tooltip>
          <span class="env-note">请求头 <code class="mono">X-Atlas-Key</code></span>
        </el-descriptions-item>
        <el-descriptions-item label="数据集加密密钥">
          <el-tooltip content="SECRET 级数据集信封加密 KEK；生产环境必须显式配置（默认开发密钥会被拒绝启动）" placement="top">
            <span class="env-chip">
              <code class="mono">ATLAS_ENC_KEY</code>
              <el-button size="small" text :icon="CopyDocument" @click="copyVar('ATLAS_ENC_KEY')" />
            </span>
          </el-tooltip>
        </el-descriptions-item>
        <el-descriptions-item label="数据目录">
          <el-tooltip content="默认 ./data；外部插件目录 data/plugins/（或仓库 plugins/），复制变量名" placement="top">
            <span class="env-chip">
              <code class="mono">ATLAS_DATA_DIR</code>
              <el-button size="small" text :icon="CopyDocument" @click="copyVar('ATLAS_DATA_DIR')" />
            </span>
          </el-tooltip>
        </el-descriptions-item>
        <el-descriptions-item label="反向代理">
          <el-tooltip content="部署在可信反向代理后开启，才解析 X-Forwarded-For 获取客户端 IP（默认关闭防伪造绕过）" placement="top">
            <span class="env-chip">
              <code class="mono">ATLAS_TRUST_PROXY</code>
              <el-button size="small" text :icon="CopyDocument" @click="copyVar('ATLAS_TRUST_PROXY')" />
            </span>
          </el-tooltip>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <div class="security-note">
      <el-icon class="note-icon"><Lock /></el-icon>
      <span>提示：生产部署必须配置 <code class="mono">ATLAS_ENC_KEY</code>；启用认证（配置密码或管理 Token）后，使用默认开发加密密钥将导致服务拒绝启动。</span>
    </div>
  </div>
</template>

<style scoped>
.env-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--atlas-bg);
  border: 1px solid var(--atlas-stroke);
  border-radius: 6px;
  padding: 2px 4px 2px 8px;
}

.env-chip .el-button {
  margin: 0;
}

.env-note {
  color: var(--atlas-muted);
  font-size: 12px;
  margin-left: 10px;
}

.auth-hint {
  color: var(--atlas-muted);
  font-size: 12px;
  margin-left: 10px;
}

.security-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  color: #8c6d1f;
  font-size: 13px;
}

.note-icon {
  flex-shrink: 0;
}
</style>
