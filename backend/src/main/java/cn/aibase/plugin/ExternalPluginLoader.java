package cn.aibase.plugin;

import cn.aibase.config.AIBaseProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.ServiceLoader;

/**
 * 外部插件加载器：扫描 {@code plugins/} 目录中的 jar，通过 ServiceLoader 发现
 * ProviderAdapter 与 PromptProcessor 并注册进 PluginRegistry。
 *
 * <p>插件 jar 规范：META-INF/services 声明 {@code cn.aibase.plugin.ProviderAdapter}
 * 或 {@code cn.aibase.plugin.PromptProcessor} 的实现类。放入数据目录 plugins/ 后重启生效。</p>
 */
@Slf4j
@Component
public class ExternalPluginLoader {

    private final AIBaseProperties properties;
    private final PluginRegistry registry;

    public ExternalPluginLoader(AIBaseProperties properties, PluginRegistry registry) {
        this.properties = properties;
        this.registry = registry;
    }

    /**
     * 加载并注册所有外部插件（启动时调用）。
     *
     * @return 已加载插件 jar 数量
     */
    public int loadAll() {
        File pluginsDir = new File(properties.getDataDir(), "plugins");
        if (!pluginsDir.isDirectory()) {
            if (!pluginsDir.mkdirs()) {
                log.warn("创建插件目录失败: {}", pluginsDir.getAbsolutePath());
            }
            return 0;
        }
        List<URL> urls = new ArrayList<>();
        File[] jars = pluginsDir.listFiles((dir, name) -> name.endsWith(".jar"));
        if (jars == null || jars.length == 0) {
            return 0;
        }
        for (File jar : jars) {
            try {
                urls.add(jar.toURI().toURL());
            } catch (IOException ex) {
                log.warn("插件 jar 解析失败: {}", jar.getName(), ex);
            }
        }
        if (urls.isEmpty()) {
            return 0;
        }
        try (URLClassLoader loader = new URLClassLoader(urls.toArray(new URL[0]), getClass().getClassLoader())) {
            int loaded = 0;
            for (ProviderAdapter adapter : ServiceLoader.load(ProviderAdapter.class, loader)) {
                registry.registerAdapter(adapter);
                loaded++;
            }
            for (PromptProcessor processor : ServiceLoader.load(PromptProcessor.class, loader)) {
                registry.registerProcessor(processor);
                loaded++;
            }
            log.info("外部插件加载完成：共 {} 个插件类（jar: {}）", loaded, jars.length);
            return loaded;
        } catch (IOException ex) {
            log.error("外部插件加载失败", ex);
            return 0;
        }
    }
}
