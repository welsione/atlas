import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import { Test } from '@nestjs/testing'
import type { Database as SqliteDatabase } from 'better-sqlite3'
import BetterSqlite3 from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CONFIG } from '../config.js'
import { DB } from '../db/database.module.js'
import { SchemaInitializer } from '../db/schema-initializer.js'
import { AppRepository } from './app.repository.js'
import { PluginService } from '../plugins/plugin.service.js'
import { AppService } from './app.service.js'

describe('AppService', () => {
  let db: SqliteDatabase
  let service: AppService
  let dir: string

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'aibase-test-'))
    db = new BetterSqlite3(join(dir, 'test.db'))
    const config = {
      dataDir: dir,
      dbPath: join(dir, 'test.db'),
      encKey: 'test-key',
      adminPassword: '',
      adminKey: '',
      authEnabled: false,
      pluginScanIntervalMs: 10000,
      datasetRefreshIntervalMs: 60000,
      pluginsDir: join(dir, 'plugins'),
      port: 0,
    }
    await new SchemaInitializer(config).initialize(db)
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: DB, useValue: db },
        AppRepository,
        AppService,
        { provide: PluginService, useValue: { autoInstantiate: () => undefined } },
      ],
    }).compile()
    service = moduleRef.get(AppService)
  })

  afterAll(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('创建应用返回仅一次可见的 secret', () => {
    const result = service.create('测试应用', 'desc')
    expect(result.app.appId).toMatch(/^app_[0-9a-f]{24}$/)
    expect(result.secret.length).toBe(64)
    expect(service.list()).toHaveLength(1)
  })

  it('凭证校验：正确 secret 通过，错误 secret 拒绝', () => {
    const { app, secret } = service.create('凭证测试')
    expect(service.credentialValid(app.appId, secret)).toBe(true)
    expect(service.credentialValid(app.appId, 'wrong')).toBe(false)
  })

  it('轮换后新 secret 有效，旧 secret 仍可校验（历史保留）', () => {
    const { app, secret: oldSecret } = service.create('轮换测试')
    const rotated = service.rotate(app.id)
    expect(rotated.secret).not.toBe(oldSecret)
    expect(service.credentialValid(app.appId, rotated.secret)).toBe(true)
    expect(service.credentialValid(app.appId, oldSecret)).toBe(true)
  })

  it('吊销后凭证全部失效', () => {
    const { app, secret } = service.create('吊销测试')
    service.revoke(app.id)
    expect(service.credentialValid(app.appId, secret)).toBe(false)
    expect(() => service.requireActive(app.appId)).toThrow(/吊销/)
  })

  it('激活恢复 ACTIVE', () => {
    const { app } = service.create('激活测试')
    service.revoke(app.id)
    const restored = service.activate(app.id)
    expect(restored.status).toBe('ACTIVE')
  })
})
