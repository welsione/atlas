import { describe, expect, it, jest } from '@jest/globals'
import type { Request, Response } from 'express'
import type { Logger } from '@nestjs/common'
import type { PluginEnvironment } from '@atlas/types'
import { dispatchPluginEndpoint } from './plugin-dispatch.utils.js'
import type { LoadedPlugin } from './types.js'
import { PluginDataController } from './plugin-data.controller.js'
import { PluginDispatchController } from './plugin.dispatch.controller.js'
import type { AppTokenService } from '../auth/app-token.service.js'
import type { OpsLogService } from './ops-log.service.js'

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
  return { method, originalUrl, body: {}, is: () => false, header: () => undefined, socket: { remoteAddress: '' } } as unknown as Request
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
    expect(audit).toHaveBeenCalledWith({ status: 200, bytes: JSON.stringify({ a: 1 }).length, endpoint: { method: 'GET', path: 'hello', public: false } })
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
    expect(audit).toHaveBeenCalledWith({ status: 200, bytes: buf.length, endpoint: { method: 'GET', path: 'download', public: false } })
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

describe('PluginDataController 数据面（token 寻址 + 仅开放 public）', () => {
  function makeDataController(opts: {
    loaded: LoadedPlugin | null
    epTokens: { matchToken: jest.Mock }
    rules?: { isAllowed: jest.Mock }
  }) {
    const registry = { byType: () => opts.loaded } as never
    const service = { environmentOrNull: () => env } as never
    const epTokens = opts.epTokens as never
    const token = { validate: () => 1 } as unknown as AppTokenService
    const rules = opts.rules as never
    return new PluginDataController(registry, service, epTokens, token, rules)
  }

  it('appId 非整数返回 400', async () => {
    const controller = makeDataController({ loaded: null, epTokens: { matchToken: jest.fn(() => true) } })
    const res = makeRes()
    await controller.dispatch('abc', 'demo', 'tok', makeReq('GET', '/api/v1/app/abc/plugins/demo/tok/ep/x'), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 400 }))
  })

  it('token appId 与路径不一致返回 403（越权防护）', async () => {
    const controller = makeDataController({ loaded: null, epTokens: { matchToken: jest.fn(() => true) } })
    const res = makeRes()
    await controller.dispatch('2', 'demo', 'tok', makeReq('GET', '/api/v1/app/2/plugins/demo/tok/ep/x'), res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 403 }))
  })

  it('token 无效返回 401', async () => {
    const token = { validate: () => null } as unknown as AppTokenService
    const registry = { byType: () => null } as never
    const controller = new PluginDataController(registry, {} as never, {} as never, token, {} as never)
    const res = makeRes()
    await controller.dispatch('1', 'demo', 'tok', makeReq('GET', '/api/v1/app/1/plugins/demo/tok/ep/x'), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('内部端点（非 public）无匹配 token → 404 防探测', async () => {
    const loaded = makeLoaded([{ method: 'GET', path: 'internal', handle: async () => ({}) }]) // 未标 public
    const matchToken = jest.fn(() => false)
    const controller = makeDataController({ loaded, epTokens: { matchToken }, rules: { isAllowed: jest.fn(() => true) } })
    const res = makeRes()
    await controller.dispatch('1', 'demo', 'tok', makeReq('GET', '/api/v1/app/1/plugins/demo/tok/ep/internal'), res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(matchToken).not.toHaveBeenCalled()
  })

  it('公开端点 token 命中 + 规则放行 → 调用成功并按 PLUGIN_EP 审计', async () => {
    const loaded = makeLoaded([{ method: 'GET', path: 'cfg', public: true, handle: async () => ({ ok: true }) }])
    const matchToken = jest.fn(() => true)
    const isAllowed = jest.fn(() => true)
    const logAccess = jest.fn()
    const controller = makeDataController({
      loaded, epTokens: { matchToken }, rules: { isAllowed, logAccess } as never,
    })
    const res = makeRes()
    await controller.dispatch('1', 'demo', 'tok', makeReq('GET', '/api/v1/app/1/plugins/demo/tok/ep/cfg'), res)
    expect(matchToken).toHaveBeenCalledWith(1, 'demo', 'GET', 'cfg', 'tok')
    expect(res.json).toHaveBeenCalledWith({ code: 0, message: 'ok', data: { ok: true } })
    expect(logAccess).toHaveBeenCalledWith(expect.objectContaining({ pluginType: 'demo', method: 'GET', endpointPath: 'cfg' }))
  })

  it('公开端点被统一启停停用 → 404 防探测', async () => {
    const loaded = makeLoaded([{ method: 'GET', path: 'cfg', public: true, handle: async () => ({ ok: true }) }])
    const controller = makeDataController({
      loaded, epTokens: { matchToken: jest.fn(() => true) },
      rules: { isAllowed: jest.fn(() => false) },
    })
    const res = makeRes()
    await controller.dispatch('1', 'demo', 'tok', makeReq('GET', '/api/v1/app/1/plugins/demo/tok/ep/cfg'), res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('PluginDispatchController 管理面（review M2：对外接口规则拦截 + ops 审计）', () => {
  function makeManagementController(opts: {
    loaded: LoadedPlugin | null
    env: PluginEnvironment | null
    rules: { isAllowed: jest.Mock }
  }) {
    const registry = { byType: () => opts.loaded } as never
    const service = { environmentOrNull: () => opts.env } as never
    const opsWrite = jest.fn()
    const ops = { write: opsWrite } as unknown as OpsLogService
    const rules = opts.rules as never
    const controller = new PluginDispatchController(registry, service, rules, ops)
    return { controller, opsWrite }
  }

  it('appId 非整数返回 400', async () => {
    const { controller } = makeManagementController({
      loaded: null, env: null, rules: { isAllowed: jest.fn(() => true) },
    })
    const res = makeRes()
    await controller.dispatch('abc', 'demo', makeReq('GET', '/api/apps/abc/plugins/demo/ep/x'), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('插件未注册 → 404', async () => {
    const { controller } = makeManagementController({
      loaded: null, env: null, rules: { isAllowed: jest.fn(() => true) },
    })
    const res = makeRes()
    await controller.dispatch('1', 'missing', makeReq('GET', '/api/apps/1/plugins/missing/ep/x'), res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('实例不可用 → 404', async () => {
    const { controller } = makeManagementController({
      loaded: makeLoaded([]), env: null, rules: { isAllowed: jest.fn(() => true) },
    })
    const res = makeRes()
    await controller.dispatch('1', 'demo', makeReq('GET', '/api/apps/1/plugins/demo/ep/x'), res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 404 }))
  })

  it('内部端点（非 public）不受启停规则约束，始终可调用', async () => {
    const loaded = makeLoaded([{ method: 'GET', path: 'internal', handle: async () => ({ ok: true }) }]) // 未标 public
    const isAllowed = jest.fn(() => false)
    const { controller, opsWrite } = makeManagementController({ loaded, env, rules: { isAllowed } })
    const res = makeRes()
    await controller.dispatch('1', 'demo', makeReq('GET', '/api/apps/1/plugins/demo/ep/internal'), res)
    expect(isAllowed).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ code: 0, message: 'ok', data: { ok: true } })
    expect(opsWrite).toHaveBeenCalled()
  })

  it('公开端点被统一启停停用 → 403 明示原因，不写审计（guard 拦截在 onAccess 之前）', async () => {
    const loaded = makeLoaded([{ method: 'GET', path: 'stopped', public: true, handle: async () => ({ ok: true }) }])
    const isAllowed = jest.fn(() => false)
    const { controller, opsWrite } = makeManagementController({ loaded, env, rules: { isAllowed } })
    const res = makeRes()
    await controller.dispatch('1', 'demo', makeReq('GET', '/api/apps/1/plugins/demo/ep/stopped'), res)
    expect(isAllowed).toHaveBeenCalledWith(1, 'PLUGIN_EP', 'GET stopped')
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 403, message: '插件端点已停用: GET stopped' }),
    )
    expect(opsWrite).not.toHaveBeenCalled()
  })

  it('公开端点规则放行 + 调用成功 → ops_logs 审计 INFO（status/bytes/端点）', async () => {
    const loaded = makeLoaded([{ method: 'GET', path: 'hello', public: true, handle: async () => ({ a: 1 }) }])
    const isAllowed = jest.fn(() => true)
    const { controller, opsWrite } = makeManagementController({ loaded, env, rules: { isAllowed } })
    const res = makeRes()
    await controller.dispatch('1', 'demo', makeReq('GET', '/api/apps/1/plugins/demo/ep/hello'), res)
    expect(isAllowed).toHaveBeenCalledWith(1, 'PLUGIN_EP', 'GET hello')
    expect(res.json).toHaveBeenCalledWith({ code: 0, message: 'ok', data: { a: 1 } })
    expect(opsWrite).toHaveBeenCalledWith(
      1, 'demo', 'INFO', '管理面调用插件端点 GET hello',
      { httpStatus: 200, bytes: JSON.stringify({ a: 1 }).length },
    )
  })

  it('handler 异常 → ops_logs 审计 ERROR', async () => {
    const loaded = makeLoaded([{ method: 'GET', path: 'boom', public: true, handle: async () => { throw new Error('x') } }])
    const { controller, opsWrite } = makeManagementController({
      loaded, env, rules: { isAllowed: jest.fn(() => true) },
    })
    const res = makeRes()
    await controller.dispatch('1', 'demo', makeReq('GET', '/api/apps/1/plugins/demo/ep/boom'), res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(opsWrite).toHaveBeenCalledWith(
      1, 'demo', 'ERROR', '管理面调用插件端点 GET boom',
      { httpStatus: 500, bytes: 0 },
    )
  })
})
