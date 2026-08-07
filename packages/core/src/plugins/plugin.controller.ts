import { Body, Controller, Delete, Get, Inject, Param, Post } from '@nestjs/common'
import type { Request } from 'express'
import { ok, error, ValidationError, NotFoundError } from '../common/response.js'
import { PluginService } from './plugin.service.js'
import { PluginRegistry } from './plugin.registry.js'
import { PluginUiService } from './plugin-ui.service.js'

/** 插件注册表端点（平台级）。 */
@Controller('/api/plugins')
export class PluginController {
  constructor(
    private readonly service: PluginService,
    private readonly registry: PluginRegistry,
    private readonly uiService: PluginUiService,
  ) {}

  @Get()
  list() {
    return ok(
      this.service.instanceOverview(0).map((row) => ({
        plugin: row.plugin,
        runtimeLoaded: row.runtimeLoaded,
        runtimeArtifact: this.registry.byType(row.plugin.pluginType)?.artifact ?? '',
      })),
    )
  }

  @Post(':pluginType/unload')
  unload(@Param('pluginType') pluginType: string) {
    try {
      this.service.unload(pluginType)
      return ok(null)
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Post('reload')
  reload() {
    return ok(null)
  }
}

/** 插件实例端点（应用空间）。 */
@Controller('/api/apps')
export class PluginInstanceController {
  constructor(private readonly service: PluginService) {}

  @Get(':appId/plugins')
  overview(@Param('appId') appId: string) {
    return ok(this.service.instanceOverview(Number(appId)))
  }

  @Post(':appId/plugins/:pluginType/enable')
  enable(@Param('appId') appId: string, @Param('pluginType') pluginType: string, @Body() body: { dataScope?: string }) {
    try {
      return ok(this.service.enableInstance(Number(appId), pluginType, body?.dataScope))
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Post(':appId/plugins/:pluginType/disable')
  disable(@Param('appId') appId: string, @Param('pluginType') pluginType: string) {
    try {
      return ok(this.service.disableInstance(Number(appId), pluginType))
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Delete(':appId/plugins/:pluginType')
  remove(@Param('appId') appId: string, @Param('pluginType') pluginType: string) {
    try {
      this.service.deleteInstance(Number(appId), pluginType)
      return ok(null)
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Post(':appId/plugins/:pluginType/config')
  updateConfig(@Param('appId') appId: string, @Param('pluginType') pluginType: string, @Body() body: Record<string, unknown>) {
    try {
      this.service.updateInstanceConfig(Number(appId), pluginType, body ?? {})
      return ok(null)
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }
}
