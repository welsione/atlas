import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import BetterSqlite3 from 'better-sqlite3'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PluginEpTokenRepository } from '../plugins/plugin-ep-token.repository.js'
import { ExternalInterfaceRuleRepository } from './external-interface-rule.repository.js'

describe('对外接口治理：插件公开端点 token 与统一启停规则', () => {
  let dir: string
  let db: BetterSqlite3.Database
  let epTokens: PluginEpTokenRepository
  let rules: ExternalInterfaceRuleRepository

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'atlas-ep-token-'))
    db = new BetterSqlite3(join(dir, 'test.db'))
    // 仅执行两个对外接口治理表的建表 DDL（独立于完整 schema）
    const schema = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8')
    for (const statement of schema.split(';').map((s) => s.trim()).filter(Boolean)) {
      if (statement.includes('plugin_ep_tokens') || statement.includes('external_interface_rules')) {
        db.exec(statement)
      }
    }
    epTokens = new PluginEpTokenRepository(db as never)
    rules = new ExternalInterfaceRuleRepository(db as never)
  })

  afterAll(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('sync：为公开端点生成防穷举 token（32 字节 hex），非公开不生成', () => {
    epTokens.sync(1, 'demo', [{ method: 'GET', endpointPath: 'config', sensitivity: 'PUBLIC' }])
    const rows = epTokens.listByApp(1)
    expect(rows).toHaveLength(1)
    expect(rows[0].pluginType).toBe('demo')
    expect(rows[0].method).toBe('GET')
    expect(rows[0].endpointPath).toBe('config')
    expect(rows[0].token).toMatch(/^[0-9a-f]{64}$/)
    expect(rows[0].sensitivity).toBe('PUBLIC')
    expect(rows[0].enabled).toBe(true)
  })

  it('sync 幂等：重复声明复用既有 token，不新建', () => {
    const before = epTokens.listByApp(1)[0].token
    epTokens.sync(1, 'demo', [{ method: 'GET', endpointPath: 'config', sensitivity: 'PUBLIC' }])
    const after = epTokens.listByApp(1)
    expect(after).toHaveLength(1)
    expect(after[0].token).toBe(before)
  })

  it('sync 同步更新 sensitivity；非公开旧 token 注销', () => {
    epTokens.sync(1, 'demo', [{ method: 'GET', endpointPath: 'config', sensitivity: 'INTERNAL' }])
    expect(epTokens.listByApp(1)[0].sensitivity).toBe('INTERNAL')
    // 改为只声明另一个端点 → 原 config token 注销
    epTokens.sync(1, 'demo', [{ method: 'GET', endpointPath: 'meta', sensitivity: 'PUBLIC' }])
    expect(epTokens.listByApp(1)).toHaveLength(1)
    expect(epTokens.listByApp(1)[0].endpointPath).toBe('meta')
  })

  it('matchToken 校验属主+路径；findByToken 反查', () => {
    epTokens.sync(1, 'demo', [{ method: 'GET', endpointPath: 'meta', sensitivity: 'PUBLIC' }])
    const row = epTokens.listByApp(1)[0]
    expect(epTokens.matchToken(1, 'demo', 'GET', 'meta', row.token)).toBe(true)
    expect(epTokens.matchToken(2, 'demo', 'GET', 'meta', row.token)).toBe(false) // 属主不符
    expect(epTokens.findByToken(row.token)?.endpointPath).toBe('meta')
    expect(epTokens.findByToken('nope')).toBeUndefined()
  })

  it('removeByPlugin：停用/卸载即注销该插件全部公开端点 token', () => {
    epTokens.removeByPlugin(1, 'demo')
    expect(epTokens.listByApp(1)).toHaveLength(0)
    expect(epTokens.findByToken('')).toBeUndefined()
  })

  it('统一启停：无规则默认放行，setEnabled(false) 后拦截，remove 恢复', () => {
    expect(rules.isAllowed(1, 'PLUGIN_EP', 'GET config')).toBe(true)
    rules.setEnabled(1, 'PLUGIN_EP', 'GET config', false)
    expect(rules.isAllowed(1, 'PLUGIN_EP', 'GET config')).toBe(false)
    expect(rules.isAllowed(1, 'DATASET', '5')).toBe(true) // 不同类型不受影响
    rules.remove(1, 'PLUGIN_EP', 'GET config')
    expect(rules.isAllowed(1, 'PLUGIN_EP', 'GET config')).toBe(true)
    expect(rules.list(1)).toHaveLength(0)
  })
})
