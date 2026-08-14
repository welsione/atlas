import { forwardRef, Module } from '@nestjs/common'
import { MonitorRepository } from './monitor.repository.js'
import { MonitorController } from './monitor.controller.js'
import { ExternalInterfaceRuleRepository } from './external-interface-rule.repository.js'
import { DatasetModule } from '../datasets/dataset.module.js'

/**
 * 接口监控（框架内置能力，非插件）：基于 api_access_logs 的对外发布接口聚合；
 * 接口目录 + 对外接口统一启停（external_interface_rules，数据集/插件公开 ep/文件 共用治理位）。
 * DatasetModule 供对外接口目录聚合数据集条目（forwardRef 打破与 PluginModule 的循环引用）。
 */
@Module({
  imports: [forwardRef(() => DatasetModule)],
  controllers: [MonitorController],
  providers: [MonitorRepository, ExternalInterfaceRuleRepository],
  exports: [MonitorRepository, ExternalInterfaceRuleRepository],
})
export class MonitorModule {}
