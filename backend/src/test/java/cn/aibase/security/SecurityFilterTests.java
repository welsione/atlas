package cn.aibase.security;

import cn.aibase.modelfile.application.ModelFileService;
import cn.aibase.modelfile.domain.ModelFile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 安全过滤器测试：黑名单 403、管理认证 401/200、公开下载放行。
 */
@SpringBootTest(classes = cn.aibase.AIBaseApplication.class)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:sqlite:./target/test-security.db",
        "spring.datasource.driver-class-name=org.sqlite.JDBC",
        "aibase.data-dir=./target/test-security-data",
        "aibase.admin-password=test-password",
        "aibase.admin-key=test-admin-key",
})
class SecurityFilterTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ModelFileService fileService;

    @Autowired
    private IpRuleService ipRuleService;

    @BeforeEach
    void clean() {
        for (ModelFile f : fileService.list()) {
            fileService.delete(f.getId());
        }
        jdbc.update("DELETE FROM model_files");
        jdbc.update("DELETE FROM download_logs");
        jdbc.update("DELETE FROM upload_logs");
        jdbc.update("DELETE FROM ip_rules");
        jdbc.update("DELETE FROM security_settings");
        ipRuleService.reload();
    }

    @Test
    void managementEndpointsRequireAuth() throws Exception {
        // 未认证 → 401
        mvc.perform(get("/api/providers"))
                .andExpect(status().isUnauthorized());
        // 错误 token → 401
        mvc.perform(get("/api/providers").header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());
        // X-AIBase-Key → 200
        mvc.perform(get("/api/providers").header("X-AIBase-Key", "test-admin-key"))
                .andExpect(status().isOk());
    }

    @Test
    void loginIssuesUsableToken() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"password\":\"test-password\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty());
    }

    @Test
    void publicDownloadAllowedWithoutAuth() throws Exception {
        MultipartFile f = new MockMultipartFile("files", "pub.bin", "application/octet-stream",
                "data".getBytes(StandardCharsets.UTF_8));
        ModelFile entry = fileService.upload("asr", "", List.of(f), null);

        mvc.perform(get("/api/files/" + entry.getToken() + "/meta"))
                .andExpect(status().isOk());
    }

    @Test
    void blockedIpRejectedEvenForPublicEndpoints() throws Exception {
        ipRuleService.block("203.0.113.9", "测试封禁");
        // 模拟该 IP 访问公开下载 meta → 403
        mvc.perform(get("/api/files/whatever/meta").with(request -> {
            request.setRemoteAddr("203.0.113.9");
            return request;
        })).andExpect(status().isForbidden());
    }

    @Test
    void unblockedIpAllowedAgain() throws Exception {
        ipRuleService.block("203.0.113.10", "临时");
        ipRuleService.unblock("203.0.113.10");
        mvc.perform(get("/api/auth/status").with(request -> {
            request.setRemoteAddr("203.0.113.10");
            return request;
        })).andExpect(status().isOk());
    }
}
