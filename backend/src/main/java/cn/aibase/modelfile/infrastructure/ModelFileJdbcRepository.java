package cn.aibase.modelfile.infrastructure;

import cn.aibase.common.ResourceNotFoundException;
import cn.aibase.modelfile.domain.ModelFile;
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

/**
 * 模型文件数据访问：JdbcTemplate + RowMapper（SQLite）。
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class ModelFileJdbcRepository {

    private static final String SELECT_COLUMNS = """
            id, name, category, description, kind, storage_root, files_json,
            total_size, file_count, created_at, updated_at
            """;

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    private final RowMapper<ModelFile> mapper = (rs, i) -> {
        ModelFile f = new ModelFile();
        f.setId(rs.getLong("id"));
        f.setName(rs.getString("name"));
        f.setCategory(rs.getString("category"));
        f.setDescription(rs.getString("description"));
        f.setKind(rs.getString("kind"));
        f.setStorageRoot(rs.getString("storage_root"));
        f.setFiles(readFiles(rs.getString("files_json")));
        f.setTotalSize(rs.getLong("total_size"));
        f.setFileCount(rs.getInt("file_count"));
        f.setCreatedAt(parseTs(rs.getString("created_at")));
        f.setUpdatedAt(parseTs(rs.getString("updated_at")));
        return f;
    };

    public List<ModelFile> findAll() {
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM model_files ORDER BY created_at DESC, id DESC", mapper);
    }

    public ModelFile findById(Long id) {
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM model_files WHERE id = ?", mapper, id)
                .stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("ModelFile", id));
    }

    public ModelFile insert(ModelFile f) {
        f.setId(jdbc.queryForObject(
                "INSERT INTO model_files (name, category, description, kind, storage_root, files_json, total_size, file_count, created_at, updated_at) " +
                        "VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id",
                Long.class,
                f.getName(), f.getCategory(), f.getDescription(), f.getKind(), f.getStorageRoot(),
                writeFiles(f.getFiles()), f.getTotalSize(), f.getFileCount(),
                formatTs(f.getCreatedAt()), formatTs(f.getUpdatedAt())));
        return f;
    }

    public void update(ModelFile f) {
        jdbc.update("""
                UPDATE model_files SET name=?, category=?, description=?, kind=?, storage_root=?,
                files_json=?, total_size=?, file_count=?, updated_at=? WHERE id=?
                """,
                f.getName(), f.getCategory(), f.getDescription(), f.getKind(), f.getStorageRoot(),
                writeFiles(f.getFiles()), f.getTotalSize(), f.getFileCount(),
                formatTs(f.getUpdatedAt()), f.getId());
    }

    public void delete(Long id) {
        jdbc.update("DELETE FROM model_files WHERE id = ?", id);
    }

    private List<ModelFile.FileEntry> readFiles(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception ex) {
            log.warn("解析 files_json 失败，返回空列表: {}", ex.getMessage());
            return List.of();
        }
    }

    private String writeFiles(List<ModelFile.FileEntry> files) {
        try {
            return objectMapper.writeValueAsString(files == null ? List.of() : files);
        } catch (Exception ex) {
            throw new IllegalStateException("序列化 files 失败", ex);
        }
    }

    private String formatTs(LocalDateTime ts) {
        return ts == null ? null : ts.format(TS);
    }

    private LocalDateTime parseTs(String ts) {
        return ts == null || ts.isBlank() ? null : LocalDateTime.parse(ts, TS);
    }
}
