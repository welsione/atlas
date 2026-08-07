package cn.aibase.provider.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 供应商配置实体（对应 providers 表）。
 *
 * <p>apiKey 以 AES 密文存储；模型列表以 JSON 存储（每项含 modelId 与上下文窗口）。</p>
 */
@Getter
@Setter
@NoArgsConstructor
public class Provider {

    private Long id;
    private String name;
    private String providerType;
    private String apiKey;
    private String baseUrl;
    private String icon;
    private String iconColor;
    private List<ProviderModel> models;
    private String defaultModel;
    private Integer maxTokens;
    private Integer timeoutSeconds;
    /** 扩展配置（JSON），供插件透传自定义参数。 */
    private String extraConfig;
    private boolean enabled;
    private boolean isDefault;
    private int sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** 预设模型的模型条目：modelId 与最大上下文 Token 数。 */
    public record ProviderModel(String modelId, Integer contextTokens) {
    }
}
