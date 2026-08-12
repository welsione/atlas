import { Inject, Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { PlatformEventName, PlatformEventPayload } from '@atlas/types'

/**
 * 平台类型化事件适配器：基于 @nestjs/event-emitter（EventEmitter2）的薄封装，
 * 为 SPI 提供类型安全的 on/off/emit（事件名 + 载荷类型由 PlatformEventMap 约束）。
 * 订阅/发射机制（pub-sub、错误隔离、通配符）全部由成熟库 EventEmitter2 承担，此处仅做类型映射。
 */
@Injectable()
export class PlatformEventEmitter {
  // 显式 @Inject：tsx（esbuild）不发射 design:paramtypes 元数据，类 token 注入需显式声明
  constructor(@Inject(EventEmitter2) private readonly emitter: EventEmitter2) {}

  /** 发射平台生命周期事件（fire-and-forget，异步监听器不阻塞发射方）。 */
  emit<N extends PlatformEventName>(name: N, payload: PlatformEventPayload<N>): void {
    this.emitter.emit(name, payload)
  }

  /** 订阅；返回退订函数。 */
  on<N extends PlatformEventName>(
    name: N,
    handler: (payload: PlatformEventPayload<N>) => void | Promise<void>,
  ): () => void {
    this.emitter.on(name, handler as (...args: unknown[]) => void)
    return () => this.emitter.off(name, handler as (...args: unknown[]) => void)
  }

  off<N extends PlatformEventName>(
    name: N,
    handler: (payload: PlatformEventPayload<N>) => void | Promise<void>,
  ): void {
    this.emitter.off(name, handler as (...args: unknown[]) => void)
  }
}