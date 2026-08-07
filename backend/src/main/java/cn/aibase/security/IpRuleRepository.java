package cn.aibase.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * IP 规则数据访问：黑名单（手动 BLOCK / 自动封禁 AUTO_BLOCK）。
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class IpRuleRepository {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JdbcTemplate jdbc;

    public List<Map<String, Object>> findAll() {
        return jdbc.queryForList(
                "SELECT id, ip, type, reason, created_at AS createdAt FROM ip_rules ORDER BY created_at DESC");
    }

    public Set<String> findAllIps() {
        return new HashSet<>(jdbc.queryForList("SELECT ip FROM ip_rules", String.class));
    }

    public boolean exists(String ip) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM ip_rules WHERE ip = ?", Integer.class, ip);
        return count != null && count > 0;
    }

    /** 手动添加黑名单。 */
    public void insert(String ip, String reason) {
        jdbc.update("INSERT INTO ip_rules (ip, type, reason, created_at) VALUES (?,?,?,?)",
                ip, "BLOCK", reason == null ? "" : reason, LocalDateTime.now().format(TS));
    }

    /** 自动封禁（type=AUTO_BLOCK）。 */
    public void insertAutoBan(String ip, String reason) {
        jdbc.update("INSERT INTO ip_rules (ip, type, reason, created_at) VALUES (?,?,?,?)",
                ip, "AUTO_BLOCK", reason == null ? "" : reason, LocalDateTime.now().format(TS));
    }

    public void deleteByIp(String ip) {
        jdbc.update("DELETE FROM ip_rules WHERE ip = ?", ip);
    }
}
