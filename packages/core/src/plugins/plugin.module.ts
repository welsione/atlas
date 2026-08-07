import { forwardRef, Global, Module } from '@nestjs/common'
import { PluginRegistry } from './plugin.registry.js'
import { PluginRepository } from './plugin.repository.js'
import { PluginService } from './plugin.service.js'
import { PluginLoader } from './plugin.loader.js'
import { PluginWatcher } from './plugin.watcher.js'
import { OpsLogService } from './ops-log.service.js'
import { PluginController, PluginInstanceController } from './plugin.controller.js'
import { PluginDispatchController } from './plugin.dispatch.controller.js'
import { PluginUiService } from './plugin-ui.service.js'
import { PluginUiController } from './plugin-ui.controller.js'
import { OpsController } from './ops.controller.js'
import { PluginFileRegistry } from './plugin-file.registry.js'
import { PluginFileDownloadController } from './plugin-file-download.controller.js'
import { DatasetModule } from '../datasets/dataset.module.js'

@Global()
@Module({
  imports: [forwardRef(() => DatasetModule)],
  controllers: [
    PluginController,
    PluginInstanceController,
    PluginDispatchController,
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
  ],
  exports: [PluginService, PluginRegistry, OpsLogService],
})
export class PluginModule {}
