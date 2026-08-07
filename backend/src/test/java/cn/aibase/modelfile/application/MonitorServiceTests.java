package cn.aibase.modelfile.application;

import cn.aibase.modelfile.domain.ModelFile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 控制台监控服务测试：流量统计（上传/下载字节）、服务器数据。
 */
@SpringBootTest(classes = cn.aibase.AIBaseApplication.class)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:sqlite:./target/test-monitor.db",
        "spring.datasource.driver-class-name=org.sqlite.JDBC",
        "aibase.data-dir=./target/test-monitor-data",
})
class MonitorServiceTests {

    @Autowired
    private ModelFileService fileService;

    @Autowired
    private MonitorService monitorService;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clean() {
        for (ModelFile f : fileService.list()) {
            fileService.delete(f.getId());
        }
        jdbc.update("DELETE FROM model_files");
        jdbc.update("DELETE FROM download_logs");
        jdbc.update("DELETE FROM upload_logs");
    }

    private MultipartFile file(String name, String content) {
        return new MockMultipartFile("files", name, "application/octet-stream", content.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void statsAggregatesUploadAndDownloadBytes() {
        ModelFile entry = fileService.upload("asr", "", List.of(file("a.bin", "0123456789")), null);
        fileService.recordUpload(entry, "1.2.3.4", "client");
        fileService.recordDownload(entry, "1.2.3.4", "client");
        fileService.recordDownload(entry, "5.6.7.8", "client");

        MonitorService.TransferStats stats = monitorService.stats("24h");
        assertEquals(10, stats.uploadBytes());
        assertEquals(1, stats.uploadCount());
        assertEquals(20, stats.downloadBytes());
        assertEquals(2, stats.downloadCount());
        // 24 小时序列补零
        assertEquals(24, stats.series().size(), "序列：" + stats.series().stream()
                .filter(p -> p.downloadBytes() > 0).map(p -> p.bucket() + "=" + p.downloadBytes()).toList());
        assertTrue(stats.series().stream().anyMatch(p -> p.downloadBytes() == 20),
                "下载序列：" + stats.series().stream().map(p -> p.bucket() + ":" + p.downloadBytes()).toList());
    }

    @Test
    void overviewReportsServerRuntime() {
        MonitorService.ServerOverview overview = monitorService.overview();
        assertTrue(overview.cpuCores() > 0);
        assertTrue(overview.heapUsed() > 0);
        assertTrue(overview.heapMax() > 0);
        assertTrue(overview.uptimeSeconds() >= 0);
        assertTrue(overview.systemTotalMemory() > 0);
        assertTrue(overview.diskTotal() > 0);
    }

    @Test
    void topRanksFilesAndIps() {
        ModelFile entry = fileService.upload("asr", "", List.of(file("top.bin", "0123456789")), null);
        fileService.recordDownload(entry, "9.9.9.9", "c");
        fileService.recordDownload(entry, "9.9.9.9", "c");

        MonitorService.TopStats top = monitorService.top("24h", 10);
        assertTrue(top.topDownloadFiles().stream()
                .anyMatch(row -> Long.parseLong(String.valueOf(row.get("count"))) >= 2));
        assertTrue(top.topIps().stream().anyMatch(row -> "9.9.9.9".equals(row.get("ip"))));
    }
}
