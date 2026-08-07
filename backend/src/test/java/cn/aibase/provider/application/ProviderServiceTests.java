package cn.aibase.provider.application;

import cn.aibase.common.DuplicateException;
import cn.aibase.common.ValidationException;
import cn.aibase.provider.domain.Provider;
import cn.aibase.provider.web.ProviderRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 供应商服务集成测试（临时 SQLite 文件库）。
 */
@SpringBootTest(classes = cn.aibase.AIBaseApplication.class)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:sqlite:./target/test-aibase.db",
        "spring.datasource.driver-class-name=org.sqlite.JDBC",
        "aibase.data-dir=./target/test-data",
})
class ProviderServiceTests {

    @Autowired
    private ProviderService service;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM providers");
    }

    private ProviderRequest request(String name, String type, String baseUrl, String apiKey) {
        ProviderRequest r = new ProviderRequest();
        r.setName(name);
        r.setProviderType(type);
        r.setBaseUrl(baseUrl);
        r.setApiKey(apiKey);
        r.setModels(List.of(new Provider.ProviderModel("test-model", 131072)));
        r.setDefaultModel("test-model");
        r.setEnabled(true);
        return r;
    }

    @Test
    void createEncryptsApiKeyAndAutoSetsDefault() {
        Provider p = service.create(request("测试供应商", "ANTHROPIC_COMPATIBLE", "https://api.test.com", "sk-secret-1234567890"));
        assertNotNull(p.getId());
        assertTrue(p.isDefault());
        // 返回响应前加密；测试连接时解密
        Provider fetched = service.get(p.getId());
        assertFalse(fetched.getApiKey().contains("sk-secret"));
        assertEquals("ANTHROPIC_COMPATIBLE", fetched.getProviderType());
    }

    @Test
    void duplicateNameRejected() {
        service.create(request("重复名称", "ANTHROPIC_COMPATIBLE", "https://api.a.com", "sk-1"));
        assertThrows(DuplicateException.class,
                () -> service.create(request("重复名称", "ANTHROPIC_COMPATIBLE", "https://api.b.com", "sk-2")));
    }

    @Test
    void updateKeepsApiKeyWhenBlank() {
        Provider p = service.create(request("保留密钥", "ANTHROPIC_COMPATIBLE", "https://api.a.com", "sk-original-123456"));
        String encryptedBefore = service.get(p.getId()).getApiKey();

        ProviderRequest update = request("保留密钥", "ANTHROPIC_COMPATIBLE", "https://api.new.com", "");
        Provider updated = service.update(p.getId(), update);

        assertEquals("https://api.new.com", updated.getBaseUrl());
        assertEquals(encryptedBefore, service.get(p.getId()).getApiKey());
    }

    @Test
    void defaultProviderCannotBeDisabled() {
        Provider p = service.create(request("默认供应商", "ANTHROPIC_COMPATIBLE", "https://api.a.com", "sk-1"));
        assertThrows(ValidationException.class, () -> service.updateEnabled(p.getId(), false));
    }

    @Test
    void unsupportedTypeRejectedOnTestConfig() {
        ProviderRequest r = request("未知类型", "CUSTOM_TYPE", "https://api.a.com", "sk-1");
        assertThrows(ValidationException.class, () -> service.testConfig(r));
    }
}
