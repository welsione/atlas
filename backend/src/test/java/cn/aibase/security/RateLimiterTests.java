package cn.aibase.security;

import cn.aibase.modelfile.application.ModelFileService;
import cn.aibase.modelfile.domain.ModelFile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 限流与自动封禁测试。
 */
@SpringBootTest(classes = cn.aibase.AIBaseApplication.class)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:sqlite:./target/test-ratelimit.db",
        "spring.datasource.driver-class-name=org.sqlite.JDBC",
        "aibase.data-dir=./target/test-ratelimit-data",
})
class RateLimiterTests {

    @Autowired
    private RateLimiter rateLimiter;

    @Autowired
    private ModelFileService fileService;

    @Autowired
    private IpRuleService ipRuleService;

    @Autowired
    private SecuritySettingsService settingsService;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clean() {
        for (ModelFile f : fileService.list()) {
            fileService.delete(f.getId());
        }
        jdbc.update("DELETE FROM model_files");
        jdbc.update("DELETE FROM download_logs");
        jdbc.update("DELETE FROM upload_logs");
        jdbc.update("DELETE FROM ip_rules");
        jdbc.update("DELETE FROM security_settings");
        ipRuleService.reload();
    }

    @Test
    void perIpLimitBlocksAfterThreshold() {
        int limit = settingsService.get().perIpPerMinute();
        for (int i = 0; i < limit; i++) {
            assertTrue(rateLimiter.allowDownloadIp("1.1.1.1"), "第 " + (i + 1) + " 次应放行");
        }
        assertFalse(rateLimiter.allowDownloadIp("1.1.1.1"), "超限应拒绝");
        // 其他 IP 不受影响
        assertTrue(rateLimiter.allowDownloadIp("2.2.2.2"));
    }

    @Test
    void perTokenLimitIndependent() {
        int limit = settingsService.get().perTokenPerMinute();
        for (int i = 0; i < limit; i++) {
            rateLimiter.allowDownloadToken("token-a");
        }
        assertFalse(rateLimiter.allowDownloadToken("token-a"));
        assertTrue(rateLimiter.allowDownloadToken("token-b"));
    }

    @Test
    void loginAttemptsLimited() {
        int limit = settingsService.get().loginPerMinute();
        for (int i = 0; i < limit; i++) {
            assertTrue(rateLimiter.allowLoginAttempt("9.9.9.9"));
        }
        assertFalse(rateLimiter.allowLoginAttempt("9.9.9.9"));
    }

    @Test
    void autoBanTriggersAfterThresholdHits() {
        // 阈值调低为 2，窗口 60 分钟
        settingsService.update(SecuritySettings.KEY_AUTO_BAN_THRESHOLD, "2");
        // 触发 2 次限流命中（模拟被限流的 IP）
        rateLimiter.recordBanHit("203.0.113.55");
        ipRuleService.maybeAutoBan("203.0.113.55");
        assertFalse(ipRuleService.isBlocked("203.0.113.55"), "未达阈值不应封禁");

        rateLimiter.recordBanHit("203.0.113.55");
        ipRuleService.maybeAutoBan("203.0.113.55");
        assertTrue(ipRuleService.isBlocked("203.0.113.55"), "达到阈值应自动封禁");
    }

    @Test
    void disabledRateLimitAllowsAll() {
        settingsService.update(SecuritySettings.KEY_ENABLED, "false");
        for (int i = 0; i < 500; i++) {
            assertTrue(rateLimiter.allowDownloadIp("1.1.1.1"));
        }
    }
}
