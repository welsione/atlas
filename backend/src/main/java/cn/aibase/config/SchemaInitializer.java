package cn.aibase.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * 数据库结构初始化：执行 classpath:schema.sql（SQLite）。
 *
 * <p>SQLite 的 Flyway 支持属付费模块，社区版不可用；schema.sql 全部使用
 * {@code CREATE TABLE/INDEX IF NOT EXISTS} 幂等语句，每次启动执行安全。</p>
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class SchemaInitializer implements ApplicationRunner {

    private final JdbcTemplate jdbc;
    private final AIBaseProperties properties;

    @Override
    public void run(ApplicationArguments args) {
        try {
            // SQLite 不会自动创建数据目录
            java.io.File dataDir = new java.io.File(properties.getDataDir());
            if (!dataDir.isDirectory() && !dataDir.mkdirs()) {
                throw new IllegalStateException("创建数据目录失败: " + dataDir.getAbsolutePath());
            }
            ClassPathResource resource = new ClassPathResource("schema.sql");
            List<String> statements = parseStatements(resource);
            for (String statement : statements) {
                jdbc.execute(statement);
            }
            // 旧库增量迁移：SQLite 不支持 ADD COLUMN IF NOT EXISTS
            ensureColumn("model_files", "token", "TEXT NOT NULL DEFAULT ''");
            ensureColumn("model_files", "version", "INTEGER NOT NULL DEFAULT 1");
            ensureColumn("model_files", "content_hash", "TEXT NOT NULL DEFAULT ''");
            ensureColumn("model_files", "download_count", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn("download_logs", "bytes", "INTEGER NOT NULL DEFAULT 0");
            ensureIndex("idx_model_files_token",
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_model_files_token ON model_files(token)");
            ensureIndex("idx_upload_logs_file",
                    "CREATE INDEX IF NOT EXISTS idx_upload_logs_file ON upload_logs(file_id, uploaded_at)");
            ensureIndex("idx_upload_logs_ip",
                    "CREATE INDEX IF NOT EXISTS idx_upload_logs_ip ON upload_logs(ip, uploaded_at)");
            backfillTokens();
            backfillVersionAndHash();
            log.info("数据库结构初始化完成（{} 条语句）", statements.size());
        } catch (Exception ex) {
            throw new IllegalStateException("数据库结构初始化失败", ex);
        }
    }

    /** 存量回填：为历史条目生成固定下载 token（旧库升级场景）。 */
    private void backfillTokens() {
        java.security.SecureRandom random = new java.security.SecureRandom();
        List<Long> empty = jdbc.queryForList("SELECT id FROM model_files WHERE token = '' OR token IS NULL", Long.class);
        for (Long id : empty) {
            byte[] bytes = new byte[32];
            random.nextBytes(bytes);
            String token = java.util.HexFormat.of().formatHex(bytes);
            jdbc.update("UPDATE model_files SET token = ? WHERE id = ?", token, id);
        }
        if (!empty.isEmpty()) {
            log.info("已为 {} 个历史文件条目回填下载 token", empty.size());
        }
    }

    /** 存量回填：历史条目版本号置 1。 */
    private void backfillVersionAndHash() {
        int updated = jdbc.update("UPDATE model_files SET version = 1 WHERE version IS NULL OR version = 0");
        if (updated > 0) {
            log.info("已为 {} 个历史文件条目回填版本号", updated);
        }
    }

    /** 检查列是否存在，缺失则 ALTER TABLE 补列。 */
    private void ensureColumn(String table, String column, String definition) {
        List<String> columns = jdbc.query("PRAGMA table_info(" + table + ")", (rs, i) -> rs.getString("name"));
        if (columns.contains(column)) {
            return;
        }
        jdbc.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
        log.info("已为表 {} 补列 {}", table, column);
    }

    /** 检查索引是否存在（SQLite 无 IF NOT EXISTS 于 CREATE UNIQUE INDEX 时按名称查询）。 */
    private void ensureIndex(String index, String ddl) {
        try {
            jdbc.execute(ddl);
        } catch (Exception ex) {
            log.debug("索引 {} 已存在（{}）", index, ex.getMessage());
        }
    }

    /** 解析 schema.sql：跳过 -- 注释行，按分号切分为语句。 */
    private List<String> parseStatements(ClassPathResource resource) throws Exception {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("--")) {
                    continue;
                }
                current.append(line).append('\n');
                if (trimmed.endsWith(";")) {
                    statements.add(current.toString());
                    current.setLength(0);
                }
            }
        }
        if (!current.isEmpty()) {
            statements.add(current.toString());
        }
        return statements;
    }
}
