package cn.aibase.plugin;

import cn.aibase.common.ValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 插件注册中心：按协议类型索引 ProviderAdapter，按名称索引 PromptProcessor。
 *
 * <p>类路径插件（Spring Bean）启动时自动注册；外部插件 jar 加载机制由
 * {@code ExternalPluginLoader} 提供，注册结果合并进本中心。</p>
 */
@Slf4j
@Component
public class PluginRegistry {

    private final Map<String, ProviderAdapter> adapters = new LinkedHashMap<>();
    private final Map<String, PromptProcessor> processors = new LinkedHashMap<>();

    public PluginRegistry(Collection<ProviderAdapter> adapters, Collection<PromptProcessor> processors) {
        for (ProviderAdapter adapter : adapters) {
            registerAdapter(adapter);
        }
        for (PromptProcessor processor : processors) {
            registerProcessor(processor);
        }
    }

    /**
     * 注册协议适配器；类型名冲突时拒绝并告警（内置类型优先）。
     */
    public void registerAdapter(ProviderAdapter adapter) {
        ProviderAdapter existing = adapters.putIfAbsent(adapter.type(), adapter);
        if (existing != null) {
            log.warn("协议类型 {} 已由 {} 注册，忽略 {}", adapter.type(), existing.getClass().getSimpleName(), adapter.getClass().getSimpleName());
        } else {
            log.info("已注册协议适配器：{} -> {}", adapter.type(), adapter.getClass().getSimpleName());
        }
    }

    public void registerProcessor(PromptProcessor processor) {
        PromptProcessor existing = processors.putIfAbsent(processor.name(), processor);
        if (existing != null) {
            log.warn("提示词处理器 {} 已存在，忽略 {}", processor.name(), processor.getClass().getSimpleName());
        } else {
            log.info("已注册提示词处理器：{} -> {}", processor.name(), processor.getClass().getSimpleName());
        }
    }

    public ProviderAdapter adapterOf(String providerType) {
        ProviderAdapter adapter = adapters.get(providerType);
        if (adapter == null) {
            throw new ValidationException("providerType", "不支持的供应商协议类型: " + providerType);
        }
        return adapter;
    }

    public Collection<String> supportedTypes() {
        return adapters.keySet();
    }

    public Collection<PromptProcessor> processors() {
        return processors.values();
    }
}
