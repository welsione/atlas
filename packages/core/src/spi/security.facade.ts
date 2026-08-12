import { Injectable, Inject } from '@nestjs/common'
import type { PluginSecurity } from '@atlas/types'
import { IpRuleRepository } from '../security/ip-rule.repository.js'
import { ExtensionRegistry } from './extension.registry.js'

/** env.security() 门面：安全扩展点（公开前缀注册 / IP 规则管理）。 */
@Injectable()
export class SecurityFacade implements PluginSecurity {
  constructor(
    @Inject(IpRuleRepository) private readonly ipRules: IpRuleRepository,
    @Inject(ExtensionRegistry) private readonly extensions: ExtensionRegistry,
  ) {}

  /** 注册公开 URL 前缀（SecurityMiddleware 放行），如 '/api/health/'. */
  publicUrl(prefix: string): void {
    this.extensions.addPublicUrl(prefix)
  }

  blockIp(ip: string): void {
    this.ipRules.block(ip, 'plugin', 'BLOCK')
  }

  unblockIp(ip: string): void {
    this.ipRules.unblock(ip)
  }

  isBlocked(ip: string): boolean {
    return this.ipRules.isBlocked(ip)
  }
}