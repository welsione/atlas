import { Inject, Injectable } from '@nestjs/common'
import { DB } from '../db/database.module.js'
import type Database from 'better-sqlite3'
import type { Dataset, DatasetSensitivity, Secret } from '@atlas/types'
import { now } from '../common/utils.js'

export interface DatasetRow {
  id: number
  app_id: number
  plugin_type: string
  dataset_key: string
  name: string
  description: string
  sensitivity: string
  token: string
  version: number
  content_hash: string
  content_json: string
  assets_json: string
  dek_wrapped: string
  refresh_mode: string
  refresh_interval_seconds: number | null
  last_refreshed_at: string | null
  status: string
  created_at: string
  updated_at: string
}

export const rowToDataset = (r: DatasetRow): Dataset => ({
  id: r.id,
  appId: r.app_id,
  pluginType: r.plugin_type,
  datasetKey: r.dataset_key,
  name: r.name,
  description: r.description,
  sensitivity: r.sensitivity as DatasetSensitivity,
  token: r.token,
  version: r.version,
  contentHash: r.content_hash,
  contentJson: r.content_json,
  assets: JSON.parse(r.assets_json || '[]'),
  dekWrapped: r.dek_wrapped,
  refreshMode: r.refresh_mode as 'MANUAL' | 'SCHEDULED',
  refreshIntervalSeconds: r.refresh_interval_seconds,
  lastRefreshedAt: r.last_refreshed_at,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

@Injectable()
export class DatasetRepository {
  constructor(@Inject(DB) private readonly db: Database.Database) {}

  insert(row: Omit<DatasetRow, 'id'>): number {
    const info = this.db
      .prepare(
        `INSERT INTO datasets (app_id, plugin_type, dataset_key, name, description, sensitivity, token,
           version, content_hash, content_json, assets_json, dek_wrapped, refresh_mode,
           refresh_interval_seconds, last_refreshed_at, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        row.app_id, row.plugin_type, row.dataset_key, row.name, row.description, row.sensitivity, row.token,
        row.version, row.content_hash, row.content_json, row.assets_json, row.dek_wrapped, row.refresh_mode,
        row.refresh_interval_seconds, row.last_refreshed_at, row.status, row.created_at, row.updated_at,
      )
    return Number(info.lastInsertRowid)
  }

  updateContent(
    id: number,
    name: string,
    description: string,
    sensitivity: string,
    version: number,
    contentHash: string,
    contentJson: string,
    assetsJson: string,
    dekWrapped: string,
    now: string,
  ): void {
    this.db
      .prepare(
        `UPDATE datasets SET name=?, description=?, sensitivity=?, version=?, content_hash=?,
           content_json=?, assets_json=?, dek_wrapped=?, updated_at=? WHERE id=?`,
      )
      .run(name, description, sensitivity, version, contentHash, contentJson, assetsJson, dekWrapped, now, id)
  }

  updateRefreshMeta(id: number, lastRefreshedAt: string): void {
    this.db.prepare('UPDATE datasets SET last_refreshed_at = ? WHERE id = ?').run(lastRefreshedAt, id)
  }

  /** 插件注册调度同步（注册声明的 refreshMode/interval 变化时更新）。 */
  updateRefreshSchedule(id: number, mode: string, intervalSeconds: number | null): void {
    this.db
      .prepare('UPDATE datasets SET refresh_mode = ?, refresh_interval_seconds = ?, updated_at = ? WHERE id = ?')
      .run(mode, intervalSeconds, now(), id)
  }

  /** 资产清单变更：写入清单并 bump 版本（内容哈希不变）。 */
  updateAssets(id: number, assetsJson: string, version: number, now: string): void {
    this.db
      .prepare('UPDATE datasets SET assets_json = ?, version = ?, updated_at = ? WHERE id = ?')
      .run(assetsJson, version, now, id)
  }

  findAllByApp(appId: number): Dataset[] {
    return (this.db.prepare('SELECT * FROM datasets WHERE app_id = ? ORDER BY id').all(appId) as DatasetRow[])
      .map(rowToDataset)
  }

  /** 精确查找（app + 插件 + key），避免全表扫描 content_json 大字段。 */
  findDatasetByKey(appId: number, pluginType: string, datasetKey: string): Dataset | undefined {
    const row = this.db
      .prepare('SELECT * FROM datasets WHERE app_id = ? AND plugin_type = ? AND dataset_key = ?')
      .get(appId, pluginType, datasetKey) as DatasetRow | undefined
    return row ? rowToDataset(row) : undefined
  }

  findById(id: number): Dataset | undefined {
    const row = this.db.prepare('SELECT * FROM datasets WHERE id = ?').get(id) as DatasetRow | undefined
    return row ? rowToDataset(row) : undefined
  }

  findByToken(token: string): Dataset | undefined {
    const row = this.db.prepare('SELECT * FROM datasets WHERE token = ?').get(token) as DatasetRow | undefined
    return row ? rowToDataset(row) : undefined
  }

  findScheduled(): Dataset[] {
    return (
      this.db
        .prepare("SELECT * FROM datasets WHERE refresh_mode = 'SCHEDULED' AND status = 'PUBLISHED'")
        .all() as DatasetRow[]
    ).map(rowToDataset)
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM datasets WHERE id = ?').run(id)
  }

  // ---------- secrets ----------
  insertSecret(datasetId: number, keyName: string, ciphertext: string, nowTs: string): void {
    const version = (this.db
      .prepare('SELECT COALESCE(MAX(secret_version), 0) + 1 v FROM secrets WHERE dataset_id = ? AND key_name = ?')
      .get(datasetId, keyName) as { v: number }).v
    this.db
      .prepare(
        'INSERT INTO secrets (dataset_id, key_name, ciphertext, secret_version, active, created_at, updated_at) VALUES (?,?,?,?,1,?,?)',
      )
      .run(datasetId, keyName, ciphertext, version, nowTs, nowTs)
  }

  findActiveSecrets(datasetId: number): Array<{ id: number; key_name: string; ciphertext: string; created_at: string }> {
    return this.db
      .prepare('SELECT id, key_name, ciphertext, created_at FROM secrets WHERE dataset_id = ? AND active = 1 ORDER BY id')
      .all(datasetId) as Array<{ id: number; key_name: string; ciphertext: string; created_at: string }>
  }

  deactivateSecret(datasetId: number, keyName: string): void {
    this.db
      .prepare('UPDATE secrets SET active = 0, updated_at = ? WHERE dataset_id = ? AND key_name = ? AND active = 1')
      .run(now(), datasetId, keyName)
  }

  // ---------- grants ----------
  insertGrant(datasetId: number, appId: number): void {
    this.db
      .prepare(
        `INSERT INTO dataset_app_grants (dataset_id, app_id, granted_at) VALUES (?,?,?)
         ON CONFLICT(dataset_id, app_id) DO UPDATE SET revoked_at = NULL, granted_at = excluded.granted_at`,
      )
      .run(datasetId, appId, now())
  }

  revokeGrant(datasetId: number, appId: number): void {
    this.db
      .prepare('UPDATE dataset_app_grants SET revoked_at = ? WHERE dataset_id = ? AND app_id = ? AND revoked_at IS NULL')
      .run(now(), datasetId, appId)
  }

  hasGrant(datasetId: number, appId: number): boolean {
    const row = this.db
      .prepare('SELECT id FROM dataset_app_grants WHERE dataset_id = ? AND app_id = ? AND revoked_at IS NULL')
      .get(datasetId, appId)
    return row !== undefined
  }

  grantAppIds(datasetId: number): number[] {
    const rows = this.db
      .prepare('SELECT app_id FROM dataset_app_grants WHERE dataset_id = ? AND revoked_at IS NULL')
      .all(datasetId) as Array<{ app_id: number }>
    return rows.map((r) => r.app_id)
  }

  // ---------- 审计与访问日志 ----------
  insertDownloadLog(datasetId: number, appId: number | null, token: string, ip: string, ua: string, bytes: number): void {
    this.db
      .prepare(
        'INSERT INTO dataset_download_logs (dataset_id, app_id, token, ip, user_agent, bytes, downloaded_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run(datasetId, appId ?? 0, token, ip ?? '', ua ?? '', bytes, now())
  }

  insertSecretAccessLog(secretId: number, datasetId: number, appId: number, ip: string): void {
    this.db
      .prepare('INSERT INTO secret_access_logs (secret_id, dataset_id, app_id, ip, accessed_at) VALUES (?,?,?,?,?)')
      .run(secretId, datasetId, appId, ip ?? '', now())
  }

  insertAccessLog(
    ownerAppId: number,
    consumerAppId: number | null,
    resourceType: string,
    resourceId: number,
    token: string,
    endpoint: string,
    httpStatus: number,
    bytes: number,
    ip: string,
    ua: string,
  ): void {
    this.db
      .prepare(
        `INSERT INTO api_access_logs (owner_app_id, consumer_app_id, resource_type, resource_id, token,
           endpoint, http_status, bytes, ip, user_agent, accessed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        ownerAppId, consumerAppId ?? 0, resourceType, resourceId, token ?? '',
        endpoint, httpStatus, bytes, ip ?? '', ua ?? '',
        now(),
      )
  }

  // ---------- 审计查询（管理面） ----------
  downloadLogs(datasetId: number, limit = 50): Array<Record<string, unknown>> {
    return this.db
      .prepare(
        'SELECT ip, user_agent, bytes, downloaded_at FROM dataset_download_logs WHERE dataset_id = ? ORDER BY id DESC LIMIT ?',
      )
      .all(datasetId, limit) as Array<Record<string, unknown>>
  }

  secretAccessLogs(datasetId: number, limit = 50): Array<Record<string, unknown>> {
    return this.db
      .prepare(
        'SELECT l.ip, l.accessed_at, l.app_id FROM secret_access_logs l WHERE l.dataset_id = ? ORDER BY l.id DESC LIMIT ?',
      )
      .all(datasetId, limit) as Array<Record<string, unknown>>
  }

  secretHistory(datasetId: number): Array<Record<string, unknown>> {
    return this.db
      .prepare(
        'SELECT id, key_name, secret_version, active, created_at FROM secrets WHERE dataset_id = ? ORDER BY id DESC',
      )
      .all(datasetId) as Array<Record<string, unknown>>
  }
}
