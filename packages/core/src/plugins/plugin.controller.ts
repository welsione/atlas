import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common'
import type { Request } from 'express'
import { ok, error, ValidationError, NotFoundError } from '../common/response.js'
import { pageParams } from '../common/utils.js'
import { PluginService } from './plugin.service.js'
import { PluginRegistry } from './plugin.registry.js'
import { PluginUiService } from './plugin-ui.service.js'
import { PluginLoader } from './plugin.loader.js'
import { PluginWatcher } from './plugin.watcher.js'

/** 插件注册表端点（平台级）。 */
@Controller('/api/plugins')
export class PluginController {
  constructor(
    @Inject(PluginService) private readonly service: PluginService,
    @Inject(PluginRegistry) private readonly registry: PluginRegistry,
    @Inject(PluginUiService) private readonly uiService: PluginUiService,
    @Inject(PluginLoader) private readonly loader: PluginLoader,
    @Inject(PluginWatcher) private readonly watcher: PluginWatcher,
  ) {}

  @Get()
  list(@Query('page') page?: string, @Query('size') size?: string) {
    const { page: p, size: s } = pageParams(page, size)
    const result = this.service.instanceOverviewPage(0, p, s)
    return ok({
      ...result,
      rows: result.rows.map((row) => ({
        plugin: row.plugin,
        runtimeLoaded: row.runtimeLoaded,
        runtimeArtifact: this.registry.byType(row.plugin.pluginType)?.artifact ?? '',
      })),
    })
  }

  @Get('spi-overview')
  spiOverview() {
    return ok(this.service.spiOverview())
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
  async reload() {
    try {
      await this.loader.reloadAll()
      this.watcher.resyncKnown()
      return ok(null)
    } catch (e) {
      return error(500, (e as Error).message)
    }
  }
}

/** 插件实例端点（应用空间）。 */
@Controller('/api/apps')
export class PluginInstanceController {
  constructor(@Inject(PluginService) private readonly service: PluginService) {}

  @Get(':appId/plugins')
  overview(@Param('appId') appId: string, @Query('page') page?: string, @Query('size') size?: string) {
    const { page: p, size: s } = pageParams(page, size)
    return ok(this.service.instanceOverviewPage(Number(appId), p, s))
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

  @Get(':appId/plugins/:pluginType/config')
  getConfig(@Param('appId') appId: string, @Param('pluginType') pluginType: string) {
    return ok(this.service.getInstanceConfig(Number(appId), pluginType))
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
