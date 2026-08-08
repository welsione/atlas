import { All, Controller, Param, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { PluginRegistry } from './plugin.registry.js'
import { PluginService } from './plugin.service.js'
import { ok, error } from '../common/response.js'

/**
 * 插件声明式端点分发器（外部热加载插件）：
 * 路由 /api/apps/{appId}/plugins/{pluginType}/ep/{path...} → 匹配 PluginEndpoint → 调用 handler。
 * 支持 multipart 上传（body.files）与二进制下载（handle 返回 { $binary, $mime, $filename }）。
 * 插件卸载/实例停用 → 立即 404（热失效）。
 */
@Controller('/api/apps')
export class PluginDispatchController {
  constructor(
    private readonly registry: PluginRegistry,
    private readonly service: PluginService,
  ) {}

  @All(':appId/plugins/:pluginType/ep*')
  async dispatch(
    @Param('appId') appId: string,
    @Param('pluginType') pluginType: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const loaded = this.registry.byType(pluginType)
    if (!loaded) return res.json(error(404, `插件未注册: ${pluginType}`))
    const env = this.service.environmentOrNull(Number(appId), pluginType)
    if (!env) return res.json(error(404, '插件实例不可用（未启用或不存在）'))

    const method = req.method
    const prefix = `/api/apps/${appId}/plugins/${pluginType}/ep/`
    const uri = req.originalUrl?.split('?')[0] ?? ''
    const idx = uri.indexOf(prefix)
    const suffix = idx >= 0 ? uri.slice(idx + prefix.length) : ''

    let body: unknown = null
    if (req.is('multipart/form-data')) {
      try {
        body = await parseMultipart(req)
      } catch (e) {
        return res.status(413).json(error(413, (e as Error).message))
      }
    } else if (req.body && Object.keys(req.body as object).length > 0) {
      body = req.body
    }

    const endpoints = loaded.plugin.endpoints?.() ?? []
    for (const endpoint of endpoints) {
      const params = match(method, endpoint.path, suffix, endpoint.method)
      if (params === null) continue
      try {
        const result = await endpoint.handle(env, params, body)
        if (isBinaryResult(result)) {
          res.setHeader('Content-Type', result.$mime)
          if (result.$filename) {
            res.setHeader('Content-Disposition', `attachment; filename="${result.$filename}"`)
          }
          return res.send(Buffer.from(result.$binary, 'base64'))
        }
        return res.json(ok(result ?? null))
      } catch (e) {
        return res.json(error(500, `插件端点异常: ${(e as Error).message}`))
      }
    }
    return res.json(error(404, `插件端点不存在: ${method} ${suffix}`))
  }
}

/** 二进制结果标记（插件下载端点用）。 */
export interface BinaryResult {
  $binary: string
  $mime: string
  $filename?: string
}

function isBinaryResult(value: unknown): value is BinaryResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).$binary === 'string' &&
    typeof (value as Record<string, unknown>).$mime === 'string'
  )
}

/** multipart 解析：body = { fields, files: [{originalname, buffer}] }。限制单文件/总量防内存 DoS。 */
function parseMultipart(req: Request): Promise<{ fields: Record<string, string>; files: Array<{ originalname: string; buffer: Buffer }> }> {
  return new Promise((resolvePromise, reject) => {
    const busboy = require('busboy') as (opts: Record<string, unknown>) => NodeJS.ReadWriteStream
    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: 100 * 1024 * 1024,   // 单文件 100MB
        files: 10,                     // 最多 10 个文件
        fields: 100,
        fieldSize: 1024 * 1024,
        parts: 200,
      },
    })
    const fields: Record<string, string> = {}
    const files: Array<{ originalname: string; buffer: Buffer }> = []
    let limitExceeded = false
    bb.on('limit', () => {
      limitExceeded = true
      req.unpipe(bb)
      bb.removeAllListeners()
      req.resume()
      reject(new Error('上传超出大小/数量限制（单文件≤100MB，≤10 个）'))
    })
    bb.on('field', (name: string, value: string) => {
      fields[name] = value
    })
    bb.on('file', (name: string, stream: NodeJS.ReadableStream, info: { filename: string }) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => files.push({ originalname: info.filename, buffer: Buffer.concat(chunks) }))
    })
    bb.on('finish', () => {
      if (limitExceeded) return
      resolvePromise({ fields, files })
    })
    bb.on('error', (e: Error) => reject(e))
    req.pipe(bb)
  })
}

/** 端点路径匹配：{param} 占位解析（与 Java 版行为一致）。 */
function match(method: string, pattern: string, suffix: string, endpointMethod: string): Record<string, string> | null {
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
