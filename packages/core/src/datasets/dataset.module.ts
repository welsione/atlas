import { forwardRef, Module } from '@nestjs/common'
import { DatasetRepository } from './dataset.repository.js'
import { DatasetService } from './dataset.service.js'
import { DatasetController } from './dataset.controller.js'
import { DatasetConsumeController } from './consume.controller.js'
import { DatasetScheduler } from './dataset.scheduler.js'
import { PluginModule } from '../plugins/plugin.module.js'

@Module({
  imports: [forwardRef(() => PluginModule)],
  controllers: [DatasetController, DatasetConsumeController],
  providers: [
    DatasetRepository,
    DatasetService,
    DatasetScheduler,
  ],
  exports: [DatasetService, DatasetRepository],
})
export class DatasetModule {}
