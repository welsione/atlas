package cn.aibase.security;

import cn.aibase.common.ValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * IP 安全服务：黑名单管理（手动/自动）、内存缓存、自动封禁协调。
 */
@Slf4j
@Service
public class IpRuleService {

    /** IPv4 / IPv6 简易校验。 */
    private static final Pattern IP_PATTERN = Pattern.compile(
            "^(([0-9]{1,3}\\.){3}[0-9]{1,3}|[0-9a-fA-F:]+)$");

    private final IpRuleRepository repository;
    private final SecuritySettingsService settingsService;
    private final RateLimiter rateLimiter;

    /** 黑名单内存缓存（首次访问懒加载，变更即时失效重载）。 */
    private volatile Set<String> blockedIps = Set.of();
    private volatile boolean loaded = false;

    public IpRuleService(IpRuleRepository repository, SecuritySettingsService settingsService,
                         RateLimiter rateLimiter) {
        this.repository = repository;
        this.settingsService = settingsService;
        this.rateLimiter = rateLimiter;
        // 延迟初始化：schema 建表（ApplicationRunner）早于本 bean 使用时再加载
    }

    public List<Map<String, Object>> list() {
        return repository.findAll();
    }

    /** 手动添加黑名单。 */
    public void block(String ip, String reason) {
        validateIp(ip);
        if (repository.exists(ip)) {
            throw new ValidationException("ip", "该 IP 已在黑名单中");
        }
        repository.insert(ip, reason);
        reload();
        log.warn("手动封禁 IP：{}（{}）", ip, reason);
    }

    /** 解封。 */
    public void unblock(String ip) {
        repository.deleteByIp(ip);
        reload();
        log.info("解封 IP：{}", ip);
    }

    public boolean isBlocked(String ip) {
        if (!loaded) {
            reload();
        }
        return blockedIps.contains(ip);
    }

    /**
     * 自动封禁：触发限流的 IP 在统计窗口内累计次数达到阈值时加入黑名单。
     */
    public void maybeAutoBan(String ip) {
        SecuritySettings settings = settingsService.get();
        int threshold = settings.autoBanThreshold();
        int windowMinutes = settings.autoBanWindowMinutes();
        // 简化统计：固定窗口计数以 1 分钟为粒度，聚合窗口按小时折算
        int hits = rateLimiter.bannedHitsInWindow(ip);
        if (hits >= threshold && !isBlocked(ip)) {
            repository.insertAutoBan(ip, "自动封禁：限流窗口内触发 " + hits + " 次（阈值 " + threshold + "）");
            reload();
            log.error("IP 自动封禁：{}（窗口 {} 分钟内触发限流 {} 次）", ip, windowMinutes, hits);
        }
    }

    public void reload() {
        blockedIps = repository.findAllIps();
        loaded = true;
    }

    private void validateIp(String ip) {
        if (ip == null || ip.isBlank() || !IP_PATTERN.matcher(ip.trim()).matches()) {
            throw new ValidationException("ip", "非法 IP 地址: " + ip);
        }
    }
}
