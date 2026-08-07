package cn.aibase.provider.infrastructure;

import cn.aibase.common.ResourceNotFoundException;
import cn.aibase.provider.domain.Provider;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 供应商数据访问：JdbcTemplate + RowMapper（SQLite）。
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class ProviderJdbcRepository {

    private static final String SELECT_COLUMNS = """
            id, name, provider_type, api_key, base_url, icon, icon_color,
            models_json, default_model, max_tokens, timeout_seconds, extra_config,
            enabled, is_default, sort_order, created_at, updated_at
            """;

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    private final RowMapper<Provider> mapper = (rs, i) -> {
        Provider p = new Provider();
        p.setId(rs.getLong("id"));
        p.setName(rs.getString("name"));
        p.setProviderType(rs.getString("provider_type"));
        p.setApiKey(rs.getString("api_key"));
        p.setBaseUrl(rs.getString("base_url"));
        p.setIcon(rs.getString("icon"));
        p.setIconColor(rs.getString("icon_color"));
        p.setModels(readModels(rs.getString("models_json")));
        p.setDefaultModel(rs.getString("default_model"));
        p.setMaxTokens(rs.getInt("max_tokens"));
        p.setTimeoutSeconds(rs.getInt("timeout_seconds"));
        p.setExtraConfig(rs.getString("extra_config"));
        p.setEnabled(rs.getInt("enabled") == 1);
        p.setDefault(rs.getInt("is_default") == 1);
        p.setSortOrder(rs.getInt("sort_order"));
        p.setCreatedAt(parseTs(rs.getString("created_at")));
        p.setUpdatedAt(parseTs(rs.getString("updated_at")));
        return p;
    };

    public List<Provider> findAll() {
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM providers ORDER BY sort_order, id", mapper);
    }

    public List<Provider> findEnabled() {
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM providers WHERE enabled = 1 ORDER BY sort_order, id", mapper);
    }

    public Provider findById(Long id) {
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM providers WHERE id = ?", mapper, id)
                .stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Provider", id));
    }

    public boolean existsByName(String name) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM providers WHERE name = ?", Integer.class, name);
        return count != null && count > 0;
    }

    public Provider insert(Provider p) {
        p.setId(jdbc.queryForObject(
                "INSERT INTO providers (name, provider_type, api_key, base_url, icon, icon_color, models_json, " +
                        "default_model, max_tokens, timeout_seconds, extra_config, enabled, is_default, sort_order, created_at, updated_at) " +
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
                Long.class,
                p.getName(), p.getProviderType(), p.getApiKey(), p.getBaseUrl(), p.getIcon(), p.getIconColor(),
                writeModels(p.getModels()), p.getDefaultModel(), p.getMaxTokens(), p.getTimeoutSeconds(),
                p.getExtraConfig(), bool(p.isEnabled()), bool(p.isDefault()), p.getSortOrder(),
                formatTs(p.getCreatedAt()), formatTs(p.getUpdatedAt())));
        return p;
    }

    public void update(Provider p) {
        jdbc.update("""
                UPDATE providers SET name=?, provider_type=?, api_key=?, base_url=?, icon=?, icon_color=?,
                models_json=?, default_model=?, max_tokens=?, timeout_seconds=?, extra_config=?,
                enabled=?, is_default=?, sort_order=?, updated_at=? WHERE id=?
                """,
                p.getName(), p.getProviderType(), p.getApiKey(), p.getBaseUrl(), p.getIcon(), p.getIconColor(),
                writeModels(p.getModels()), p.getDefaultModel(), p.getMaxTokens(), p.getTimeoutSeconds(),
                p.getExtraConfig(), bool(p.isEnabled()), bool(p.isDefault()), p.getSortOrder(),
                formatTs(p.getUpdatedAt()), p.getId());
    }

    public void delete(Long id) {
        jdbc.update("DELETE FROM providers WHERE id = ?", id);
    }

    public void clearDefault() {
        jdbc.update("UPDATE providers SET is_default = 0 WHERE is_default = 1");
    }

    public Map<Long, String> findDefaultsByType() {
        return Map.of();
    }

    private List<Provider.ProviderModel> readModels(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception ex) {
            log.warn("解析 models_json 失败，返回空列表: {}", ex.getMessage());
            return List.of();
        }
    }

    private String writeModels(List<Provider.ProviderModel> models) {
        try {
            return objectMapper.writeValueAsString(models == null ? List.of() : models);
        } catch (Exception ex) {
            throw new IllegalStateException("序列化 models 失败", ex);
        }
    }

    private int bool(boolean value) {
        return value ? 1 : 0;
    }

    private String formatTs(LocalDateTime ts) {
        return ts == null ? null : ts.format(TS);
    }

    private LocalDateTime parseTs(String ts) {
        return ts == null || ts.isBlank() ? null : LocalDateTime.parse(ts, TS);
    }
}
