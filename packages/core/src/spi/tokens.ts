/**
 * SPI 门面 DI 令牌：以 Symbol 注入，避免 PluginService 静态 import 门面类
 * 引发 app.service → plugin.service → spi.facade → app.service 的运行时循环依赖。
 */

export const APP_FACADE = Symbol('APP_FACADE')
export const MONITOR_FACADE = Symbol('MONITOR_FACADE')
export const SECURITY_FACADE = Symbol('SECURITY_FACADE')
export const PLATFORM_FACADE = Symbol('PLATFORM_FACADE')
export const PLUGIN_SPI_REGISTRY = Symbol('PLUGIN_SPI_REGISTRY')