import type { Request } from 'express'

/** 二进制结果标记（插件下载端点用）。 */
export interface BinaryResult {
  $binary: string
  $mime: string
  $filename?: string
}

export function isBinaryResult(value: unknown): value is BinaryResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).$binary === 'string' &&
    typeof (value as Record<string, unknown>).$mime === 'string'
  )
}

/** multipart 解析：body = { fields, files: [{originalname, buffer}] }。限制单文件/总量防内存 DoS。 */
export function parseMultipart(req: Request): Promise<{ fields: Record<string, string>; files: Array<{ originalname: string; buffer: Buffer; mimetype?: string }> }> {
  return new Promise((resolvePromise, reject) => {
    const busboy = require('busboy') as (opts: Record<string, unknown>) => NodeJS.ReadWriteStream
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
export function matchPath(method: string, pattern: string, suffix: string, endpointMethod: string): Record<string, string> | null {
  if (method !== endpointMethod.toUpperCase()) return null
  const names = [...pattern.matchAll(/\{([a-zA-Z0-9_]+)}/g)].map((m) => m[1])
  const regex = new RegExp('^' + pattern.replaceAll(/\{[a-zA-Z0-9_]+\}/g, '([^/]+)') + '$')
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
