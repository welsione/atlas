package cn.aibase.security;

import cn.aibase.common.ValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 安全设置服务：加载（DB 优先合并默认值）、更新（持久化）。
 */
@Slf4j
@Service
public class SecuritySettingsService {

    private final SecuritySettingsRepository repository;
    private volatile SecuritySettings cached;

    public SecuritySettingsService(SecuritySettingsRepository repository) {
        this.repository = repository;
    }

    /** 获取当前生效设置（首次加载 + DB 覆盖，懒初始化避免早于 schema 建表）。 */
    public SecuritySettings get() {
        if (cached == null) {
            synchronized (this) {
                if (cached == null) {
                    cached = load();
                }
            }
        }
        return cached;
    }

    /** 更新单项设置并持久化。 */
    public void update(String key, String value) {
        if (!new SecuritySettings().getValues().containsKey(key)) {
            throw new ValidationException("key", "未知设置项: " + key);
        }
        repository.save(key, value);
        cached = load();
        log.info("安全设置已更新：{}={}", key, value);
    }

    /** 设置项清单（含中文说明，管理页展示）。 */
    public List<SecuritySettings.SettingMeta> metas() {
        return List.of(
                new SecuritySettings.SettingMeta(SecuritySettings.KEY_ENABLED, "限流开关", "true/false", "是否启用下载/登录限流"),
                new SecuritySettings.SettingMeta(SecuritySettings.KEY_PER_IP_PER_MINUTE, "每 IP 每分钟", "次数", "同一 IP 每分钟最大下载次数"),
                new SecuritySettings.SettingMeta(SecuritySettings.KEY_PER_TOKEN_PER_MINUTE, "每链接每分钟", "次数", "同一下载链接（token）每分钟最大次数"),
                new SecuritySettings.SettingMeta(SecuritySettings.KEY_GLOBAL_PER_MINUTE, "全局每分钟", "次数", "全服务每分钟最大下载次数"),
                new SecuritySettings.SettingMeta(SecuritySettings.KEY_LOGIN_PER_MINUTE, "登录失败限流", "次数", "同一 IP 每分钟最大登录尝试"),
                new SecuritySettings.SettingMeta(SecuritySettings.KEY_AUTO_BAN_THRESHOLD, "自动封禁阈值", "次数", "窗口内触发限流次数达到该值自动加入黑名单"),
                new SecuritySettings.SettingMeta(SecuritySettings.KEY_AUTO_BAN_WINDOW_MINUTES, "自动封禁窗口", "分钟", "自动封禁统计的时间窗口"));
    }

    private SecuritySettings load() {
        SecuritySettings settings = new SecuritySettings();
        settings.getValues().putAll(repository.findAll());
        return settings;
    }
}
