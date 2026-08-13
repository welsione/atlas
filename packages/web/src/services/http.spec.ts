import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { ElMessage } from 'element-plus'
import { httpClient, get, AUTH_TOKEN_KEY } from './http'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

describe('http 拦截器', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(httpClient)
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    mock.restore()
  })

  it('请求拦截：携带 Authorization Bearer token', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'tok123')
    mock.onGet('/x').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer tok123')
      return [200, { code: 0, message: 'ok', data: 'y' }]
    })
    await expect(get('/x')).resolves.toBe('y')
  })

  it('响应拦截：code !== 0 → ElMessage.error 并 reject', async () => {
    mock.onGet('/fail').reply(200, { code: 1, message: '业务失败', data: null })
    await expect(get('/fail')).rejects.toThrow('业务失败')
    expect(ElMessage.error).toHaveBeenCalledWith('业务失败')
  })

  it('响应拦截：401 → 清除 token + 派发 atlas:unauthorized', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'tok')
    const spy = vi.fn()
    window.addEventListener('atlas:unauthorized', spy)
    mock.onGet('/auth').reply(401, { code: 401, message: 'unauth', data: null })
    await expect(get('/auth')).rejects.toBeTruthy()
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    expect(spy).toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith('请先登录')
    window.removeEventListener('atlas:unauthorized', spy)
  })

  it('响应拦截：网络错误（非 401）→ ElMessage.error', async () => {
    mock.onGet('/net').networkError()
    await expect(get('/net')).rejects.toBeTruthy()
    expect(ElMessage.error).toHaveBeenCalled()
  })
})
