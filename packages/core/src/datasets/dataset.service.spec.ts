import { describe, expect, it, jest } from '@jest/globals'
import type BetterSqlite3 from 'better-sqlite3'
import { DatasetService } from './dataset.service.js'
import type { ExternalInterfaceRuleRepository } from '../monitor/external-interface-rule.repository.js'
import type { PlatformEventEmitter } from '../spi/platform-event-emitter.js'
import type { PluginService } from '../plugins/plugin.service.js'

/** DatasetService 消费侧单测：聚焦对外接口统一启停对数据面的拦截。 */
describe('DatasetService 消费侧对外接口启停', () => {
  function makeService(opts: { isAllowed: jest.Mock; dataContent?: string }) {
    const db = { prepare: () => ({ get: () => ({}), all: () => [] }) } as unknown as BetterSqlite3.Database
    const repository = {
      findByToken: () => ({
        id: 2, appId: 1, token: "0123456789abcdef1234567890abcdef", name: '供应商配置', sensitivity: 'INTERNAL',
        version: 1, contentHash: 'abc', contentJson: opts.dataContent ?? '{}',
        assets: [], dekWrapped: '', status: 'PUBLISHED',
      }),
      insertAccessLog: () => undefined,
      insertDownloadLog: () => undefined,
      findById: () => undefined,
      findActiveSecrets: () => [],
      hasGrant: () => false,
    }
    const externRules = { isAllowed: opts.isAllowed } as unknown as ExternalInterfaceRuleRepository
    const service = new DatasetService(
      {} as never, repository as never, {} as never, {} as PluginService, {} as PlatformEventEmitter, externRules,
    )
    return service
  }

  it('未停用数据面向外接口：data 正常返回', () => {
    const service = makeService({ isAllowed: jest.fn(() => true) })
    const res = service.data('0123456789abcdef1234567890abcdef', undefined, 1, '127.0.0.1', 'ua')
    expect(res.contentJson).toBe('{}')
  })

  it('被停用（external_interface_rules 拦截）：data 抛 NotFoundError（对外 404）', () => {
    const service = makeService({ isAllowed: jest.fn(() => false) })
    expect(() => service.data('0123456789abcdef1234567890abcdef', undefined, 1, '127.0.0.1', 'ua')).toThrow(/数据集不存在/)
  })

  it('被停用：meta / secrets 同样拦截', () => {
    const service = makeService({ isAllowed: jest.fn(() => false) })
    expect(() => service.meta('0123456789abcdef1234567890abcdef')).toThrow(/数据集不存在/)
    expect(() => service.secrets('0123456789abcdef1234567890abcdef', 1, '127.0.0.1', 'ua')).toThrow(/数据集不存在/)
  })
})
