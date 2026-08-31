import { describe, expect, it, jest } from '@jest/globals'
import type { Request, Response } from 'express'
import { PluginFileDownloadController } from './plugin-file-download.controller.js'
import type { PluginFileRegistry, PluginFileTokenRow } from './plugin-file.registry.js'
import type { ExternalInterfaceRuleRepository } from '../monitor/external-interface-rule.repository.js'
import type { AtlasConfig } from '../config.js'

/**
 * 对外接口治理闭环回归（review H 级）：
 * PUBLIC_FILE 在监控台停用后，/api/files/{token}/meta|download 必须 404 防探测，
 * 不得因「界面显示已停用」而下载端点仍放行。
 */

function makeRes(): Response {
  const res: Record<string, jest.Mock> = {}
  res.status = jest.fn(() => res) as never
  res.json = jest.fn()
  res.send = jest.fn()
  res.setHeader = jest.fn()
  res.end = jest.fn()
  return res as unknown as Response
}

function makeReq(ifNoneMatch?: string): Request {
  return {
    params: { token: 'tok-1' },
    header: (k: string) => (k.toLowerCase() === 'if-none-match' ? ifNoneMatch : undefined),
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request
}

const row = {
  id: 1, token: 'tok-1', scope_key: 7, plugin_type: 'model-files', rel_path: 'a.bin',
  name: 'a.bin', content_hash: 'h1', total_size: 2, file_count: 1,
  created_at: '2026-08-31 00:00:00', updated_at: '2026-08-31 00:00:00',
} as PluginFileTokenRow

function makeController(opts: { exists: boolean; allowed: boolean }): PluginFileDownloadController {
  const registry = {
    findByToken: jest.fn(() => (opts.exists ? row : undefined)),
    filePathOf: jest.fn(() => '/tmp/nonexistent-file-bin'),
    touch: jest.fn(),
  } as unknown as PluginFileRegistry
  const rules = { isAllowed: jest.fn(() => opts.allowed) } as unknown as ExternalInterfaceRuleRepository
  const db = { prepare: jest.fn(() => ({ run: jest.fn() })) } as never
  const config = { trustProxy: false } as AtlasConfig
  return new PluginFileDownloadController(registry, rules, db, config)
}

describe('PUBLIC_FILE 对外接口启停（/api/files）', () => {
  it('启用中：meta 返回文件信息，download 放行', () => {
    const c = makeController({ exists: true, allowed: true })
    const resMeta = makeRes()
    c.meta(makeReq(), resMeta)
    expect(resMeta.json).toHaveBeenCalledWith(expect.objectContaining({ code: 0 }))
    expect(resMeta.status).not.toHaveBeenCalled()
  })

  it('停用（enabled=false 规则行）：meta 404 防探测', () => {
    const c = makeController({ exists: true, allowed: false })
    const res = makeRes()
    c.meta(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ code: 404, message: '文件不存在', data: null })
  })

  it('停用：download 404 防探测，不读取磁盘文件', () => {
    const c = makeController({ exists: true, allowed: false })
    const res = makeRes()
    c.download(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.send).not.toHaveBeenCalled()
  })

  it('token 不存在：download 404（不触发规则查询）', () => {
    const c = makeController({ exists: false, allowed: true })
    const res = makeRes()
    c.download(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
