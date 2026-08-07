package cn.aibase.prompt.infrastructure;

import cn.aibase.common.ResourceNotFoundException;
import cn.aibase.prompt.domain.Prompt;
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
 * 提示词数据访问：JdbcTemplate + RowMapper（SQLite）。
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class PromptJdbcRepository {

    private static final String SELECT_COLUMNS = """
            id, name, category, description, content, variables_json, version,
            enabled, sort_order, created_at, updated_at
            """;

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    private final RowMapper<Prompt> mapper = (rs, i) -> {
        Prompt p = new Prompt();
        p.setId(rs.getLong("id"));
        p.setName(rs.getString("name"));
        p.setCategory(rs.getString("category"));
        p.setDescription(rs.getString("description"));
        p.setContent(rs.getString("content"));
        p.setVariables(readVariables(rs.getString("variables_json")));
        p.setVersion(rs.getInt("version"));
        p.setEnabled(rs.getInt("enabled") == 1);
        p.setSortOrder(rs.getInt("sort_order"));
        p.setCreatedAt(parseTs(rs.getString("created_at")));
        p.setUpdatedAt(parseTs(rs.getString("updated_at")));
        return p;
    };

    public List<Prompt> findAll() {
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM prompts ORDER BY category, sort_order, id", mapper);
    }

    public List<String> findCategories() {
        return jdbc.query("SELECT DISTINCT category FROM prompts ORDER BY category", (rs, i) -> rs.getString(1));
    }

    public Prompt findById(Long id) {
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM prompts WHERE id = ?", mapper, id)
                .stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Prompt", id));
    }

    public boolean existsByName(String name) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM prompts WHERE name = ?", Integer.class, name);
        return count != null && count > 0;
    }

    public Prompt insert(Prompt p) {
        p.setId(jdbc.queryForObject(
                "INSERT INTO prompts (name, category, description, content, variables_json, version, enabled, sort_order, created_at, updated_at) " +
                        "VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id",
                Long.class,
                p.getName(), p.getCategory(), p.getDescription(), p.getContent(),
                writeVariables(p.getVariables()), p.getVersion(), bool(p.isEnabled()), p.getSortOrder(),
                formatTs(p.getCreatedAt()), formatTs(p.getUpdatedAt())));
        return p;
    }

    public void update(Prompt p) {
        jdbc.update("""
                UPDATE prompts SET name=?, category=?, description=?, content=?, variables_json=?,
                version=?, enabled=?, sort_order=?, updated_at=? WHERE id=?
                """,
                p.getName(), p.getCategory(), p.getDescription(), p.getContent(),
                writeVariables(p.getVariables()), p.getVersion(), bool(p.isEnabled()), p.getSortOrder(),
                formatTs(p.getUpdatedAt()), p.getId());
    }

    public void delete(Long id) {
        jdbc.update("DELETE FROM prompts WHERE id = ?", id);
        jdbc.update("DELETE FROM prompt_versions WHERE prompt_id = ?", id);
    }

    public void archiveVersion(Long promptId, int version, String content, LocalDateTime at) {
        jdbc.update("INSERT INTO prompt_versions (prompt_id, version, content, created_at) VALUES (?,?,?,?)",
                promptId, version, content, formatTs(at));
    }

    public List<Map<String, Object>> findVersionHistory(Long promptId) {
        return jdbc.queryForList(
                "SELECT version, content, created_at AS createdAt FROM prompt_versions WHERE prompt_id = ? ORDER BY version DESC",
                promptId);
    }

    private List<Prompt.PromptVariable> readVariables(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception ex) {
            log.warn("解析 variables_json 失败，返回空列表: {}", ex.getMessage());
            return List.of();
        }
    }

    private String writeVariables(List<Prompt.PromptVariable> variables) {
        try {
            return objectMapper.writeValueAsString(variables == null ? List.of() : variables);
        } catch (Exception ex) {
            throw new IllegalStateException("序列化 variables 失败", ex);
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
