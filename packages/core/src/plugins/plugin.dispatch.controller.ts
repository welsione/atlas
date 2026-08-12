import { All, Controller, Logger, Param, Req, Res, Inject } from '@nestjs/common'
import type { Request, Response } from 'express'
import { PluginRegistry } from './plugin.registry.js'
import { PluginService } from './plugin.service.js'
import { ok, error } from '../common/response.js'
import { isBinaryResult, matchPath, parseMultipart, sanitizeDispositionFilename, textContentType } from './plugin-dispatch.utils.js'

/**
 * 插件声明式端点分发器（外部热加载插件）：
 * 路由 /api/apps/{appId}/plugins/{pluginType}/ep/{path...} → 匹配 PluginEndpoint → 调用 handler。
 * 支持 multipart 上传（body.files）与二进制下载（handle 返回 { $binary, $mime, $filename }）。
 * 插件卸载/实例停用 → 立即 404（热失效）。
 * 数据面（应用凭证 Bearer）访问走 PluginDataController（/api/v1/app/{appId}/plugins/...）。
 */
@Controller('/api/apps')
export class PluginDispatchController {
  private readonly logger = new Logger(PluginDispatchController.name)

  constructor(
    @Inject(PluginRegistry) private readonly registry: PluginRegistry,
    @Inject(PluginService) private readonly service: PluginService,
  ) {}

  @All(':appId/plugins/:pluginType/ep*')
  async dispatch(
    @Param('appId') appId: string,
    @Param('pluginType') pluginType: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const loaded = this.registry.byType(pluginType)
    if (!loaded) return res.status(404).json(error(404, `插件未注册: ${pluginType}`))
    const env = this.service.environmentOrNull(Number(appId), pluginType)
    if (!env) return res.status(404).json(error(404, '插件实例不可用（未启用或不存在）'))

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
      const params = matchPath(method, endpoint.path, suffix, endpoint.method)
      if (params === null) continue
      try {
        const result = await endpoint.handle(env, params, body)
        if (isBinaryResult(result)) {
          res.setHeader('Content-Type', textContentType(result.$mime))
          if (result.$filename) {
            res.setHeader('Content-Disposition', `attachment; filename="${sanitizeDispositionFilename(result.$filename)}"`)
          }
          return res.send(Buffer.from(result.$binary, 'base64'))
        }
        return res.json(ok(result ?? null))
      } catch (e) {
        this.logger.error(`插件端点异常: ${pluginType} ${method} ${suffix}，${(e as Error)?.stack ?? (e as Error)?.message}`)
        return res.status(500).json(error(500, '插件端点异常'))
      }
    }
    return res.status(404).json(error(404, `插件端点不存在: ${method} ${suffix}`))
  }
}
