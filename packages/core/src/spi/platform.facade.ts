import { Inject, Injectable } from '@nestjs/common'
import type { PluginPlatform } from '@atlas/types'
import { CONFIG, platformVersion, type AtlasConfig } from '../config.js'

/** env.platform() 门面：平台版本、安全子集配置、元信息。 */
@Injectable()
export class PlatformFacade implements PluginPlatform {
  /** 平台版本（读 monorepo 根 package.json，随发布自动同步）。 */
  readonly version = platformVersion()

  constructor(@Inject(CONFIG) private readonly atlasConfig: AtlasConfig) {}

  /** 平台安全子集配置（不含任何密钥）。 */
  config(): Record<string, unknown> {
    return {
      pluginScanIntervalMs: this.atlasConfig.pluginScanIntervalMs,
      datasetRefreshIntervalMs: this.atlasConfig.datasetRefreshIntervalMs,
      keepLogDays: this.atlasConfig.keepLogDays,
      trustProxy: this.atlasConfig.trustProxy,
    }
  }

  meta(): { platform: string; version: string; authEnabled: boolean; pluginsDir: string } {
    return {
      platform: 'atlas',
      version: this.version,
      authEnabled: this.atlasConfig.authEnabled,
      pluginsDir: this.atlasConfig.pluginsDir,
    }
  }
}