import { All, Controller, Logger, Param, Req, Res, Inject } from '@nestjs/common'
import type { Request, Response } from 'express'
import { PluginRegistry } from './plugin.registry.js'
import { PluginService } from './plugin.service.js'
import { PluginEpTokenRepository } from './plugin-ep-token.repository.js'
import { AppTokenService } from '../auth/app-token.service.js'
import { ExternalInterfaceRuleRepository } from '../monitor/external-interface-rule.repository.js'
import { error } from '../common/response.js'
import { dispatchPluginEndpoint } from './plugin-dispatch.utils.js'

/**
 * 插件数据面网关（公开前缀 /api/v1/，应用凭证 Bearer 鉴权 + 对外端点 token 寻址）：
 * GET/POST/PUT/DELETE /api/v1/app/{appId}/plugins/{pluginType}/{apiToken}/ep/{path...}
 * - 应用用 app_id + app_secret 换短时效 token（POST /api/v1/app/auth）后携带 Bearer 调用
 * - 仅允许访问自身 appId 的插件实例（token 与应用路径不一致 → 403；appId 非整数 → 400）
 * - {apiToken} 为该插件公开端点（public:true）专属防穷举 token，非公开/未启用/无匹配 → 404 防探测
 * - 统一启停（external_interface_rules）停用 → 404 防探测
 * - 端点匹配与调用逻辑与管理面 PluginDispatchController 一致（共享 dispatchPluginEndpoint）
 * - 接口监控：调用写入 api_access_logs（PLUGIN_EP）
 */
@Controller('/api/v1/app')
export class PluginDataController {
  private readonly logger = new Logger(PluginDataController.name)

  constructor(
    @Inject(PluginRegistry) private readonly registry: PluginRegistry,
    @Inject(PluginService) private readonly service: PluginService,
    @Inject(PluginEpTokenRepository) private readonly epTokens: PluginEpTokenRepository,
    @Inject(AppTokenService) private readonly tokenService: AppTokenService,
    @Inject(ExternalInterfaceRuleRepository) private readonly rules: ExternalInterfaceRuleRepository,
  ) {}

  @All(':appId/plugins/:pluginType/:apiToken/ep*')
  async dispatch(
    @Param('appId') appId: string,
    @Param('pluginType') pluginType: string,
    @Param('apiToken') apiToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 1. 应用凭证鉴权：Bearer token → appId（数字）
    const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '')
    const tokenAppId = this.tokenService.validate(bearer)
    if (tokenAppId === null) {
      return res.status(401).json(error(401, '未认证：应用令牌无效或已过期'))
    }
    // 2. 越权防护：应用只能访问自己的实例；appId 非法（非整数）→ 400
    const targetAppId = Number(appId)
    if (!Number.isInteger(targetAppId)) {
      return res.status(400).json(error(400, '非法应用 ID'))
    }
    if (targetAppId !== tokenAppId) {
      return res.status(403).json(error(403, '无权访问该应用的插件数据面'))
    }

    const loaded = this.registry.byType(pluginType)
    const endpoint = loaded ? this.resolvePublicEndpoint(loaded.plugin, apiToken, targetAppId, pluginType) : null
    if (!loaded || !endpoint) {
      return res.status(404).json(error(404, `插件端点不存在: ${req.method} ${pluginType}/${apiToken}`))
    }
    const env = this.service.environmentOrNull(targetAppId, pluginType)
    if (!env) return res.status(404).json(error(404, '插件实例不可用（未启用或不存在）'))

    const ip = req.socket.remoteAddress ?? ''
    const ua = req.header('user-agent') ?? ''
    return dispatchPluginEndpoint({
      loaded,
      env,
      pluginType,
      prefix: `/api/v1/app/${appId}/plugins/${pluginType}/${apiToken}/ep/`,
      req,
      res,
      logger: this.logger,
      // 数据面仅对外开放（public）接口：token 寻址已限缩到具体公开端点，内部端点/未启用一律 404。
      guard: ({ endpoint, method, suffix }) => {
        // 统一启停：external_interface_rules 停用 → 404 防探测
        if (!this.rules.isAllowed(targetAppId, 'PLUGIN_EP', `${endpoint.method} ${endpoint.path}`)) {
          return { status: 404, message: `插件端点不存在: ${method} ${suffix}` }
        }
        return null
      },
      onAccess: (ctx) =>
        this.rules.logAccess({
          ownerAppId: targetAppId, consumerAppId: tokenAppId, pluginType,
          method: ctx.endpoint.method, endpointPath: ctx.endpoint.path,
          httpStatus: ctx.status, bytes: ctx.bytes, ip, ua,
        }),
    })
  }

  /** 用 apiToken 解析该插件公开端点；校验属主 + 方法/路径 + 敏感度授权。返回 null 表示不存在（404）。 */
  private resolvePublicEndpoint(
    plugin: import('@atlas/types').AtlasPlugin,
    apiToken: string,
    appId: number,
    pluginType: string,
  ): { method: string; path: string } | null {
    for (const ep of plugin.endpoints?.() ?? []) {
      if (ep.public !== true) continue
      if (!this.epTokens.matchToken(appId, pluginType, ep.method, ep.path, apiToken)) continue
      // 敏感度：PUBLIC 任意持 token；INTERNAL/SECRET 需属主应用（数据面已强制消费者=属主 appId，天然满足）
      return { method: ep.method, path: ep.path }
    }
    return null
  }
}

