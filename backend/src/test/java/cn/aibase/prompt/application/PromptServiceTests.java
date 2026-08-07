package cn.aibase.prompt.application;

import cn.aibase.common.DuplicateException;
import cn.aibase.prompt.domain.Prompt;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 提示词服务集成测试（临时 SQLite 文件库）。
 */
@SpringBootTest(classes = cn.aibase.AIBaseApplication.class)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:sqlite:./target/test-prompts.db",
        "spring.datasource.driver-class-name=org.sqlite.JDBC",
        "aibase.data-dir=./target/test-data",
})
class PromptServiceTests {

    @Autowired
    private PromptService service;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM prompt_versions");
        jdbc.update("DELETE FROM prompts");
    }

    private PromptRequest request(String name) {
        PromptRequest r = new PromptRequest();
        r.setName(name);
        r.setCategory("test");
        r.setContent("你好，{{name}}！这是{{topic}}");
        r.setVariables(List.of(
                new Prompt.PromptVariable("name", "用户", true),
                new Prompt.PromptVariable("topic", "主题", false)));
        r.setEnabled(true);
        return r;
    }

    @Test
    void createAndRenderWithVariables() {
        Prompt p = service.create(request("问候"));
        assertNotNull(p.getId());
        assertEquals(1, p.getVersion());

        PromptService.RenderResult result = service.render(p.getId(), Map.of("name", "张三", "topic", "Java"));
        assertEquals("你好，张三！这是Java", result.content());
        assertTrue(result.missingVariables().isEmpty());
    }

    @Test
    void renderReportsMissingRequiredVariables() {
        Prompt p = service.create(request("问候"));
        PromptService.RenderResult result = service.render(p.getId(), Map.of("topic", "Java"));
        assertEquals("你好，{{name}}！这是Java", result.content());
        assertTrue(result.missingVariables().containsKey("name"));
    }

    @Test
    void updateArchivesOldVersion() {
        Prompt p = service.create(request("版本"));
        PromptRequest update = request("版本");
        update.setContent("新内容：{{name}}");
        Prompt updated = service.update(p.getId(), update);
        assertEquals(2, updated.getVersion());

        assertEquals(1, service.versionHistory(p.getId()).size());
    }

    @Test
    void duplicateNameRejected() {
        service.create(request("唯一"));
        assertThrows(DuplicateException.class, () -> service.create(request("唯一")));
    }

    @Test
    void categoriesListed() {
        service.create(request("分类A"));
        assertTrue(service.categories().contains("test"));
    }
}
