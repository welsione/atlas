package cn.aibase.provider.web;

import cn.aibase.provider.domain.Provider;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/**
 * 创建/更新供应商请求。
 */
@Data
public class ProviderRequest {

    @NotBlank(message = "名称不能为空")
    private String name;

    private String providerType = "ANTHROPIC_COMPATIBLE";

    /** 新增时必填；编辑时留空保留原值。 */
    private String apiKey;

    @NotBlank(message = "Base URL 不能为空")
    private String baseUrl;

    private String icon = "";
    private String iconColor = "";
    private List<Provider.ProviderModel> models = List.of();
    private String defaultModel = "";
    private Integer maxTokens;
    private Integer timeoutSeconds = 240;
    private String extraConfig = "{}";
    private Boolean enabled = true;
    private Boolean isDefault = false;
    private Integer sortOrder = 0;
}
