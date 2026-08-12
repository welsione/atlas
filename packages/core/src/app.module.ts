import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { DatabaseModule } from './db/database.module.js'
import { SharedModule } from './shared.module.js'
import { SecurityMiddleware } from './security/security.middleware.js'
import { AppExceptionFilter } from './common/exception-filter.js'
import { AuthController } from './security/auth.controller.js'
import { AppController } from './apps/app.controller.js'
import { AppAuthController } from './auth/app-auth.controller.js'
import { PluginModule } from './plugins/plugin.module.js'
import { DatasetModule } from './datasets/dataset.module.js'
import { MonitorModule } from './monitor/monitor.module.js'
import { SpiModule } from './spi/spi.module.js'

@Module({
  imports: [EventEmitterModule.forRoot(), DatabaseModule, ScheduleModule.forRoot(), SharedModule, SpiModule, PluginModule, DatasetModule, MonitorModule],
  controllers: [AppController, AuthController, AppAuthController],
  providers: [
    // 全局异常过滤器：统一 {code,message,data} 信封 + 隐藏内部错误细节
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*')
  }
}
