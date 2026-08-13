import { describe, expect, it, jest } from '@jest/globals'
import type { Request, Response } from 'express'
import type { Logger } from '@nestjs/common'
import type { PluginEnvironment } from '@atlas/types'
import { dispatchPluginEndpoint } from './plugin-dispatch.utils.js'
import type { LoadedPlugin } from './types.js'
import { PluginDataController } from './plugin-data.controller.js'
import type { AppTokenService } from '../auth/app-token.service.js'

const logger = { error: jest.fn() } as unknown as Logger

function makeRes(): Response {
  const res: Record<string, jest.Mock> = {}
  res.status = jest.fn(() => res) as never
  res.json = jest.fn()
  res.send = jest.fn()
  res.setHeader = jest.fn()
  return res as unknown as Response
}

function makeReq(method: string, originalUrl: string): Request {
  return { method, originalUrl, body: {}, is: () => false, header: () => undefined } as unknown as Request
}

const env = {} as PluginEnvironment

function makeLoaded(endpoints: unknown[]): LoadedPlugin {
  return { plugin: { type: 'demo', endpoints: () => endpoints as never } } as unknown as LoadedPlugin
}

describe('dispatchPluginEndpoint（管理面/数据面公共分发逻辑）', () => {
  it('JSON 结果：ok 包装 + onAccess 记录 200 与字节数', async () => {
    const loaded = makeLoaded([{ method: 'GET', path: 'hello', handle: async () => ({ a: 1 }) }])
    const res = makeRes()
    const audit = jest.fn()
    await dispatchPluginEndpoint({
      loaded, env, pluginType: 'demo', prefix: '/api/apps/1/plugins/demo/ep/',
      req: makeReq('GET', '/api/apps/1/plugins/demo/ep/hello'), res, logger, onAccess: audit,
    })
    expect(res.json).toHaveBeenCalledWith({ code: 0, message: 'ok', data: { a: 1 } })
    expect(audit).toHaveBeenCalledWith({ status: 200, bytes: JSON.stringify({ a: 1 }).length, endpoint: { method: 'GET', path: 'hello' } })
    expect(res.status).not.toHaveBeenCalled()
  })

  it('二进制 Buffer 通道：直接 send + Content-Type/Disposition + onAccess bytes', async () => {
    const buf = Buffer.from('binary-data')
    const loaded = makeLoaded([{
      method: 'GET', path: 'download',
      handle: async () => ({ $binary: buf, $mime: 'application/octet-stream', $filename: 'a.bin' }),
    }])
    const res = makeRes()
    const audit = jest.fn()
    await dispatchPluginEndpoint({
      loaded, env, pluginType: 'demo', prefix: '/api/apps/1/plugins/demo/ep/',
      req: makeReq('GET', '/api/apps/1/plugins/demo/ep/download'), res, logger, onAccess: audit,
    })
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream')
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="a.bin"')
    expect(res.send).toHaveBeenCalledWith(buf)
    expect(audit).toHaveBeenCalledWith({ status: 200, bytes: buf.length, endpoint: { method: 'GET', path: 'download' } })
  })

  it('二进制 base64 字符串通道：兼容解码后 send', async () => {
    const loaded = makeLoaded([{
      method: 'GET', path: 'old',
      handle: async () => ({ $binary: Buffer.from('x').toString('base64'), $mime: 'text/plain' }),
    }])
    const res = makeRes()
    await dispatchPluginEndpoint({
      loaded, env, pluginType: 'demo', prefix: '/api/apps/1/plugins/demo/ep/',
      req: makeReq('GET', '/api/apps/1/plugins/demo/ep/old'), res, logger,
    })
    expect(res.send).toHaveBeenCalledWith(Buffer.from('x'))
  })

  it('guard 拦截：不调用 handle，返回拦截状态码与脱敏文案', async () => {
    const handle = jest.fn()
    const loaded = makeLoaded([{ method: 'GET', path: 'blocked', handle }])
    const res = makeRes()
    const audit = jest.fn()
    await dispatchPluginEndpoint({
      loaded, env, pluginType: 'demo', prefix: '/api/apps/1/plugins/demo/ep/',
      req: makeReq('GET', '/api/apps/1/plugins/demo/ep/blocked'), res, logger,
      guard: () => ({ status: 404, message: '插件端点不存在: GET blocked' }),
      onAccess: audit,
    })
    expect(handle).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ code: 404, message: '插件端点不存在: GET blocked', data: null })
    expect(audit).not.toHaveBeenCalled()
  })

  it('handler 抛错：500 脱敏响应 + 服务端日志 + onAccess 500', async () => {
    const loaded = makeLoaded([{
      method: 'GET', path: 'boom',
      handle: async () => { throw new Error('内部路径 /secret/key') },
    }])
    const res = makeRes()
    const audit = jest.fn()
    await dispatchPluginEndpoint({
      loaded, env, pluginType: 'demo', prefix: '/api/apps/1/plugins/demo/ep/',
      req: makeReq('GET', '/api/apps/1/plugins/demo/ep/boom'), res, logger, onAccess: audit,
    })
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ code: 500, message: '插件端点异常', data: null })
    expect(logger.error).toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }))
  })

  it('端点不存在：404 且不触发 onAccess', async () => {
    const loaded = makeLoaded([{ method: 'GET', path: 'exists', handle: async () => ({}) }])
    const res = makeRes()
    const audit = jest.fn()
    await dispatchPluginEndpoint({
      loaded, env, pluginType: 'demo', prefix: '/api/apps/1/plugins/demo/ep/',
      req: makeReq('GET', '/api/apps/1/plugins/demo/ep/missing'), res, logger, onAccess: audit,
    })
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ code: 404, message: '插件端点不存在: GET missing', data: null })
    expect(audit).not.toHaveBeenCalled()
  })
})

describe('PluginDataController 数据面', () => {
  it('appId 非整数返回 400（L6）', async () => {
    const token = { validate: () => 1 } as unknown as AppTokenService
    const controller = new PluginDataController({} as never, {} as never, token, {} as never)
    const res = makeRes()
    await controller.dispatch('abc', 'demo', makeReq('GET', '/api/v1/app/abc/plugins/demo/ep/x'), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 400 }))
  })

  it('token appId 与路径不一致返回 403（越权防护）', async () => {
    const token = { validate: () => 1 } as unknown as AppTokenService
    const controller = new PluginDataController({} as never, {} as never, token, {} as never)
    const res = makeRes()
    await controller.dispatch('2', 'demo', makeReq('GET', '/api/v1/app/2/plugins/demo/ep/x'), res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 403 }))
  })

  it('token 无效返回 401', async () => {
    const token = { validate: () => null } as unknown as AppTokenService
    const controller = new PluginDataController({} as never, {} as never, token, {} as never)
    const res = makeRes()
    await controller.dispatch('1', 'demo', makeReq('GET', '/api/v1/app/1/plugins/demo/ep/x'), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })
})
