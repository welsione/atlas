import { Global, Module } from '@nestjs/common'
import { AppRepository } from './apps/app.repository.js'
import { AppService } from './apps/app.service.js'
import { AuthService } from './security/auth.service.js'
import { IpRuleRepository } from './security/ip-rule.repository.js'
import { AppTokenService } from './auth/app-token.service.js'
import { EnvelopeCrypto } from './datasets/envelope-crypto.js'
import { LogCleanupService } from './common/log-cleanup.service.js'
import { CONFIG } from './config.js'

/**
 * 全局共享服务（跨模块可见，避免模块循环依赖）：
 * 应用/凭证、管理认证、数据面令牌、信封加密、日志保留清理。
 */
@Global()
@Module({
  providers: [
    AppRepository,
    AppService,
    AuthService,
    IpRuleRepository,
    AppTokenService,
    LogCleanupService,
    {
      provide: EnvelopeCrypto,
      useFactory: (config: { encKey: string }) => new EnvelopeCrypto(config.encKey),
      inject: [CONFIG],
    },
  ],
  exports: [
    AppRepository,
    AppService,
    AuthService,
    IpRuleRepository,
    AppTokenService,
    EnvelopeCrypto,
  ],
})
export class SharedModule {}
