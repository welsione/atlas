package cn.aibase.security;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

/**
 * 安全设置持久化：security_settings 表 key-value 读写。
 */
@Repository
@RequiredArgsConstructor
public class SecuritySettingsRepository {

    private final JdbcTemplate jdbc;

    public Map<String, String> findAll() {
        Map<String, String> map = new java.util.HashMap<>();
        jdbc.query("SELECT key, value FROM security_settings", rs -> {
            map.put(rs.getString("key"), rs.getString("value"));
        });
        return map;
    }

    public void save(String key, String value) {
        jdbc.update("INSERT INTO security_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                key, value);
    }
}
