import { Global, Module } from '@nestjs/common'
import { PlatformEventEmitter } from './platform-event-emitter.js'
import { ExtensionRegistry } from './extension.registry.js'
import { AppFacade } from './app.facade.js'
import { MonitorFacade } from './monitor.facade.js'
import { SecurityFacade } from './security.facade.js'
import { PlatformFacade } from './platform.facade.js'
import { SchemaBootstrapService } from './schema-bootstrap.service.js'
import { PluginSpiRegistry } from './plugin-spi.registry.js'
import { APP_FACADE, MONITOR_FACADE, SECURITY_FACADE, PLATFORM_FACADE, PLUGIN_SPI_REGISTRY } from './tokens.js'
import { MonitorModule } from '../monitor/monitor.module.js'

/**
 * SPI 模块（全局）：承载平台核心功能向插件开放的可扩展点（服务提供者接口）。
 * - PlatformEventEmitter：类型化事件适配器（基于 @nestjs/event-emitter）。
 * - ExtensionRegistry：插件声明式扩展点 + 运行时动态注册聚合。
 * - App/Monitor/Security/Platform 门面：插件经 env.apps()/env.monitor()/env.security()/env.platform() 访问。
 *   以 Symbol 令牌 provide，避免 PluginService 静态 import 门面类造成循环依赖。
 * 依赖：仅 MonitorModule（取 MonitorRepository；无环）。核心服务经 @Global 直接注入，不新增 forwardRef。
 */
@Global()
@Module({
  imports: [MonitorModule],
  providers: [
    PlatformEventEmitter,
    ExtensionRegistry,
    SchemaBootstrapService,
    PluginSpiRegistry,
    { provide: APP_FACADE, useClass: AppFacade },
    { provide: MONITOR_FACADE, useClass: MonitorFacade },
    { provide: SECURITY_FACADE, useClass: SecurityFacade },
    { provide: PLATFORM_FACADE, useClass: PlatformFacade },
    { provide: PLUGIN_SPI_REGISTRY, useExisting: PluginSpiRegistry },
  ],
  exports: [
    PlatformEventEmitter,
    ExtensionRegistry,
    SchemaBootstrapService,
    APP_FACADE,
    MONITOR_FACADE,
    SECURITY_FACADE,
    PLATFORM_FACADE,
    PLUGIN_SPI_REGISTRY,
  ],
})
export class SpiModule {}