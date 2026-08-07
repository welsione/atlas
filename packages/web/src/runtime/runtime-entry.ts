// 共享运行时导出入口：平台 HTTP 客户端（自动携带管理 token），插件 UI 通过 import('@atlas/runtime') 使用。
export { get, post, put, del, AUTH_TOKEN_KEY } from '../services/http'
