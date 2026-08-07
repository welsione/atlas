package cn.aibase.prompt.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 提示词实体（对应 prompts 表）。
 *
 * <p>内容支持 {{变量}} 占位符；变量列表以 JSON 存储（{name, description, required}）。</p>
 */
@Getter
@Setter
@NoArgsConstructor
public class Prompt {

    private Long id;
    private String name;
    private String category;
    private String description;
    private String content;
    private List<PromptVariable> variables;
    private int version;
    private boolean enabled;
    private int sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public record PromptVariable(String name, String description, boolean required) {
    }
}
