package cn.aibase.modelfile.application;

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
    void clean() {
        jdbc.update("DELETE FROM model_files");
        for (ModelFile f : service.list()) {
            service.delete(f.getId());
        }
    }

    private MultipartFile file(String name, String content) {
        return new MockMultipartFile("files", name, "application/octet-stream", content.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void uploadSingleFileStoresEntry() throws Exception {
        ModelFile entry = service.upload("asr", "测试模型", List.of(file("model.onnx", "binary-data")));
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
                file("sherpa-model/tokens.txt", "tokens")));
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
        ModelFile entry = service.upload("asr", "zip 模型", List.of(zip));
        assertEquals("DIRECTORY", entry.getKind());
        assertEquals("asr-model", entry.getName());
        assertEquals(2, entry.getFileCount());
    }

    @Test
    void downloadSingleFileReturnsContent() throws Exception {
        ModelFile entry = service.upload("asr", "", List.of(file("a.bin", "hello")));
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        service.download(entry.getId(), out);
        assertEquals("hello", out.toString(StandardCharsets.UTF_8));
    }

    @Test
    void downloadDirectoryBuildsZip() throws Exception {
        ModelFile entry = service.upload("asr", "", List.of(
                file("m/f1.txt", "one"),
                file("m/f2.txt", "two")));
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        service.download(entry.getId(), out);
        assertTrue(out.size() > 0);
        assertEquals("m.zip", service.downloadFileName(entry));
    }

    @Test
    void pathTraversalRejected() {
        assertThrows(ValidationException.class,
                () -> service.upload("asr", "", List.of(file("../evil.txt", "x"))));
        assertThrows(ValidationException.class,
                () -> service.upload("asr", "", List.of(file("a/../../evil.txt", "x"))));
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
        assertThrows(ValidationException.class, () -> service.upload("asr", "", List.of(zip)));
    }

    @Test
    void deleteRemovesEntryAndDisk() throws Exception {
        ModelFile entry = service.upload("asr", "", List.of(file("m.bin", "data")));
        Path stored = Path.of("./target/test-modelfiles-data/model-files/" + entry.getId());
        assertTrue(Files.exists(stored));
        service.delete(entry.getId());
        assertFalse(Files.exists(stored));
        assertTrue(service.list().isEmpty());
    }
}
