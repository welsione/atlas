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
  mode?: string
  refresh: () => void
}>()

const host = ref<HTMLElement>()
let mountedEntry: PluginUiEntry | null = null
let unmount: (() => void) | undefined
/** 挂载代数：unmount/重挂时递增，使进行中的异步 load 失效（防卸载后仍挂载到已卸载 host）。 */
let mountSeq = 0

async function mountUI() {
  if (!host.value) return
  const seq = ++mountSeq
  const entry = await props.load()
  // load 异步进行期间被卸载/重挂：丢弃本次结果
  if (seq !== mountSeq || !host.value) return
  mountedEntry = entry
  const returned = entry.mount(host.value, {
    appId: props.appId,
    pluginType: props.pluginType ?? '',
    mode: props.mode,
    refresh: props.refresh,
  })
  unmount = typeof returned === 'function' ? returned : undefined
}

function unmountUI() {
  mountSeq += 1
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
