import { forwardRef, Global, Module } from '@nestjs/common'
import { PluginRegistry } from './plugin.registry.js'
import { PluginRepository } from './plugin.repository.js'
import { PluginService } from './plugin.service.js'
import { PluginLoader } from './plugin.loader.js'
import { PluginWatcher } from './plugin.watcher.js'
import { OpsLogService } from './ops-log.service.js'
import { PluginController, PluginInstanceController } from './plugin.controller.js'
import { PluginDispatchController } from './plugin.dispatch.controller.js'
import { PluginDataController } from './plugin-data.controller.js'
import { PluginEpTokenRepository } from './plugin-ep-token.repository.js'
import { PluginUiService } from './plugin-ui.service.js'
import { PluginUiController } from './plugin-ui.controller.js'
import { OpsController } from './ops.controller.js'
import { PluginFileRegistry } from './plugin-file.registry.js'
import { PluginFileDownloadController } from './plugin-file-download.controller.js'
import { DatasetModule } from '../datasets/dataset.module.js'
import { SpiModule } from '../spi/spi.module.js'
import { MonitorModule } from '../monitor/monitor.module.js'

@Global()
@Module({
  // SpiModule 提供 PlatformEventEmitter / ExtensionRegistry / 门面 / PluginSpiRegistry，
  // PluginService 构造期依赖它们；显式 import 建立依赖边，确保 SpiModule 先于 PluginModule 实例化。
  // MonitorModule 提供 ExternalInterfaceRuleRepository（管理面/数据面统一对外接口启停拦截 + PLUGIN_EP 访问日志）。
  imports: [SpiModule, MonitorModule, forwardRef(() => DatasetModule)],
  controllers: [
    PluginController,
    PluginInstanceController,
    PluginDispatchController,
    PluginDataController,
    PluginUiController,
    OpsController,
    PluginFileDownloadController,
  ],
  providers: [
    PluginRegistry,
    PluginRepository,
    PluginService,
    PluginLoader,
    PluginWatcher,
    OpsLogService,
    PluginUiService,
    PluginFileRegistry,
    PluginEpTokenRepository,
  ],
  exports: [PluginService, PluginRegistry, OpsLogService, PluginEpTokenRepository, PluginFileRegistry],
})
export class PluginModule {}
