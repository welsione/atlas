package cn.aibase.security;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 安全设置：限流阈值与自动封禁参数（security_settings 表持久化，DB 优先于默认值）。
 */
@Getter
public class SecuritySettings {

    /** 限流总开关。 */
    public static final String KEY_ENABLED = "rateLimitEnabled";
    /** 每 IP 每分钟下载次数上限。 */
    public static final String KEY_PER_IP_PER_MINUTE = "perIpPerMinute";
    /** 每 token 每分钟下载次数上限。 */
    public static final String KEY_PER_TOKEN_PER_MINUTE = "perTokenPerMinute";
    /** 全局每分钟下载次数上限。 */
    public static final String KEY_GLOBAL_PER_MINUTE = "globalPerMinute";
    /** 登录失败每 IP 每分钟上限。 */
    public static final String KEY_LOGIN_PER_MINUTE = "loginPerMinute";
    /** 自动封禁阈值：某 IP 在窗口内触发限流次数达到该值即自动封禁。 */
    public static final String KEY_AUTO_BAN_THRESHOLD = "autoBanThreshold";
    /** 自动封禁统计窗口（分钟）。 */
    public static final String KEY_AUTO_BAN_WINDOW_MINUTES = "autoBanWindowMinutes";

    private final Map<String, String> values = new LinkedHashMap<>();

    public SecuritySettings() {
        // 默认值（管理页未配置时生效）
        values.put(KEY_ENABLED, "true");
        values.put(KEY_PER_IP_PER_MINUTE, "60");
        values.put(KEY_PER_TOKEN_PER_MINUTE, "120");
        values.put(KEY_GLOBAL_PER_MINUTE, "600");
        values.put(KEY_LOGIN_PER_MINUTE, "10");
        values.put(KEY_AUTO_BAN_THRESHOLD, "10");
        values.put(KEY_AUTO_BAN_WINDOW_MINUTES, "60");
    }

    public void put(String key, String value) {
        values.put(key, value);
    }

    public boolean rateLimitEnabled() {
        return Boolean.parseBoolean(values.get(KEY_ENABLED));
    }

    public int perIpPerMinute() {
        return intValue(KEY_PER_IP_PER_MINUTE, 60);
    }

    public int perTokenPerMinute() {
        return intValue(KEY_PER_TOKEN_PER_MINUTE, 120);
    }

    public int globalPerMinute() {
        return intValue(KEY_GLOBAL_PER_MINUTE, 600);
    }

    public int loginPerMinute() {
        return intValue(KEY_LOGIN_PER_MINUTE, 10);
    }

    public int autoBanThreshold() {
        return intValue(KEY_AUTO_BAN_THRESHOLD, 10);
    }

    public int autoBanWindowMinutes() {
        return intValue(KEY_AUTO_BAN_WINDOW_MINUTES, 60);
    }

    private int intValue(String key, int fallback) {
        try {
            return Integer.parseInt(values.get(key));
        } catch (Exception ex) {
            return fallback;
        }
    }

    /** 设置项清单（管理页展示/编辑用，含说明）。 */
    public record SettingMeta(String key, String label, String value, String hint) {
    }
}
