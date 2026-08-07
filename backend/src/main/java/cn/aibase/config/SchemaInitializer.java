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
            log.info("数据库结构初始化完成（{} 条语句）", statements.size());
        } catch (Exception ex) {
            throw new IllegalStateException("数据库结构初始化失败", ex);
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
