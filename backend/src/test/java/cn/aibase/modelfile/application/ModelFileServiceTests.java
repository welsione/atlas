package cn.aibase.modelfile.application;

import cn.aibase.common.ResourceNotFoundException;
import cn.aibase.common.ValidationException;
import cn.aibase.modelfile.domain.ModelFile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 模型文件服务测试（临时 SQLite + 临时数据目录）。
 */
@SpringBootTest(classes = cn.aibase.AIBaseApplication.class)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:sqlite:./target/test-modelfiles.db",
        "spring.datasource.driver-class-name=org.sqlite.JDBC",
        "aibase.data-dir=./target/test-modelfiles-data",
})
class ModelFileServiceTests {

    @Autowired
    private ModelFileService service;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clean() throws Exception {
        // 先删磁盘与记录（delete 需要表内有数据才能定位条目），再清表兜底；
        // 最后整体清理数据目录，避免 DB 重建后 id 重置撞上磁盘残留
        for (ModelFile f : service.list()) {
            service.delete(f.getId());
        }
        jdbc.update("DELETE FROM model_files");
        jdbc.update("DELETE FROM download_logs");
        jdbc.update("DELETE FROM upload_logs");
        java.nio.file.Path dataRoot = java.nio.file.Path.of("./target/test-modelfiles-data");
        if (java.nio.file.Files.exists(dataRoot)) {
            try (var walk = java.nio.file.Files.walk(dataRoot)) {
                walk.sorted(java.util.Comparator.reverseOrder())
                        .forEach(p -> {
                            try {
                                java.nio.file.Files.deleteIfExists(p);
                            } catch (Exception ignored) {
                            }
                        });
            }
        }
    }

    private MultipartFile file(String name, String content) {
        return new MockMultipartFile("files", name, "application/octet-stream", content.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void uploadSingleFileStoresEntry() throws Exception {
        ModelFile entry = service.upload("asr", "测试模型", List.of(file("model.onnx", "binary-data")), null);
        assertTrue(entry.getId() > 0);
        assertEquals("FILE", entry.getKind());
        assertEquals(1, entry.getFileCount());
        assertEquals(11, entry.getTotalSize());

        Path stored = Path.of("./target/test-modelfiles-data/model-files/" + entry.getId(), "model.onnx");
        assertTrue(Files.exists(stored));
        assertEquals("binary-data", Files.readString(stored));
    }

    @Test
    void uploadDirectoryPreservesRelPath() throws Exception {
        ModelFile entry = service.upload("asr", "目录模型", List.of(
                file("sherpa-model/model.onnx", "onnx-data"),
                file("sherpa-model/tokens.txt", "tokens")), null);
        assertEquals("DIRECTORY", entry.getKind());
        assertEquals("sherpa-model", entry.getName());
        assertEquals(2, entry.getFileCount());
        assertTrue(entry.getFiles().stream().anyMatch(f -> f.path().equals("sherpa-model/model.onnx")));
    }

    @Test
    void zipUploadIsExtractedToDirectory() throws Exception {
        ByteArrayOutputStream zipBytes = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(zipBytes)) {
            zos.putNextEntry(new ZipEntry("asr-model/model.onnx"));
            zos.write("onnx".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
            zos.putNextEntry(new ZipEntry("asr-model/config.json"));
            zos.write("{}".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        MultipartFile zip = new MockMultipartFile("files", "asr-model.zip", "application/zip", zipBytes.toByteArray());
        ModelFile entry = service.upload("asr", "zip 模型", List.of(zip), null);
        assertEquals("DIRECTORY", entry.getKind());
        assertEquals("asr-model", entry.getName());
        assertEquals(2, entry.getFileCount());
    }

    @Test
    void downloadSingleFileReturnsContent() throws Exception {
        ModelFile entry = service.upload("asr", "", List.of(file("a.bin", "hello")), null);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        service.download(entry.getId(), out);
        assertEquals("hello", out.toString(StandardCharsets.UTF_8));
    }

    @Test
    void downloadDirectoryBuildsZip() throws Exception {
        ModelFile entry = service.upload("asr", "", List.of(
                file("m/f1.txt", "one"),
                file("m/f2.txt", "two")), null);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        service.download(entry.getId(), out);
        assertTrue(out.size() > 0);
        assertEquals("m.zip", service.downloadFileName(entry));
    }

    @Test
    void pathTraversalRejected() {
        assertThrows(ValidationException.class,
                () -> service.upload("asr", "", List.of(file("../evil.txt", "x")), null));
        assertThrows(ValidationException.class,
                () -> service.upload("asr", "", List.of(file("a/../../evil.txt", "x")), null));
    }

    @Test
    void zipPathTraversalRejected() throws Exception {
        ByteArrayOutputStream zipBytes = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(zipBytes)) {
            zos.putNextEntry(new ZipEntry("../evil.txt"));
            zos.write("x".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        MultipartFile zip = new MockMultipartFile("files", "bad.zip", "application/zip", zipBytes.toByteArray());
        assertThrows(ValidationException.class, () -> service.upload("asr", "", List.of(zip), null));
    }

    @Test
    void deleteRemovesEntryAndDisk() throws Exception {
        ModelFile entry = service.upload("asr", "", List.of(file("m.bin", "data")), null);
        Path stored = Path.of("./target/test-modelfiles-data/model-files/" + entry.getId());
        assertTrue(Files.exists(stored));
        service.delete(entry.getId());
        assertFalse(Files.exists(stored));
        assertTrue(service.list().isEmpty());
    }

    @Test
    void uploadGeneratesRandomFixedToken() {
        ModelFile a = service.upload("asr", "", List.of(file("a.bin", "1")), null);
        ModelFile b = service.upload("asr", "", List.of(file("b.bin", "2")), null);
        assertEquals(64, a.getToken().length());
        assertFalse(a.getToken().equals(b.getToken()));
        assertEquals(a.getToken(), service.get(a.getId()).getToken());
        assertEquals(a.getToken(), service.getByToken(a.getToken()).getToken());
    }

    @Test
    void uploadSetsVersionOneAndStableHash() {
        ModelFile a = service.upload("asr", "", List.of(file("a.bin", "content-v1")), null);
        assertEquals(1, a.getVersion());
        assertTrue(a.getContentHash().length() == 64);
        // 同一内容哈希稳定
        ModelFile b = service.upload("asr", "", List.of(file("b.bin", "content-v1")), null);
        assertEquals(a.getContentHash(), b.getContentHash());
    }

    @Test
    void updateKeepsTokenAndBumpsVersion() throws Exception {
        ModelFile original = service.upload("asr", "", List.of(file("m.bin", "v1-content")), null);
        String token = original.getToken();
        assertEquals(1, original.getVersion());

        ModelFile updated = service.upload("asr", "", List.of(file("m.bin", "v2-content-longer")), token);
        assertEquals(token, updated.getToken());
        assertEquals(2, updated.getVersion());
        assertNotEquals(original.getContentHash(), updated.getContentHash());

        // 磁盘内容已替换
        Path stored = Path.of("./target/test-modelfiles-data/model-files/" + updated.getId(), "m.bin");
        assertEquals("v2-content-longer", Files.readString(stored));
        // 更新模式不产生新条目
        assertEquals(1, service.list().size());
    }

    @Test
    void metaReturnsVersionAndHash() {
        ModelFile entry = service.upload("asr", "", List.of(file("a.bin", "meta-data")), null);
        ModelFileService.ModelMeta meta = service.meta(entry.getToken());
        assertEquals(1, meta.version());
        assertEquals(entry.getContentHash(), meta.contentHash());
        assertEquals(9, meta.totalSize());
    }

    @Test
    void recordDownloadLogsAndCounts() {
        ModelFile entry = service.upload("asr", "", List.of(file("a.bin", "data")), null);
        assertTrue(service.recordDownload(entry, "1.2.3.4", "test-client"));
        assertTrue(service.recordDownload(entry, "1.2.3.4", "test-client"));
        assertEquals(2, service.get(entry.getId()).getDownloadCount());
        assertEquals(2, service.downloadLogs(entry.getId(), 100).size());
    }

    @Test
    void invalidTokenReturns404() {
        assertThrows(ResourceNotFoundException.class,
                () -> service.getByToken("0000000000000000000000000000000000000000000000000000000000000000"));
    }

    @Test
    void rateLimitBlocksExcessiveDownloads() {
        ModelFile entry = service.upload("asr", "", List.of(file("a.bin", "data")), null);
        boolean blocked = false;
        for (int i = 0; i < 70; i++) {
            if (!service.recordDownload(entry, "9.9.9.9", "bot")) {
                blocked = true;
                break;
            }
        }
        assertTrue(blocked, "第 61 次下载应被限流");
    }
}
