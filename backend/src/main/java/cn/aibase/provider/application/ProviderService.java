package cn.aibase.provider.application;

import cn.aibase.common.DuplicateException;
import cn.aibase.common.ValidationException;
import cn.aibase.config.EncryptionConfig;
import cn.aibase.plugin.PluginRegistry;
import cn.aibase.plugin.ProviderAdapter;
import cn.aibase.provider.domain.Provider;
import cn.aibase.provider.infrastructure.ProviderJdbcRepository;
import cn.aibase.provider.web.ProviderRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 供应商配置服务：CRUD、API Key 加密存储、默认切换与连接测试。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProviderService {

    private final ProviderJdbcRepository repository;
    private final EncryptionConfig.AesEncryptor encryptor;
    private final PluginRegistry pluginRegistry;

    @Transactional(readOnly = true)
    public List<Provider> list() {
        return repository.findAll();
    }

    @Transactional(readOnly = true)
    public Provider get(Long id) {
        return repository.findById(id);
    }

    /**
     * 创建供应商；apiKey 加密后入库，首个启用供应商自动设为默认。
     */
    @Transactional
    public Provider create(ProviderRequest request) {
        validate(request);
        Provider provider = new Provider();
        provider.setName(request.getName().trim());
        provider.setProviderType(request.getProviderType());
        provider.setApiKey(encrypt(request.getApiKey()));
        provider.setBaseUrl(request.getBaseUrl().trim());
        provider.setIcon(request.getIcon() == null ? "" : request.getIcon());
        provider.setIconColor(request.getIconColor() == null ? "" : request.getIconColor());
        provider.setModels(request.getModels() == null ? List.of() : request.getModels());
        provider.setDefaultModel(request.getDefaultModel() == null ? "" : request.getDefaultModel());
        provider.setMaxTokens(request.getMaxTokens());
        provider.setTimeoutSeconds(request.getTimeoutSeconds() == null ? 240 : request.getTimeoutSeconds());
        provider.setExtraConfig(request.getExtraConfig() == null ? "{}" : request.getExtraConfig());
        provider.setEnabled(Boolean.TRUE.equals(request.getEnabled()));
        provider.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        provider.setCreatedAt(LocalDateTime.now());
        provider.setUpdatedAt(provider.getCreatedAt());

        boolean noProvider = repository.findAll().isEmpty();
        provider.setDefault(noProvider || Boolean.TRUE.equals(request.getIsDefault()));
        if (provider.isDefault()) {
            repository.clearDefault();
        }
        repository.insert(provider);
        log.info("创建供应商：{}（type={}）", provider.getName(), provider.getProviderType());
        return provider;
    }

    /**
     * 更新供应商；apiKey 留空保留原密文。
     */
    @Transactional
    public Provider update(Long id, ProviderRequest request) {
        Provider existing = repository.findById(id);
        validate(request, existing);
        existing.setName(request.getName().trim());
        existing.setProviderType(request.getProviderType());
        if (request.getApiKey() != null && !request.getApiKey().isBlank()) {
            existing.setApiKey(encrypt(request.getApiKey()));
        }
        existing.setBaseUrl(request.getBaseUrl().trim());
        existing.setIcon(request.getIcon() == null ? "" : request.getIcon());
        existing.setIconColor(request.getIconColor() == null ? "" : request.getIconColor());
        existing.setModels(request.getModels() == null ? List.of() : request.getModels());
        existing.setDefaultModel(request.getDefaultModel() == null ? "" : request.getDefaultModel());
        existing.setMaxTokens(request.getMaxTokens());
        existing.setTimeoutSeconds(request.getTimeoutSeconds() == null ? 240 : request.getTimeoutSeconds());
        existing.setExtraConfig(request.getExtraConfig() == null ? "{}" : request.getExtraConfig());
        existing.setEnabled(Boolean.TRUE.equals(request.getEnabled()));
        existing.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        existing.setUpdatedAt(LocalDateTime.now());

        boolean wasDefault = existing.isDefault();
        boolean wantDefault = Boolean.TRUE.equals(request.getIsDefault());
        if (wantDefault && !wasDefault) {
            repository.clearDefault();
        }
        if (wasDefault && !wantDefault && request.getEnabled() != null && Boolean.FALSE.equals(request.getEnabled())) {
            throw new ValidationException("enabled", "默认供应商不能禁用，请先设置其他供应商为默认");
        }
        existing.setDefault(wantDefault);
        repository.update(existing);
        log.info("更新供应商：{}", existing.getName());
        return existing;
    }

    @Transactional
    public void delete(Long id) {
        Provider provider = repository.findById(id);
        repository.delete(id);
        log.info("删除供应商：{}", provider.getName());
    }

    @Transactional
    public Provider setDefault(Long id) {
        Provider provider = repository.findById(id);
        repository.clearDefault();
        provider.setDefault(true);
        provider.setUpdatedAt(LocalDateTime.now());
        repository.update(provider);
        return provider;
    }

    @Transactional
    public Provider updateEnabled(Long id, boolean enabled) {
        Provider provider = repository.findById(id);
        if (provider.isDefault() && !enabled) {
            throw new ValidationException("enabled", "默认供应商不能禁用，请先设置其他供应商为默认");
        }
        provider.setEnabled(enabled);
        provider.setUpdatedAt(LocalDateTime.now());
        repository.update(provider);
        return provider;
    }

    /**
     * 测试已保存供应商的连接；解密 apiKey 后按协议类型选择适配器。
     */
    public ProviderAdapter.ConnectionTestResult test(Long id) {
        Provider provider = repository.findById(id);
        provider.setApiKey(encryptor.decrypt(provider.getApiKey()));
        return pluginRegistry.adapterOf(provider.getProviderType()).test(provider);
    }

    /**
     * 测试未保存的表单配置（不落库）。
     */
    public ProviderAdapter.ConnectionTestResult testConfig(ProviderRequest request) {
        validate(request);
        Provider provider = new Provider();
        provider.setProviderType(request.getProviderType());
        provider.setApiKey(request.getApiKey() == null ? "" : request.getApiKey());
        provider.setBaseUrl(request.getBaseUrl().trim());
        provider.setDefaultModel(request.getDefaultModel() == null ? "" : request.getDefaultModel());
        provider.setModels(request.getModels() == null ? List.of() : request.getModels());
        return pluginRegistry.adapterOf(provider.getProviderType()).test(provider);
    }

    /** 插件注册的协议类型列表（前端下拉使用）。 */
    public List<String> supportedTypes() {
        return pluginRegistry.supportedTypes().stream().sorted().toList();
    }

    private String encrypt(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ValidationException("apiKey", "API Key 不能为空");
        }
        return encryptor.encrypt(apiKey);
    }

    private void validate(ProviderRequest request) {
        if (request.getProviderType() == null || request.getProviderType().isBlank()) {
            throw new ValidationException("providerType", "供应商类型不能为空");
        }
        if (repository.existsByName(request.getName().trim())) {
            throw new DuplicateException("供应商名称已存在: " + request.getName());
        }
    }

    private void validate(ProviderRequest request, Provider existing) {
        if (request.getProviderType() == null || request.getProviderType().isBlank()) {
            throw new ValidationException("providerType", "供应商类型不能为空");
        }
        String trimmed = request.getName().trim();
        if (!trimmed.equals(existing.getName()) && repository.existsByName(trimmed)) {
            throw new DuplicateException("供应商名称已存在: " + trimmed);
        }
    }
}
