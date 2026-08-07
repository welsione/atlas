import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 主应用构建：共享运行时依赖 external（由 import map 指向独立 vendor 文件，单实例）。
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5181,
    proxy: {
      '/api': { target: 'http://127.0.0.1:18081', changeOrigin: true },
      '/_pluginui': { target: 'http://127.0.0.1:18081', changeOrigin: true },
      '/icons': { target: 'http://127.0.0.1:18081', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['vue', 'element-plus', '@element-plus/icons-vue', '@atlas/runtime'],
    },
  },
})
