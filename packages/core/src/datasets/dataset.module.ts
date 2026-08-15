import { forwardRef, Module } from '@nestjs/common'
import { DatasetRepository } from './dataset.repository.js'
import { DatasetService } from './dataset.service.js'
import { DatasetController } from './dataset.controller.js'
import { DatasetConsumeController } from './consume.controller.js'
import { DatasetScheduler } from './dataset.scheduler.js'
import { PluginModule } from '../plugins/plugin.module.js'
import { MonitorModule } from '../monitor/monitor.module.js'

@Module({
  // MonitorModule 提供 ExternalInterfaceRuleRepository（数据面向外接口启停），forwardRef 打破环形引用
  imports: [forwardRef(() => PluginModule), forwardRef(() => MonitorModule)],
  controllers: [DatasetController, DatasetConsumeController],
  providers: [
    DatasetRepository,
    DatasetService,
    DatasetScheduler,
  ],
  exports: [DatasetService, DatasetRepository],
})
export class DatasetModule {}
