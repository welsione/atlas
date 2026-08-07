<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Lock } from '@element-plus/icons-vue'
import { authApi, AUTH_TOKEN_KEY } from '../services/securityApi'
import { ElMessage } from 'element-plus'

const visible = ref(false)
const password = ref('')
const loading = ref(false)
const authEnabled = ref(false)
let initialized = false

/** 检查认证状态：启用且未登录则展示登录界面。 */
async function checkAuth() {
  if (initialized) return
  try {
    const status = await authApi.status()
    authEnabled.value = status.authEnabled
    if (status.authEnabled && !localStorage.getItem(AUTH_TOKEN_KEY)) {
      visible.value = true
    }
  } catch {
    // 后端不可达，暂不拦截
  } finally {
    initialized = true
  }
}

function onUnauthorized() {
  if (authEnabled.value) {
    visible.value = true
  }
}

async function handleLogin() {
  if (!password.value) {
    ElMessage.warning('请输入管理密码')
    return
  }
  loading.value = true
  try {
    const result = await authApi.login(password.value)
    localStorage.setItem(AUTH_TOKEN_KEY, result.token)
    password.value = ''
    visible.value = false
    ElMessage.success('登录成功')
    window.dispatchEvent(new CustomEvent('aibase:authenticated'))
  } catch {
    // 密码错误等已由拦截器提示
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  checkAuth()
  window.addEventListener('aibase:unauthorized', onUnauthorized)
})

onUnmounted(() => {
  window.removeEventListener('aibase:unauthorized', onUnauthorized)
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="管理登录"
    width="360px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <el-input
      v-model="password"
      type="password"
      show-password
      placeholder="输入管理密码（AIBASE_ADMIN_PASSWORD）"
      @keyup.enter="handleLogin"
    >
      <template #prefix><el-icon><Lock /></el-icon></template>
    </el-input>
    <template #footer>
      <el-button type="primary" :loading="loading" style="width: 100%" @click="handleLogin">
        登录
      </el-button>
    </template>
  </el-dialog>
</template>
