import { Module } from '@nestjs/common'
import { MonitorRepository } from './monitor.repository.js'
import { MonitorController } from './monitor.controller.js'

/** 接口监控（框架内置能力，非插件）：基于 api_access_logs 的对外发布接口聚合。 */
@Module({
  controllers: [MonitorController],
  providers: [MonitorRepository],
  exports: [MonitorRepository],
})
export class MonitorModule {}
