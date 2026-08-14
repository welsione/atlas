import type { Request, Response } from 'express'
import type { Logger } from '@nestjs/common'
import type { PluginEnvironment } from '@atlas/types'
import busboy from 'busboy'
import { ok, error } from '../common/response.js'
import type { LoadedPlugin } from './types.js'

/** 二进制结果标记（插件下载端点用）。 */
export interface BinaryResult {
  /** 二进制内容：base64 字符串（小文件便捷通道）或 Buffer（大文件直接通道，避免 base64 全量往返）。 */
  $binary: string | Buffer
  $mime: string
  $filename?: string
}

export function isBinaryResult(value: unknown): value is BinaryResult {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (typeof v.$binary === 'string' || Buffer.isBuffer(v.$binary)) &&
    typeof v.$mime === 'string'
  )
}

/** 归一化二进制结果：Buffer 原样返回，base64 字符串解码为 Buffer。 */
export function binaryBuffer(result: BinaryResult): Buffer {
  return Buffer.isBuffer(result.$binary) ? result.$binary : Buffer.from(result.$binary, 'base64')
}

/** multipart 解析：body = { fields, files: [{originalname, buffer}] }。限制单文件/总量防内存 DoS。 */
export function parseMultipart(req: Request): Promise<{ fields: Record<string, string>; files: Array<{ originalname: string; buffer: Buffer; mimetype?: string }> }> {
  return new Promise((resolvePromise, reject) => {
    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: 64 * 1024 * 1024,   // 单文件 64MB（与数据集资产上传一致）
        files: 10,                    // 最多 10 个文件
        fields: 100,
        fieldSize: 1024 * 1024,
        parts: 200,
      },
    })
    const fields: Record<string, string> = {}
    const files: Array<{ originalname: string; buffer: Buffer; mimetype?: string }> = []
    let totalBytes = 0
    const TOTAL_LIMIT = 128 * 1024 * 1024 // 全部文件累计上限，防 10×64MB 内存爆炸
    const fail = (msg: string) => {
      req.unpipe(bb)
      bb.removeAllListeners()
      req.resume()
      reject(new Error(msg))
    }
    bb.on('limit', () => fail('上传超出大小/数量限制（单文件≤64MB，≤10 个）'))
    bb.on('field', (name: string, value: string) => {
      fields[name] = value
    })
    bb.on('file', (name: string, stream: NodeJS.ReadableStream, info: { filename: string; mimeType?: string }) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length
        if (totalBytes > TOTAL_LIMIT) {
          fail('上传总量超出限制（累计≤128MB）')
          return
        }
        chunks.push(chunk)
      })
      stream.on('end', () => files.push({ originalname: info.filename, buffer: Buffer.concat(chunks), mimetype: info.mimeType }))
    })
    bb.on('finish', () => {
      resolvePromise({ fields, files })
    })
    bb.on('error', (e: Error) => reject(e))
    req.pipe(bb)
  })
}

/** 端点路径匹配：{param} 占位解析（与 Java 版行为一致）。 */
/** 转义正则元字符（端点路径按字面匹配，防止 . + ( 等被误当正则语义）。 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function matchPath(method: string, pattern: string, suffix: string, endpointMethod: string): Record<string, string> | null {
  if (method !== endpointMethod.toUpperCase()) return null
  const names: string[] = []
  // 按 {param} 切分：奇数段为占位符 → 捕获组；偶数段为字面路径 → 转义正则元字符
  const regexSrc = pattern
    .split(/(\{[a-zA-Z0-9_]+\})/g)
    .map((part, i) => {
      if (i % 2 === 1) {
        names.push(part.slice(1, -1))
        return '([^/]+)'
      }
      return escapeRegExp(part)
    })
    .join('')
  const regex = new RegExp('^' + regexSrc + '$')
  const matcher = regex.exec(suffix)
  if (!matcher) return null
  const params: Record<string, string> = {}
  names.forEach((name, i) => {
    params[name] = matcher[i + 1]
  })
  return params
}

/** 文本类 MIME 附加 UTF-8 charset，防止中文按本地编码（GBK）解码乱码。 */
export function textContentType(mime: string): string {
  return /^(text\/|application\/json|application\/xml|application\/javascript)/i.test(mime)
    ? `${mime}; charset=utf-8`
    : mime
}

/** 剥离文件名中的控制字符/引号/反斜杠，防 Content-Disposition 响应头注入。 */
export function sanitizeDispositionFilename(name: string): string {
  return name.replace(/[\x00-\x1f\x7f"\\]/g, '_').slice(0, 255)
}

/** 端点匹配信息（供 guard / 审计回调引用）。 */
export interface EndpointMatched {
  method: string
  path: string
}

/** 端点访问审计上下文（成功或异常后回调）。 */
export interface EndpointAccessCtx {
  status: number
  bytes: number
  endpoint: EndpointMatched
}

/** 端点命中前的访问控制回调上下文。 */
export interface EndpointGuardCtx {
  endpoint: EndpointMatched
  method: string
  suffix: string
}

/**
 * 插件声明式端点分发（管理面 / 数据面共用的核心逻辑）：
 * 解析路径 → 解析 multipart body → 匹配端点 → guard 访问控制 → handle → 二进制/JSON 响应。
 *
 * 鉴权、端点启停规则、审计作为策略回调注入：
 * - `guard`：命中端点后调用；返回非 null 表示拦截（写入响应后停止）。
 * - `onAccess`：端点调用完成（成功 200 或异常 500）后审计回调（数据面写 api_access_logs，管理面写 ops_logs）。
 */
export interface PluginDispatchOptions {
  loaded: LoadedPlugin
  env: PluginEnvironment
  pluginType: string
  /** 用于从 originalUrl 截取 ep/ 后缀的 URL 前缀。 */
  prefix: string
  req: Request
  res: Response
  logger: Logger
  guard?: (ctx: EndpointGuardCtx) => { status: number; message: string } | null
  onAccess?: (ctx: EndpointAccessCtx) => void
}

export async function dispatchPluginEndpoint(opts: PluginDispatchOptions): Promise<void> {
  const { loaded, env, pluginType, req, res, logger } = opts
  const method = req.method
  const uri = req.originalUrl?.split('?')[0] ?? ''
  const idx = uri.indexOf(opts.prefix)
  const suffix = idx >= 0 ? uri.slice(idx + opts.prefix.length) : ''

  let body: unknown = null
  if (req.is('multipart/form-data')) {
    try {
      body = await parseMultipart(req)
    } catch (e) {
      res.status(413).json(error(413, (e as Error).message))
      return
    }
  } else if (req.body && Object.keys(req.body as object).length > 0) {
    body = req.body
  }

  const endpoints = loaded.plugin.endpoints?.() ?? []
  for (const endpoint of endpoints) {
    const params = matchPath(method, endpoint.path, suffix, endpoint.method)
    if (params === null) continue
    const matched: EndpointMatched = { method: endpoint.method, path: endpoint.path }
    const blocked = opts.guard?.({ endpoint: matched, method, suffix })
    if (blocked) {
      res.status(blocked.status).json(error(blocked.status, blocked.message))
      return
    }
    try {
      const result = await endpoint.handle(env, params, body)
      if (isBinaryResult(result)) {
        const buf = binaryBuffer(result)
        res.setHeader('Content-Type', textContentType(result.$mime))
        if (result.$filename) {
          res.setHeader('Content-Disposition', `attachment; filename="${sanitizeDispositionFilename(result.$filename)}"`)
        }
        res.send(buf)
        opts.onAccess?.({ status: 200, bytes: buf.length, endpoint: matched })
      } else {
        const payload = JSON.stringify(result ?? null)
        res.json(ok(result ?? null))
        opts.onAccess?.({ status: 200, bytes: payload.length, endpoint: matched })
      }
      return
    } catch (e) {
      // 插件端点异常不反射内部细节给消费方（可能含路径/SQL/密钥片段），仅记服务端日志
      logger.error(`插件端点异常: ${pluginType} ${method} ${suffix}，${(e as Error)?.stack ?? (e as Error)?.message}`)
      opts.onAccess?.({ status: 500, bytes: 0, endpoint: matched })
      res.status(500).json(error(500, '插件端点异常'))
      return
    }
  }
  res.status(404).json(error(404, `插件端点不存在: ${method} ${suffix}`))
}
