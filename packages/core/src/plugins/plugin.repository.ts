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
  loaded: number
  builtin: number
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
  loaded: r.loaded === 1,
  builtin: r.builtin === 1,
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
           artifact, artifact_hash, version, loaded, builtin, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(plugin_type) DO UPDATE SET
           name=excluded.name, description=excluded.description,
           default_data_scope=excluded.default_data_scope, scope_override_allowed=excluded.scope_override_allowed,
           artifact=excluded.artifact, artifact_hash=excluded.artifact_hash, version=excluded.version,
           loaded=excluded.loaded, updated_at=excluded.updated_at`,
      )
      .run(
        def.pluginType, def.name, def.description, def.defaultDataScope, def.scopeOverrideAllowed ? 1 : 0,
        def.artifact, def.artifactHash, def.version, def.loaded ? 1 : 0, def.builtin ? 1 : 0,
        def.createdAt, def.updatedAt,
      )
  }

  findAllDefs(): PluginDef[] {
    return (this.db.prepare('SELECT * FROM plugins ORDER BY id').all() as PluginDefRow[]).map(rowToDef)
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

  updateInstanceConfig(id: number, configJson: string): void {
    this.db
      .prepare('UPDATE plugin_instances SET config_json = ?, updated_at = ? WHERE id = ?')
      .run(configJson, new Date().toISOString().slice(0, 19).replace('T', ' '), id)
  }

  // ---------- plugin_store（通用存储） ----------
  storeGet(instanceId: number, entityKey: string, entityId: string): unknown {
    const row = this.db
      .prepare('SELECT value_json FROM plugin_store WHERE instance_id = ? AND entity_id = ? AND entity_key = ?')
      .get(instanceId, entityId, entityKey) as { value_json: string } | undefined
    return row ? JSON.parse(row.value_json) : null
  }

  storePut(instanceId: number, entityKey: string, entityId: string, valueJson: string, now: string): void {
    this.db
      .prepare(
        `INSERT INTO plugin_store (instance_id, entity_id, entity_key, value_json, version, created_at, updated_at)
         VALUES (?,?,?,?,1,?,?)
         ON CONFLICT(instance_id, entity_id, entity_key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`,
      )
      .run(instanceId, entityId, entityKey, valueJson, now, now)
  }

  storeRemove(instanceId: number, entityKey: string, entityId: string): void {
    this.db
      .prepare('DELETE FROM plugin_store WHERE instance_id = ? AND entity_id = ? AND entity_key = ?')
      .run(instanceId, entityId, entityKey)
  }

  storeList(instanceId: number, entityId: string): Array<{ entity_key: string; value_json: string }> {
    return this.db
      .prepare('SELECT entity_key, value_json FROM plugin_store WHERE instance_id = ? AND entity_id = ?')
      .all(instanceId, entityId) as Array<{ entity_key: string; value_json: string }>
  }

  storeDeleteByScope(scopeKey: number): void {
    this.db.prepare('DELETE FROM plugin_store WHERE instance_id = ?').run(scopeKey)
  }
}
