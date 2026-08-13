import { Controller, Get, Param, Req, Res, Inject } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ok } from '../common/response.js'
import { PluginRegistry } from './plugin.registry.js'
import { PluginUiService } from './plugin-ui.service.js'

/**
 * 插件 UI 资源端点：
 * - GET /api/plugins/ui —— 全部已注册插件的 UI manifest 摘要（管理认证）
 * - GET /_pluginui/{type}/{path} —— manifest / entry / assets（公开前缀：动态 import 无 token 头）
 */
@Controller()
export class PluginUiController {
  constructor(
    @Inject(PluginRegistry) private readonly registry: PluginRegistry,
    @Inject(PluginUiService) private readonly uiService: PluginUiService,
  ) {}

  @Get('/api/plugins/ui')
  all() {
    return ok(this.uiService.allManifests())
  }

  @Get('/_pluginui/:pluginType*')
  resource(@Param('pluginType') pluginType: string, @Req() req: Request, @Res() res: Response) {
    const loaded = this.registry.byType(pluginType)
    if (!loaded) {
      res.status(404).end()
      return
    }
    const prefix = `/_pluginui/${pluginType}/`
    // originalUrl 为未解码原始路径，与已解码的 @Param('pluginType') 对齐：先安全解码再截取
    let uri = req.originalUrl?.split('?')[0] ?? ''
    try {
      uri = decodeURIComponent(uri)
    } catch {
      // 非法编码按原样处理（后续 isSafePath / resolve().startsWith 二次校验兜底）
    }
    const idx = uri.indexOf(prefix)
    const name = idx >= 0 ? uri.slice(idx + prefix.length) : ''
    // icons/ 前缀 → 插件图标目录（manifest.icon 相对路径指向这里）
    const content = name.startsWith('icons/')
      ? this.uiService.readIconFile(pluginType, name.slice('icons/'.length))
      : this.uiService.readUiFile(pluginType, name || 'manifest.json')
    if (content === null) {
      res.status(404).end()
      return
    }
    const lower = (name || 'manifest.json').toLowerCase()
    let type = 'application/octet-stream'
    if (lower.endsWith('.json')) type = 'application/json'
    else if (lower.endsWith('.js') || lower.endsWith('.mjs')) type = 'text/javascript'
    else if (lower.endsWith('.css')) type = 'text/css'
    else if (lower.endsWith('.svg')) type = 'image/svg+xml'
    else if (lower.endsWith('.png')) type = 'image/png'
    const cache = name === 'manifest.json' ? 'no-cache' : 'public, max-age=31536000, immutable'
    res.setHeader('Content-Type', type)
    res.setHeader('Cache-Control', cache)
    res.send(content)
  }
}
