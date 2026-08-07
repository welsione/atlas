package cn.aibase.prompt.application;

import cn.aibase.common.DuplicateException;
import cn.aibase.common.ResourceNotFoundException;
import cn.aibase.common.ValidationException;
import cn.aibase.plugin.PluginRegistry;
import cn.aibase.prompt.domain.Prompt;
import cn.aibase.prompt.infrastructure.PromptJdbcRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 提示词服务：CRUD、分类、变量渲染（{{var}}）与版本历史。
 *
 * <p>渲染流程：变量替换（缺失变量保留占位符并提示）→ 按序执行插件注册的
 * PromptProcessor 管道。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PromptService {

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_]+)\\s*}}");

    private final PromptJdbcRepository repository;
    private final PluginRegistry pluginRegistry;

    @Transactional(readOnly = true)
    public List<Prompt> list() {
        return repository.findAll();
    }

    @Transactional(readOnly = true)
    public List<String> categories() {
        return repository.findCategories();
    }

    @Transactional(readOnly = true)
    public Prompt get(Long id) {
        return repository.findById(id);
    }

    @Transactional
    public Prompt create(PromptRequest request) {
        validateName(request.getName(), null);
        Prompt p = new Prompt();
        p.setName(request.getName().trim());
        p.setCategory(request.getCategory() == null || request.getCategory().isBlank() ? "default" : request.getCategory().trim());
        p.setDescription(request.getDescription() == null ? "" : request.getDescription());
        p.setContent(request.getContent() == null ? "" : request.getContent());
        p.setVariables(request.getVariables() == null ? List.of() : request.getVariables());
        p.setVersion(1);
        p.setEnabled(request.getEnabled() == null || request.getEnabled());
        p.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        LocalDateTime now = LocalDateTime.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        repository.insert(p);
        log.info("创建提示词：{}（category={}）", p.getName(), p.getCategory());
        return p;
    }

    /**
     * 更新提示词：内容变化时归档旧版本并自增版本号。
     */
    @Transactional
    public Prompt update(Long id, PromptRequest request) {
        Prompt existing = repository.findById(id);
        validateName(request.getName(), existing);
        existing.setName(request.getName().trim());
        existing.setCategory(request.getCategory() == null || request.getCategory().isBlank() ? "default" : request.getCategory().trim());
        existing.setDescription(request.getDescription() == null ? "" : request.getDescription());
        existing.setVariables(request.getVariables() == null ? List.of() : request.getVariables());
        existing.setEnabled(request.getEnabled() == null || request.getEnabled());
        existing.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        existing.setUpdatedAt(LocalDateTime.now());

        String newContent = request.getContent() == null ? "" : request.getContent();
        if (!newContent.equals(existing.getContent())) {
            repository.archiveVersion(existing.getId(), existing.getVersion(), existing.getContent(), existing.getUpdatedAt());
            existing.setContent(newContent);
            existing.setVersion(existing.getVersion() + 1);
        }
        repository.update(existing);
        log.info("更新提示词：{}（version={}）", existing.getName(), existing.getVersion());
        return existing;
    }

    @Transactional
    public void delete(Long id) {
        Prompt p = repository.findById(id);
        repository.delete(id);
        log.info("删除提示词：{}", p.getName());
    }

    /**
     * 渲染提示词：{{变量}} 替换 + 插件处理管道。
     */
    @Transactional(readOnly = true)
    public RenderResult render(Long id, Map<String, String> variables) {
        Prompt p = repository.findById(id);
        String rendered = p.getContent();
        Map<String, String> missing = new HashMap<>();
        Matcher matcher = VARIABLE_PATTERN.matcher(rendered);
        while (matcher.find()) {
            String name = matcher.group(1);
            String value = variables == null ? null : variables.get(name);
            if (value == null || value.isBlank()) {
                missing.put(name, "缺少变量 " + name);
            }
        }
        for (Map.Entry<String, String> entry : (variables == null ? Map.<String, String>of() : variables).entrySet()) {
            rendered = rendered.replaceAll(
                    Pattern.quote("{{" + entry.getKey() + "}}"),
                    Matcher.quoteReplacement(entry.getValue() == null ? "" : entry.getValue()));
        }
        for (var processor : pluginRegistry.processors()) {
            rendered = processor.process(rendered, variables == null ? Map.of() : variables);
        }
        return new RenderResult(rendered, missing);
    }

    /**
     * 提示词版本历史。
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> versionHistory(Long id) {
        repository.findById(id);
        return repository.findVersionHistory(id);
    }

    private void validateName(String name, Prompt existing) {
        if (name == null || name.isBlank()) {
            throw new ValidationException("name", "提示词名称不能为空");
        }
        String trimmed = name.trim();
        if ((existing == null || !trimmed.equals(existing.getName())) && repository.existsByName(trimmed)) {
            throw new DuplicateException("提示词名称已存在: " + trimmed);
        }
    }

    public record RenderResult(String content, Map<String, String> missingVariables) {
    }
}
