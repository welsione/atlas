import { Module } from '@nestjs/common'
import { MonitorRepository } from './monitor.repository.js'
import { MonitorController } from './monitor.controller.js'
import { EndpointRuleRepository } from './endpoint-rule.repository.js'

/**
 * 接口监控（框架内置能力，非插件）：基于 api_access_logs 的对外发布接口聚合；
 * 接口目录 + 按应用维度端点启停（endpoint_rules，管理面/数据面分发控制器统一强制拦截）。
 */
@Module({
  controllers: [MonitorController],
  providers: [MonitorRepository, EndpointRuleRepository],
  exports: [MonitorRepository, EndpointRuleRepository],
})
export class MonitorModule {}
