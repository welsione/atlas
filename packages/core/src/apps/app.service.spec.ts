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
      trustProxy: false,
      devResetDb: false,
      corsOrigin: '*',
      keepLogDays: 30,
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

  it('删除应用级联清理挂靠数据（实例/数据集/存储/凭证）', () => {
    const { app } = service.create('级联删除测试')
    Number(db
      .prepare('INSERT INTO plugin_instances (app_id, plugin_type, data_scope, config_json, enabled, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(app.id, 'test-plugin', 'APP_LOCAL', '{}', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00')
      .lastInsertRowid)
    // plugin_store.instance_id 语义 = scopeKey（APP_LOCAL → appId）
    db.prepare('INSERT INTO plugin_store (instance_id, entity_id, entity_key, value_json, version, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(app.id, '', 'k', '{}', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00')
    const dsId = Number(db
      .prepare('INSERT INTO datasets (app_id, plugin_type, dataset_key, name, sensitivity, token, version, content_hash, content_json, assets_json, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(app.id, 'test-plugin', 'k1', 'ds', 'PUBLIC', 'tok-1234567890123456', 1, 'h', '{}', '[]', 'PUBLISHED', '2026-01-01 00:00:00', '2026-01-01 00:00:00')
      .lastInsertRowid)

    service.remove(app.id)

    expect(service.list().some((a) => a.id === app.id)).toBe(false)
    expect(db.prepare('SELECT COUNT(*) c FROM plugin_instances WHERE app_id = ?').get(app.id)).toEqual({ c: 0 })
    expect(db.prepare('SELECT COUNT(*) c FROM plugin_store').get()).toEqual({ c: 0 })
    expect(db.prepare('SELECT COUNT(*) c FROM datasets WHERE id = ?').get(dsId)).toEqual({ c: 0 })
    expect(db.prepare('SELECT COUNT(*) c FROM app_credentials WHERE app_id = ?').get(app.id)).toEqual({ c: 0 })
  })
})
