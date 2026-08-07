import { Controller, Get, Req, Res } from '@nestjs/common'
import { existsSync, readFileSync } from 'node:fs'
import type { Request, Response } from 'express'
import { ok, error } from '../common/response.js'
import { PluginFileRegistry } from '../plugins/plugin-file.registry.js'

/** IP 限流：每 IP 每分钟 120 次。 */
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

/**
 * 插件文件公开下载端点（公开前缀 /api/files/）：
 * 防穷举 token + 304 条件下载 + IP 限流 + api_access_logs 审计（MODEL_FILE 类型）。
 */
@Controller('/api/files')
export class PluginFileDownloadController {
  constructor(private readonly registry: PluginFileRegistry) {}

  @Get(':token/meta')
  meta(@Req() req: Request, @Res() res: Response) {
    const row = this.registry.findByToken(String(req.params.token))
    if (!row) return res.status(404).json(error(404, '文件不存在'))
    return res.json(
      ok({
        token: row.token,
        name: row.name || row.rel_path,
        pluginType: row.plugin_type,
        contentHash: row.content_hash,
        totalSize: row.total_size,
        fileCount: row.file_count,
        updatedAt: row.updated_at,
      }),
    )
  }

  @Get(':token/download')
  download(@Req() req: Request, @Res() res: Response) {
    const row = this.registry.findByToken(String(req.params.token))
    const ip = clientIp(req)
    if (!row) return res.status(404).json(error(404, '文件不存在'))
    if (!allowRate(ip)) {
      this.logAccess(row, 'download', 429, 0, ip, req.header('user-agent') ?? '')
      return res.status(429).json(error(429, '下载过于频繁'))
    }
    const etag = `"${row.content_hash}"`
    const ifNoneMatch = req.header('if-none-match')?.replace(/^W\//, '')
    if (ifNoneMatch && ifNoneMatch === etag) {
      this.logAccess(row, 'download', 304, 0, ip, req.header('user-agent') ?? '')
      res.setHeader('ETag', etag)
      return res.status(304).end()
    }
    const filePath = this.registry.filePathOf(row)
    if (!existsSync(filePath)) return res.status(404).json(error(404, '文件不存在'))
    const data = readFileSync(filePath)
    this.registry.touch(row.token)
    this.logAccess(row, 'download', 200, data.length, ip, req.header('user-agent') ?? '')
    res.setHeader('ETag', etag)
    res.setHeader('Content-Type', mimeOf(row.rel_path))
    return res.send(data)
  }

  private logAccess(row: { scope_key: number; plugin_type: string; token: string }, endpoint: string, status: number, bytes: number, ip: string, ua: string): void {
    // 写入平台 api_access_logs（monitor 聚合数据源）
    this.registry['db']
      .prepare(
        `INSERT INTO api_access_logs (owner_app_id, consumer_app_id, resource_type, resource_id, token,
           endpoint, http_status, bytes, ip, user_agent, accessed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        row.scope_key, 0, 'MODEL_FILE', 0, row.token, endpoint, status, bytes, ip ?? '', ua ?? '',
        new Date().toISOString().slice(0, 19).replace('T', ' '),
      )
  }
}

function allowRate(ip: string): boolean {
  if (!ip) return true
  const now = Date.now()
  const entry = rateBuckets.get(ip)
  if (!entry || entry.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  entry.count += 1
  if (entry.count > 120) {
    if (rateBuckets.size > 1000) rateBuckets.clear()
    return false
  }
  return true
}

export function clientIp(req: Request): string {
  const fwd = req.header('x-forwarded-for')
  if (fwd && fwd.trim() !== '') return fwd.split(',')[0].trim()
  return req.socket.remoteAddress ?? ''
}

function mimeOf(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.bin')) return 'application/octet-stream'
  if (lower.endsWith('.txt') || lower.endsWith('.text')) return 'text/plain'
  if (lower.endsWith('.zip')) return 'application/zip'
  return 'application/octet-stream'
}
