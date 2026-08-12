import { Injectable, Inject } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import type { App, CreateAppResult, PluginApps } from '@atlas/types'
import { AppService } from '../apps/app.service.js'

/**
 * env.apps() 门面：应用空间读取/创建。
 * AppService 通过 ModuleRef 惰性解析（打破 SpiModule(AppFacade) -> AppService -> PluginService -> SpiModule(PlatformEventEmitter)
 * 的构造期循环依赖），运行时经 Nest DI 解析为真实实例。
 */
@Injectable()
export class AppFacade implements PluginApps {
  private _appService: AppService | null = null

  constructor(@Inject(ModuleRef) private readonly moduleRef: ModuleRef) {}

  private get appService(): AppService {
    const svc = this._appService
    if (svc) return svc
    const resolved = this.moduleRef.get(AppService, { strict: false })
    this._appService = resolved
    return resolved
  }

  list(): App[] {
    return this.appService.list()
  }

  get(id: number | string): App {
    const numeric = typeof id === 'string' ? Number(id) : id
    return this.appService.get(numeric)
  }

  create(name: string, description = '', pluginTypes?: string[]): CreateAppResult {
    return this.appService.create(name, description, pluginTypes)
  }
}