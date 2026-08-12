<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Lock, Loading } from '@element-plus/icons-vue'
import { get, post, AUTH_TOKEN_KEY } from '../services/http'

const emit = defineEmits<{ (e: 'authed'): void }>()

const password = ref('')
const authEnabled = ref(true)
const loading = ref(false)
const checking = ref(true)
const errorMsg = ref('')

onMounted(async () => {
  try {
    // 已持有 token 则直接进入（F5 刷新保持登录态）
    if (localStorage.getItem(AUTH_TOKEN_KEY)) {
      emit('authed')
      return
    }
    const status = await get<{ authEnabled: boolean }>('/api/auth/status')
    authEnabled.value = status?.authEnabled ?? true
    // 未启用管理认证（本地开发）→ 无需登录直接进入
    if (!authEnabled.value) emit('authed')
  } catch {
    authEnabled.value = true
  } finally {
    checking.value = false
  }
})

async function doLogin() {
  if (!password.value) {
    errorMsg.value = '请输入管理密码'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await post<{ token: string }>('/api/auth/login', { password: password.value })
    localStorage.setItem(AUTH_TOKEN_KEY, res.token)
    emit('authed')
  } catch (e) {
    errorMsg.value = (e as Error)?.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-brand">
        <img src="/icons/atlas.svg" class="login-logo" alt="Atlas" />
        <div class="login-title">Atlas 管理台</div>
        <div class="login-sub">登录以管理应用、数据集与插件</div>
      </div>

      <div v-if="checking" class="login-checking">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>

      <template v-else-if="authEnabled">
        <el-input
          v-model="password"
          type="password"
          placeholder="管理密码"
          show-password
          @keyup.enter="doLogin"
        >
          <template #prefix><el-icon><Lock /></el-icon></template>
        </el-input>
        <el-alert v-if="errorMsg" :title="errorMsg" type="error" :closable="false" class="login-error" />
        <el-button type="primary" class="login-btn" :loading="loading" @click="doLogin">登录</el-button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--atlas-bg);
}
.login-card {
  width: 340px;
  padding: 36px 32px;
  background: var(--atlas-surface);
  border: 1px solid var(--atlas-stroke);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.login-brand {
  text-align: center;
  margin-bottom: 8px;
}
.login-logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
}
.login-title {
  font-size: 20px;
  font-weight: 700;
  margin-top: 10px;
}
.login-sub {
  font-size: 13px;
  color: var(--atlas-muted);
  margin-top: 4px;
}
.login-btn {
  width: 100%;
}
.login-checking {
  display: flex;
  justify-content: center;
  padding: 24px;
}
.login-error {
  --el-alert-padding: 6px 12px;
}
</style>