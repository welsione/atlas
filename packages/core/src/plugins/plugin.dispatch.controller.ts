import { All, Controller, Logger, Param, Req, Res, Inject } from '@nestjs/common'
import type { Request, Response } from 'express'
import { PluginRegistry } from './plugin.registry.js'
import { PluginService } from './plugin.service.js'
import { error } from '../common/response.js'
import { dispatchPluginEndpoint } from './plugin-dispatch.utils.js'

/**
 * 插件声明式端点分发器（外部热加载插件）：
 * 路由 /api/apps/{appId}/plugins/{pluginType}/ep/{path...} → 匹配 PluginEndpoint → 调用 handler。
 * 支持 multipart 上传（body.files）与二进制下载（handle 返回 { $binary, $mime, $filename }）。
 * 插件卸载/实例停用 → 立即 404（热失效）。
 * 数据面（应用凭证 Bearer）访问走 PluginDataController（/api/v1/app/{appId}/plugins/...）。
 * 核心分发逻辑与数据面共用 dispatchPluginEndpoint（管理面无端点规则拦截与审计）。
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

    return dispatchPluginEndpoint({
      loaded,
      env,
      pluginType,
      prefix: `/api/apps/${appId}/plugins/${pluginType}/ep/`,
      req,
      res,
      logger: this.logger,
    })
  }
}
