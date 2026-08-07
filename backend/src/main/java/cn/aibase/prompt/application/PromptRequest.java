package cn.aibase.prompt.application;

import cn.aibase.prompt.domain.Prompt;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 创建/更新提示词请求。
 */
@Data
public class PromptRequest {

    @NotBlank(message = "名称不能为空")
    private String name;

    private String category;
    private String description;
    private String content;
    private List<Prompt.PromptVariable> variables = List.of();
    private Boolean enabled = true;
    private Integer sortOrder = 0;

    /** 渲染请求：变量键值。 */
    @Data
    public static class RenderRequest {
        private Map<String, String> variables = Map.of();
    }
}
