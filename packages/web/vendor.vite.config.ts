import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 共享运行时 vendor 独立构建（不经过主应用 rollup 管线，保证 export * 全量导出）。
// 按 mode 分四次构建（--mode vue-vendor / ep-vendor / icons-vendor / aibase-runtime）：
//   vue-vendor.js        完整 vue（插件 import 'vue' 用，不 external → 单文件全量）
//   ep-vendor.js         完整 element-plus（插件 import 'element-plus' 用；
//                        external vue → 运行时经 import map 复用 vue-vendor，避免双实例）
//   icons-vendor.js      完整 @element-plus/icons-vue（插件 import '@element-plus/icons-vue' 用）
//   aibase-runtime.js    平台 http 客户端（插件 import '@atlas/runtime' 用）
const MODES = {
  'vue-vendor': { entry: 'src/runtime/vue-entry.ts', external: [] },
  'ep-vendor': { entry: 'src/runtime/ep-entry.ts', external: ['vue'] },
  'icons-vendor': { entry: 'src/runtime/icons-entry.ts', external: ['vue'] },
  'aibase-runtime': { entry: 'src/runtime/runtime-entry.ts', external: [] },
}

export default defineConfig(({ mode }) => {
  const m = MODES[mode]
  if (!m) {
    throw new Error(`vendor 构建需要 --mode ∈ ${Object.keys(MODES).join(' / ')}`)
  }
  return {
    plugins: [vue()],
    define: {
      // vue 完整包里以 process.env.NODE_ENV 判断开发/生产（浏览器无 process）
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      lib: {
        entry: m.entry,
        formats: ['es'],
        fileName: () => `${mode}.js`,
      },
      rollupOptions: {
        external: m.external,
      },
    },
  }
})
