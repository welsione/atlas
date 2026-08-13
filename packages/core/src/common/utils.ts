import type { Request } from 'express'

/** 统一时间戳：本地时区 yyyy-MM-dd HH:mm:ss（与 SQLite datetime('now','localtime') 对齐）。 */
export function now(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

/** 分页参数归一：page 从 1 起，size 默认 10 上限 100。 */
export function pageParams(
  page: string | number | undefined,
  size: string | number | undefined,
  defaultSize = 10,
  maxSize = 100,
): { page: number; size: number } {
  const p = Math.max(1, Math.floor(Number(page ?? 1)) || 1)
  const s = Math.min(maxSize, Math.max(1, Math.floor(Number(size ?? defaultSize)) || defaultSize))
  return { page: p, size: s }
}

/**
 * 客户端 IP：默认仅信任 socket 地址（防 XFF 伪造绕过黑名单/限流/审计）；
 * 仅当 trustProxy 开启时解析 x-forwarded-for 首值（部署在可信反向代理后）。
 */
export function clientIp(req: Request, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = req.header('x-forwarded-for')
    if (fwd && fwd.trim() !== '') return fwd.split(',')[0].trim()
  }
  return req.socket.remoteAddress ?? ''
}

export interface RateLimiter {
  allow(key: string): boolean
}

/** 滑窗 IP 限流器：windowMs 内每 key 最多 limit 次；超 maxEntries 时清空防内存膨胀。 */
export function createRateLimiter(limit: number, windowMs: number, maxEntries = 10_000): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>()
  return {
    allow(key: string): boolean {
      if (!key) return true
      const nowMs = Date.now()
      const entry = buckets.get(key)
      if (!entry || entry.resetAt < nowMs) {
        if (buckets.size >= maxEntries) buckets.clear()
        buckets.set(key, { count: 1, resetAt: nowMs + windowMs })
        return true
      }
      entry.count += 1
      return entry.count <= limit
    },
  }
}
