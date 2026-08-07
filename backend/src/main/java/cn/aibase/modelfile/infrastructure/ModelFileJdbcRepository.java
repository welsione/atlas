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
            id, name, category, description, kind, storage_root, token, files_json,
            total_size, file_count, version, content_hash, download_count, created_at, updated_at
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
        f.setToken(rs.getString("token"));
        f.setFiles(readFiles(rs.getString("files_json")));
        f.setTotalSize(rs.getLong("total_size"));
        f.setFileCount(rs.getInt("file_count"));
        f.setVersion(rs.getInt("version"));
        f.setContentHash(rs.getString("content_hash"));
        f.setDownloadCount(rs.getLong("download_count"));
        f.setCreatedAt(parseTs(rs.getString("created_at")));
        f.setUpdatedAt(parseTs(rs.getString("updated_at")));
        return f;
    };

    public List<ModelFile> findAll() {
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM model_files ORDER BY created_at DESC, id DESC", mapper);
    }

    public ModelFile findByToken(String token) {
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM model_files WHERE token = ?", mapper, token)
                .stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("ModelFile", token));
    }

    public ModelFile findById(Long id) {
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM model_files WHERE id = ?", mapper, id)
                .stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("ModelFile", id));
    }

    public ModelFile insert(ModelFile f) {
        f.setId(jdbc.queryForObject(
                "INSERT INTO model_files (name, category, description, kind, storage_root, token, files_json, total_size, file_count, version, content_hash, download_count, created_at, updated_at) " +
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
                Long.class,
                f.getName(), f.getCategory(), f.getDescription(), f.getKind(), f.getStorageRoot(), f.getToken(),
                writeFiles(f.getFiles()), f.getTotalSize(), f.getFileCount(),
                f.getVersion(), f.getContentHash(), f.getDownloadCount(),
                formatTs(f.getCreatedAt()), formatTs(f.getUpdatedAt())));
        return f;
    }

    public void update(ModelFile f) {
        jdbc.update("""
                UPDATE model_files SET name=?, category=?, description=?, kind=?, storage_root=?,
                files_json=?, total_size=?, file_count=?, version=?, content_hash=?, updated_at=? WHERE id=?
                """,
                f.getName(), f.getCategory(), f.getDescription(), f.getKind(), f.getStorageRoot(),
                writeFiles(f.getFiles()), f.getTotalSize(), f.getFileCount(),
                f.getVersion(), f.getContentHash(),
                formatTs(f.getUpdatedAt()), f.getId());
    }

    public void delete(Long id) {
        jdbc.update("DELETE FROM model_files WHERE id = ?", id);
    }

    /** 下载计数 +1。 */
    public void incrementDownloadCount(Long id) {
        jdbc.update("UPDATE model_files SET download_count = download_count + 1 WHERE id = ?", id);
    }

    /** 插入一条下载日志（含字节数）。 */
    public void insertDownloadLog(Long fileId, String ip, String userAgent, long bytes, LocalDateTime at) {
        jdbc.update("INSERT INTO download_logs (file_id, ip, user_agent, bytes, downloaded_at) VALUES (?,?,?,?,?)",
                fileId, ip, userAgent, bytes, formatTs(at));
    }

    /** 插入一条上传日志（含字节数）。 */
    public void insertUploadLog(Long fileId, String ip, String userAgent, long bytes, LocalDateTime at) {
        jdbc.update("INSERT INTO upload_logs (file_id, ip, user_agent, bytes, uploaded_at) VALUES (?,?,?,?,?)",
                fileId, ip, userAgent, bytes, formatTs(at));
    }

    /** 查询下载日志（按时间倒序）。 */
    public List<java.util.Map<String, Object>> findDownloadLogs(Long fileId, int limit) {
        return jdbc.queryForList(
                "SELECT ip, user_agent AS userAgent, downloaded_at AS downloadedAt, bytes FROM download_logs WHERE file_id = ? ORDER BY downloaded_at DESC LIMIT ?",
                fileId, limit);
    }

    /** 传输流量窗口聚合（upload/download 通用表）。 */
    public List<java.util.Map<String, Object>> transferSummary(String table, String tsColumn, String sinceTs) {
        return jdbc.queryForList(
                "SELECT COALESCE(SUM(bytes),0) AS totalBytes, COUNT(*) AS totalCount FROM " + table + " WHERE " + tsColumn + " >= ?",
                sinceTs);
    }

    /** 传输流量时间序列（bucket：小时或天）。 */
    public List<java.util.Map<String, Object>> transferSeries(String table, String tsColumn, String sinceTs, int bucketLen) {
        return jdbc.queryForList(
                "SELECT substr(" + tsColumn + ", 1, " + bucketLen + ") AS bucket, COALESCE(SUM(bytes),0) AS totalBytes, COUNT(*) AS totalCount " +
                        "FROM " + table + " WHERE " + tsColumn + " >= ? GROUP BY bucket ORDER BY bucket",
                sinceTs);
    }

    /** Top 传输条目（按次数/流量）。 */
    public List<java.util.Map<String, Object>> transferTopFiles(String table, String tsColumn, String sinceTs, int limit) {
        return jdbc.queryForList(
                "SELECT l.file_id AS fileId, f.name AS name, COUNT(*) AS count, COALESCE(SUM(l.bytes),0) AS totalBytes " +
                        "FROM " + table + " l JOIN model_files f ON f.id = l.file_id WHERE " + tsColumn + " >= ? " +
                        "GROUP BY l.file_id ORDER BY count DESC LIMIT ?",
                sinceTs, limit);
    }

    /** Top 传输 IP（排除黑名单 IP——禁止被禁流量进入排名）。 */
    public List<java.util.Map<String, Object>> transferTopIps(String table, String tsColumn, String sinceTs, int limit) {
        return jdbc.queryForList(
                "SELECT ip, COUNT(*) AS count, COALESCE(SUM(bytes),0) AS totalBytes FROM " + table + " WHERE " + tsColumn + " >= ? " +
                        "AND ip NOT IN (SELECT ip FROM ip_rules) GROUP BY ip ORDER BY count DESC LIMIT ?",
                sinceTs, limit);
    }

    /** 条目统计（控制台）。 */
    public java.util.Map<String, Object> fileSummary() {
        return jdbc.queryForMap(
                "SELECT COUNT(*) AS entryCount, COALESCE(SUM(total_size),0) AS totalBytes FROM model_files");
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
