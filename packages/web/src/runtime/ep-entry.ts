// 共享运行时导出入口：强制保留 element-plus 全量导出（组件/消息/插件对象 default），
// 供插件 UI 复用。图标库独立（icons-vendor.js），避免 Filter/Message/Sort 命名冲突。
export * from 'element-plus'
export { default } from 'element-plus'
