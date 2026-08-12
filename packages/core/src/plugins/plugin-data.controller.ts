import { All, Controller, Logger, Param, Req, Res, Inject } from '@nestjs/common'
import type { Request, Response } from 'express'
import { PluginRegistry } from './plugin.registry.js'
import { PluginService } from './plugin.service.js'
import { AppTokenService } from '../auth/app-token.service.js'
import { ok, error } from '../common/response.js'
import { isBinaryResult, matchPath, parseMultipart, sanitizeDispositionFilename, textContentType } from './plugin-dispatch.utils.js'

/**
 * 插件数据面网关（公开前缀 /api/v1/，应用凭证 Bearer 鉴权）：
 * GET/POST/PUT/DELETE /api/v1/app/{appId}/plugins/{pluginType}/ep/{path...}
 * - 应用用 app_id + app_secret 换短时效 token（POST /api/v1/app/auth）后携带 Bearer 调用
 * - 仅允许访问自身 appId 的插件实例（token 与应用路径不一致 → 403）
 * - 端点匹配与调用逻辑与管理面 PluginDispatchController 一致（共享 utils）
 */
@Controller('/api/v1/app')
export class PluginDataController {
  private readonly logger = new Logger(PluginDataController.name)

  constructor(
    @Inject(PluginRegistry) private readonly registry: PluginRegistry,
    @Inject(PluginService) private readonly service: PluginService,
    @Inject(AppTokenService) private readonly tokenService: AppTokenService,
  ) {}

  @All(':appId/plugins/:pluginType/ep*')
  async dispatch(
    @Param('appId') appId: string,
    @Param('pluginType') pluginType: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 1. 应用凭证鉴权：Bearer token → appId（数字）
    const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '')
    const tokenAppId = this.tokenService.validate(bearer)
    if (tokenAppId === null) {
      return res.status(401).json(error(401, '未认证：应用令牌无效或已过期'))
    }
    // 2. 越权防护：应用只能访问自己的实例
    const targetAppId = Number(appId)
    if (!Number.isInteger(targetAppId) || targetAppId !== tokenAppId) {
      return res.status(403).json(error(403, '无权访问该应用的插件数据面'))
    }

    const loaded = this.registry.byType(pluginType)
    if (!loaded) return res.status(404).json(error(404, `插件未注册: ${pluginType}`))
    const env = this.service.environmentOrNull(targetAppId, pluginType)
    if (!env) return res.status(404).json(error(404, '插件实例不可用（未启用或不存在）'))

    const method = req.method
    const prefix = `/api/v1/app/${appId}/plugins/${pluginType}/ep/`
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
        // 插件端点异常不反射内部细节给数据面消费者（可能含路径/SQL/密钥片段），仅记服务端日志
        this.logger.error(`插件端点异常: ${pluginType} ${method} ${suffix}，${(e as Error)?.stack ?? (e as Error)?.message}`)
        return res.status(500).json(error(500, '插件端点异常'))
      }
    }
    return res.status(404).json(error(404, `插件端点不存在: ${method} ${suffix}`))
  }
}
