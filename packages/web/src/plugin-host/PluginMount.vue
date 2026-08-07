<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PluginUiEntry } from './slotRegistry'

/**
 * 插件 UI 挂载器：动态 import entry → mount(el, ctx)。
 * key 变化（热替换/切 tab）时卸载旧实例重挂。
 */
const props = defineProps<{
  load: () => Promise<PluginUiEntry>
  appId?: number
  pluginType?: string
  refresh: () => void
}>()

const host = ref<HTMLElement>()
let mountedEntry: PluginUiEntry | null = null
let unmount: (() => void) | undefined

async function mountUI() {
  if (!host.value) return
  const entry = await props.load()
  if (!host.value || mountedEntry !== null) return
  mountedEntry = entry
  const returned = entry.mount(host.value, {
    appId: props.appId,
    pluginType: props.pluginType ?? '',
    refresh: props.refresh,
  })
  unmount = typeof returned === 'function' ? returned : undefined
}

function unmountUI() {
  try {
    unmount?.()
  } catch {
    // 插件卸载钩子异常不影响宿主
  }
  unmount = undefined
  mountedEntry = null
  if (host.value) {
    host.value.innerHTML = ''
  }
}

onMounted(mountUI)
watch(() => props.load, () => {
  unmountUI()
  mountUI()
})
onBeforeUnmount(unmountUI)
</script>

<template>
  <div ref="host" class="plugin-host" />
</template>

<style scoped>
.plugin-host {
  min-height: 120px;
}
</style>
