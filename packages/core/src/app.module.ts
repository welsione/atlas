import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { DatabaseModule } from './db/database.module.js'
import { SharedModule } from './shared.module.js'
import { SecurityMiddleware } from './security/security.middleware.js'
import { AuthController } from './security/auth.controller.js'
import { AppController } from './apps/app.controller.js'
import { AppAuthController } from './auth/app-auth.controller.js'
import { PluginModule } from './plugins/plugin.module.js'
import { DatasetModule } from './datasets/dataset.module.js'
import { MonitorModule } from './monitor/monitor.module.js'

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot(), SharedModule, PluginModule, DatasetModule, MonitorModule],
  controllers: [AppController, AuthController, AppAuthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*')
  }
}
