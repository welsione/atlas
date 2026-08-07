import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const EXTERNAL = new Set(['vue', 'element-plus', '@element-plus/icons-vue', '@atlas/runtime'])
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: { entry: 'src/main.js', formats: ['es'], fileName: () => 'entry.js' },
    outDir: 'dist',
    rollupOptions: { external: (id) => EXTERNAL.has(id) },
  },
})
