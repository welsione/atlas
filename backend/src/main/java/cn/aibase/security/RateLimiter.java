package cn.aibase.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 多维度固定窗口限流器：每 IP / 每 token / 全局 / 登录失败。
 *
 * <p>阈值来自 {@link SecuritySettingsService}（DB 持久化，管理页可配）；
 * 固定 1 分钟窗口计数，超过返回受限；每 30 秒清理过期窗口防止内存膨胀。</p>
 */
@Slf4j
@Component
public class RateLimiter {

    private final SecuritySettingsService settingsService;
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    public RateLimiter(SecuritySettingsService settingsService) {
        this.settingsService = settingsService;
    }

    /** 下载限流：IP 维度。 */
    public boolean allowDownloadIp(String ip) {
        if (!settingsService.get().rateLimitEnabled()) {
            return true;
        }
        return allow("dl:ip:" + ip, settingsService.get().perIpPerMinute());
    }

    /** 下载限流：token 维度。 */
    public boolean allowDownloadToken(String token) {
        if (!settingsService.get().rateLimitEnabled()) {
            return true;
        }
        return allow("dl:token:" + token, settingsService.get().perTokenPerMinute());
    }

    /** 下载限流：全局维度。 */
    public boolean allowDownloadGlobal() {
        if (!settingsService.get().rateLimitEnabled()) {
            return true;
        }
        return allow("dl:global", settingsService.get().globalPerMinute());
    }

    /** 登录失败限流（IP 维度）。 */
    public boolean allowLoginAttempt(String ip) {
        return allow("login:" + ip, settingsService.get().loginPerMinute());
    }

    /**
     * 统计某 IP 在自动封禁窗口内的限流触发次数（固定窗口计数）。
     */
    public int bannedHitsInWindow(String ip) {
        WindowCounter counter = counters.get("dl:ip:" + ip);
        if (counter == null) {
            return 0;
        }
        return counter.bannedHits;
    }

    /** 记录一次受限命中（供自动封禁统计）。 */
    public void recordBanHit(String ip) {
        counters.computeIfAbsent("dl:ip:" + ip, k -> new WindowCounter()).bannedHits++;
    }

    private boolean allow(String key, int limit) {
        long now = System.currentTimeMillis();
        WindowCounter counter = counters.computeIfAbsent(key, k -> new WindowCounter());
        synchronized (counter) {
            if (now - counter.windowStart >= 60_000) {
                counter.windowStart = now;
                counter.count = 0;
            }
            counter.count++;
            return counter.count <= limit;
        }
    }

    /** 每 30 秒清理过期窗口（超过 2 分钟未活动的计数）。 */
    @Scheduled(fixedDelay = 30_000)
    public void cleanup() {
        long now = System.currentTimeMillis();
        counters.entrySet().removeIf(e -> now - e.getValue().windowStart > 120_000);
    }

    /** 固定窗口计数器：窗口内请求计数 + 受限命中次数。 */
    private static class WindowCounter {
        long windowStart = System.currentTimeMillis();
        int count;
        int bannedHits;
    }
}
