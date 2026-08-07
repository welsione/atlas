import { get, post } from './http'

export const AUTH_TOKEN_KEY = 'aibase-token'

export const authApi = {
  /** 认证是否启用（未配置管理密码时后端不鉴权）。 */
  status: () => get<{ authEnabled: boolean }>('/api/auth/status'),
  /** 登录获取 token。 */
  login: (password: string) => post<{ token: string }>('/api/auth/login', { password }),
}

export const securityApi = {
  settings: () =>
    get<Array<{ key: string; label: string; value: string; hint: string }>>('/api/security/settings'),
  updateSetting: (key: string, value: string) =>
    post<void>('/api/security/settings', { key, value }),
  blockedIps: () =>
    get<Array<{ id: number; ip: string; type: string; reason: string; createdAt: string }>>('/api/security/blocked-ips'),
  block: (ip: string, reason: string) =>
    post<void>(`/api/security/blocked-ips?ip=${encodeURIComponent(ip)}&reason=${encodeURIComponent(reason)}`),
  unblock: (ip: string) =>
    post<void>(`/api/security/blocked-ips/delete?ip=${encodeURIComponent(ip)}`),
}
