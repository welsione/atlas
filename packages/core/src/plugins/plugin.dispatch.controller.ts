import { All, Controller, Logger, Param, Req, Res, Inject } from '@nestjs/common'
import type { Request, Response } from 'express'
import { PluginRegistry } from './plugin.registry.js'
import { PluginService } from './plugin.service.js'
import { OpsLogService } from './ops-log.service.js'
import { EndpointRuleRepository } from '../monitor/endpoint-rule.repository.js'
import { error } from '../common/response.js'
import { dispatchPluginEndpoint } from './plugin-dispatch.utils.js'

/**
 * 插件声明式端点分发器（管理面，管理认证）：
 * 路由 /api/apps/{appId}/plugins/{pluginType}/ep/{path...} → 匹配 PluginEndpoint → 调用 handler。
 * 支持 multipart 上传（body.files）与二进制下载（handle 返回 { $binary, $mime, $filename }）。
 * 插件卸载/实例停用 → 立即 404（热失效）。
 * 数据面（应用凭证 Bearer）访问走 PluginDataController（/api/v1/app/{appId}/plugins/...）。
 *
 * 与管理面一致性（review M2）：
 * - 端点启停规则同样强制（endpoint_rules 停用即拦截）；管理面为认证管理员，返回 403 明示原因
 *   （数据面为防探测返回 404 伪装不存在）；
 * - 调用审计写入 ops_logs（运维台工作日志），不写 api_access_logs——避免控制台自身流量
 *   污染「对外接口目录」的消费统计（interfaceStats/topApps 以数据面消费方为准）。
 */
@Controller('/api/apps')
export class PluginDispatchController {
  private readonly logger = new Logger(PluginDispatchController.name)

  constructor(
    @Inject(PluginRegistry) private readonly registry: PluginRegistry,
    @Inject(PluginService) private readonly service: PluginService,
    @Inject(EndpointRuleRepository) private readonly rules: EndpointRuleRepository,
    @Inject(OpsLogService) private readonly opsLog: OpsLogService,
  ) {}

  @All(':appId/plugins/:pluginType/ep*')
  async dispatch(
    @Param('appId') appId: string,
    @Param('pluginType') pluginType: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const targetAppId = Number(appId)
    if (!Number.isInteger(targetAppId)) {
      return res.status(400).json(error(400, '非法应用 ID'))
    }
    const loaded = this.registry.byType(pluginType)
    if (!loaded) return res.status(404).json(error(404, `插件未注册: ${pluginType}`))
    const env = this.service.environmentOrNull(targetAppId, pluginType)
    if (!env) return res.status(404).json(error(404, '插件实例不可用（未启用或不存在）'))

    return dispatchPluginEndpoint({
      loaded,
      env,
      pluginType,
      prefix: `/api/apps/${appId}/plugins/${pluginType}/ep/`,
      req,
      res,
      logger: this.logger,
      guard: ({ endpoint, method, suffix }) =>
        this.rules.isAllowed(targetAppId, pluginType, endpoint.method, endpoint.path)
          ? null
          : { status: 403, message: `插件端点已停用: ${method} ${suffix}` },
      onAccess: (ctx) =>
        this.opsLog.write(
          targetAppId,
          pluginType,
          ctx.status >= 500 ? 'ERROR' : 'INFO',
          `管理面调用插件端点 ${ctx.endpoint.method} ${ctx.endpoint.path}`,
          { httpStatus: ctx.status, bytes: ctx.bytes },
        ),
    })
  }
}
