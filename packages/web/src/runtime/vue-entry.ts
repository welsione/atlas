// 共享运行时导出入口：强制保留 vue 全部导出，供插件 UI 通过 import map import('vue') 复用同一实例。
export * from 'vue'
