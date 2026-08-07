package cn.aibase.provider.web;

import cn.aibase.provider.domain.Provider;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 供应商响应：apiKey 脱敏（仅展示前后缀）。
 */
@Getter
@Setter
public class ProviderResponse {

    private Long id;
    private String name;
    private String providerType;
    private String apiKey;
    private String baseUrl;
    private String icon;
    private String iconColor;
    private List<Provider.ProviderModel> models;
    private String defaultModel;
    private Integer maxTokens;
    private Integer timeoutSeconds;
    private String extraConfig;
    private boolean enabled;
    private boolean isDefault;
    private int sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ProviderResponse of(Provider p) {
        ProviderResponse r = new ProviderResponse();
        r.setId(p.getId());
        r.setName(p.getName());
        r.setProviderType(p.getProviderType());
        r.setApiKey(mask(p.getApiKey()));
        r.setBaseUrl(p.getBaseUrl());
        r.setIcon(p.getIcon());
        r.setIconColor(p.getIconColor());
        r.setModels(p.getModels());
        r.setDefaultModel(p.getDefaultModel());
        r.setMaxTokens(p.getMaxTokens());
        r.setTimeoutSeconds(p.getTimeoutSeconds());
        r.setExtraConfig(p.getExtraConfig());
        r.setEnabled(p.isEnabled());
        r.setDefault(p.isDefault());
        r.setSortOrder(p.getSortOrder());
        r.setCreatedAt(p.getCreatedAt());
        r.setUpdatedAt(p.getUpdatedAt());
        return r;
    }

    private static String mask(String key) {
        if (key == null || key.isBlank()) return "";
        if (key.length() <= 8) return "••••••••";
        return key.substring(0, 4) + "••••••••" + key.substring(key.length() - 4);
    }
}
