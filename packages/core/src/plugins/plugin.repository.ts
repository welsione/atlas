import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import type { DataScope, PluginDef, PluginInstance } from '@atlas/types'

interface PluginDefRow {
  id: number
  plugin_type: string
  name: string
  description: string
  default_data_scope: string
  scope_override_allowed: number
  artifact: string
  artifact_hash: string
  version: string
  icon: string
  loaded: number
  created_at: string
  updated_at: string
}

interface PluginInstanceRow {
  id: number
  app_id: number
  plugin_type: string
  data_scope: string
  config_json: string
  enabled: number
  created_at: string
  updated_at: string
}

export const rowToDef = (r: PluginDefRow): PluginDef => ({
  id: r.id,
  pluginType: r.plugin_type,
  name: r.name,
  description: r.description,
  defaultDataScope: r.default_data_scope as DataScope,
  scopeOverrideAllowed: r.scope_override_allowed === 1,
  artifact: r.artifact,
  artifactHash: r.artifact_hash,
  version: r.version,
  icon: r.icon ?? '',
  loaded: r.loaded === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export const rowToInstance = (r: PluginInstanceRow): PluginInstance => ({
  id: r.id,
  appId: r.app_id,
  pluginType: r.plugin_type,
  dataScope: r.data_scope as DataScope,
  configJson: r.config_json,
  enabled: r.enabled === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

@Injectable()
export class PluginRepository {
  constructor(@Inject(DB) private readonly db: Database.Database) {}

  upsertDef(def: Omit<PluginDef, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }): void {
    this.db
      .prepare(
        `INSERT INTO plugins (plugin_type, name, description, default_data_scope, scope_override_allowed,
           artifact, artifact_hash, version, icon, loaded, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(plugin_type) DO UPDATE SET
           name=excluded.name, description=excluded.description,
           default_data_scope=excluded.default_data_scope, scope_override_allowed=excluded.scope_override_allowed,
           artifact=excluded.artifact, artifact_hash=excluded.artifact_hash, version=excluded.version,
           icon=excluded.icon, loaded=excluded.loaded, updated_at=excluded.updated_at`,
      )
      .run(
        def.pluginType, def.name, def.description, def.defaultDataScope, def.scopeOverrideAllowed ? 1 : 0,
        def.artifact, def.artifactHash, def.version, def.icon ?? '', def.loaded ? 1 : 0,
        def.createdAt, def.updatedAt,
      )
  }

  findAllDefs(): PluginDef[] {
    return (this.db.prepare('SELECT * FROM plugins ORDER BY id').all() as PluginDefRow[]).map(rowToDef)
  }

  /** 分页插件注册表（page 从 1 起）。 */
  findAllDefsPage(page: number, size: number): PluginDef[] {
    return (this.db.prepare('SELECT * FROM plugins ORDER BY id LIMIT ? OFFSET ?').all(size, (page - 1) * size) as PluginDefRow[])
      .map(rowToDef)
  }

  countDefs(): number {
    return (this.db.prepare('SELECT COUNT(*) c FROM plugins').get() as { c: number }).c
  }

  findDefByType(pluginType: string): PluginDef | undefined {
    const row = this.db.prepare('SELECT * FROM plugins WHERE plugin_type = ?').get(pluginType) as PluginDefRow | undefined
    return row ? rowToDef(row) : undefined
  }

  markLoaded(pluginType: string, loaded: boolean): void {
    this.db.prepare('UPDATE plugins SET loaded = ? WHERE plugin_type = ?').run(loaded ? 1 : 0, pluginType)
  }

  findInstance(appId: number, pluginType: string): PluginInstance | undefined {
    const row = this.db
      .prepare('SELECT * FROM plugin_instances WHERE app_id = ? AND plugin_type = ?')
      .get(appId, pluginType) as PluginInstanceRow | undefined
    return row ? rowToInstance(row) : undefined
  }

  insertInstance(row: Omit<PluginInstanceRow, 'id'>): number {
    const info = this.db
      .prepare(
        `INSERT INTO plugin_instances (app_id, plugin_type, data_scope, config_json, enabled, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .run(row.app_id, row.plugin_type, row.data_scope, row.config_json, row.enabled, row.created_at, row.updated_at)
    return Number(info.lastInsertRowid)
  }

  updateInstance(inst: PluginInstanceRow): void {
    this.db
      .prepare(
        'UPDATE plugin_instances SET data_scope = ?, enabled = ?, config_json = ?, updated_at = ? WHERE id = ?',
      )
      .run(inst.data_scope, inst.enabled, inst.config_json, inst.updated_at, inst.id)
  }

  deleteInstance(id: number): void {
    this.db.prepare('DELETE FROM plugin_instances WHERE id = ?').run(id)
  }

  deleteInstancesByApp(appId: number): void {
    this.db.prepare('DELETE FROM plugin_instances WHERE app_id = ?').run(appId)
  }

  /** 一次查询应用的全部插件实例（供概览合并，避免 N+1）。 */
  findAllInstancesByApp(appId: number): PluginInstance[] {
    return (this.db.prepare('SELECT * FROM plugin_instances WHERE app_id = ?').all(appId) as PluginInstanceRow[])
      .map(rowToInstance)
  }

  /** 全部已启用实例（启动后数据集注册补同步用）。 */
  findAllEnabled(): PluginInstance[] {
    return (this.db.prepare("SELECT * FROM plugin_instances WHERE enabled = 1").all() as PluginInstanceRow[])
      .map(rowToInstance)
  }

  /** 某插件类型全部已启用实例（热替换后重建 SPI / re-init 用）。 */
  findAllEnabledInstancesOf(pluginType: string): PluginInstance[] {
    return (this.db.prepare('SELECT * FROM plugin_instances WHERE plugin_type = ? AND enabled = 1').all(pluginType) as PluginInstanceRow[])
      .map(rowToInstance)
  }

  /** 某插件类型全部实例（含停用；卸载/热替换前 dispose env 用）。 */
  findAllInstancesOf(pluginType: string): PluginInstance[] {
    return (this.db.prepare('SELECT * FROM plugin_instances WHERE plugin_type = ?').all(pluginType) as PluginInstanceRow[])
      .map(rowToInstance)
  }

  updateInstanceConfig(id: number, configJson: string): void {
    this.db
      .prepare('UPDATE plugin_instances SET config_json = ?, updated_at = ? WHERE id = ?')
      .run(configJson, new Date().toISOString().slice(0, 19).replace('T', ' '), id)
  }

  // ---------- plugin_store（通用存储） ----------
  // 分区键：instance_id（0=全局共享 / appId=应用独立）+ plugin_type（隔离不同插件，防跨插件碰撞）
  storeGet(instanceId: number, pluginType: string, entityKey: string, entityId: string): unknown {
    const row = this.db
      .prepare('SELECT value_json FROM plugin_store WHERE instance_id = ? AND plugin_type = ? AND entity_id = ? AND entity_key = ?')
      .get(instanceId, pluginType, entityId, entityKey) as { value_json: string } | undefined
    return row ? JSON.parse(row.value_json) : null
  }

  storePut(instanceId: number, pluginType: string, entityKey: string, entityId: string, valueJson: string, now: string): void {
    this.db
      .prepare(
        `INSERT INTO plugin_store (instance_id, plugin_type, entity_id, entity_key, value_json, version, created_at, updated_at)
         VALUES (?,?,?,?,?,1,?,?)
         ON CONFLICT(instance_id, plugin_type, entity_id, entity_key) DO UPDATE SET value_json=excluded.value_json, version=plugin_store.version+1, updated_at=excluded.updated_at`,
      )
      .run(instanceId, pluginType, entityId, entityKey, valueJson, now, now)
  }

  /** 读取记录版本（不存在返回 0）。 */
  storeVersion(instanceId: number, pluginType: string, entityKey: string, entityId: string): number {
    const row = this.db
      .prepare('SELECT version FROM plugin_store WHERE instance_id = ? AND plugin_type = ? AND entity_id = ? AND entity_key = ?')
      .get(instanceId, pluginType, entityId, entityKey) as { version: number } | undefined
    return row?.version ?? 0
  }

  /** 乐观锁写入（CAS）：版本不匹配返回 false 不写入；匹配（含不存在且 expectedVersion=0 的创建）则写入并版本 +1。
   *  better-sqlite3 同步执行，单事件循环内无并发交错，先查后写原子。 */
  storePutIfVersion(instanceId: number, pluginType: string, entityKey: string, entityId: string, valueJson: string, expectedVersion: number, now: string): boolean {
    if (this.storeVersion(instanceId, pluginType, entityKey, entityId) !== expectedVersion) return false
    this.storePut(instanceId, pluginType, entityKey, entityId, valueJson, now)
    return true
  }

  storeRemove(instanceId: number, pluginType: string, entityKey: string, entityId: string): void {
    this.db
      .prepare('DELETE FROM plugin_store WHERE instance_id = ? AND plugin_type = ? AND entity_id = ? AND entity_key = ?')
      .run(instanceId, pluginType, entityId, entityKey)
  }

  storeList(instanceId: number, pluginType: string, entityId: string): Array<{ entity_key: string; value_json: string }> {
    return this.db
      .prepare('SELECT entity_key, value_json FROM plugin_store WHERE instance_id = ? AND plugin_type = ? AND entity_id = ?')
      .all(instanceId, pluginType, entityId) as Array<{ entity_key: string; value_json: string }>
  }

  /** 删除某实例（应用+插件类型）的本地 store，仅清理该插件自身数据，不动兄弟插件。 */
  storeDeleteInstance(scopeKey: number, pluginType: string): void {
    this.db.prepare('DELETE FROM plugin_store WHERE instance_id = ? AND plugin_type = ?').run(scopeKey, pluginType)
  }

  /** 按存储作用域键清理通用存储（instance_id 列语义 = scopeKey：0=共享 / appId=独立）。 */
}
