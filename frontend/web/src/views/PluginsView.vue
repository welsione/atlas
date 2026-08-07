<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { pluginApi } from '../services/promptApi'
import type { PluginOverview } from '../types'

const overview = ref<PluginOverview>({ providerAdapters: [], promptProcessors: [], externalJars: [] })
const loading = ref(false)

async function fetchAll() {
  loading.value = true
  try {
    overview.value = await pluginApi.overview()
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">插件</h1>
        <p class="page-desc">协议适配器与提示词处理器 SPI 扩展；外部插件 jar 放入数据目录 plugins/ 后重启生效</p>
      </div>
      <el-button :icon="Refresh" circle :loading="loading" @click="fetchAll" />
    </div>

    <div class="surface">
      <p class="section-title">协议适配器（ProviderAdapter）</p>
      <el-table :data="overview.providerAdapters.map((t) => ({ type: t }))" empty-text="无">
        <el-table-column prop="type" label="协议类型">
          <template #default="{ row }">
            <el-tag>{{ row.type }}</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <p class="section-title">提示词处理器（PromptProcessor）</p>
      <el-table :data="overview.promptProcessors.map((n) => ({ name: n }))" empty-text="无">
        <el-table-column prop="name" label="处理器名称" />
      </el-table>

      <p class="section-title">外部插件 jar（data/plugins/）</p>
      <el-table :data="overview.externalJars.map((j) => ({ jar: j }))" empty-text="暂无外部插件">
        <el-table-column prop="jar" label="文件" />
      </el-table>

      <el-alert
        type="info"
        title="插件开发"
        description="实现 cn.aibase.plugin.ProviderAdapter / PromptProcessor 接口，在 META-INF/services 声明实现类，打包 jar 放入数据目录 plugins/，重启服务自动加载。"
        :closable="false"
        show-icon
        class="plugin-tip"
      />
    </div>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #6e6e78;
  margin: 20px 0 10px;
}

.section-title:first-child {
  margin-top: 0;
}

.plugin-tip {
  margin-top: 20px;
}
</style>
