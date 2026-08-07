import axios, { AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse } from '../types'

export const AUTH_TOKEN_KEY = 'aibase-token'

const http = axios.create({
  baseURL: '',
  timeout: 30000,
})

// 请求拦截：管理认证 token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：401 → 通知全局展示登录
http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>
    if (body && typeof body.code === 'number' && body.code !== 0) {
      ElMessage.error(body.message || '请求失败')
      return Promise.reject(new Error(body.message))
    }
    return response
  },
  (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      window.dispatchEvent(new CustomEvent('aibase:unauthorized'))
      ElMessage.warning('请先登录')
      return Promise.reject(error)
    }
    const message = error.response?.data?.message || error.message || '网络错误'
    ElMessage.error(message)
    return Promise.reject(error)
  },
)

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await http.get<ApiResponse<T>>(url, { params })
  return res.data.data
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.post<ApiResponse<T>>(url, body)
  return res.data.data
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.put<ApiResponse<T>>(url, body)
  return res.data.data
}

export async function del<T>(url: string): Promise<T> {
  const res = await http.delete<ApiResponse<T>>(url)
  return res.data.data
}
