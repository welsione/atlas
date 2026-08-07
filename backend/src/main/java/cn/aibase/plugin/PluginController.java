package cn.aibase.plugin;

import cn.aibase.common.ApiResponse;
import cn.aibase.config.AIBaseProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * 插件信息端点：已注册的适配器/处理器与外部插件 jar 清单。
 */
@RestController
@RequestMapping("/api/plugins")
@RequiredArgsConstructor
public class PluginController {

    private final PluginRegistry registry;
    private final AIBaseProperties properties;

    @GetMapping
    public ApiResponse<PluginOverview> overview() {
        List<String> adapters = new ArrayList<>(registry.supportedTypes());
        List<String> processors = registry.processors().stream().map(PromptProcessor::name).toList();
        File pluginsDir = new File(properties.getDataDir(), "plugins");
        List<String> jars = List.of();
        File[] files = pluginsDir.listFiles((dir, name) -> name.endsWith(".jar"));
        if (files != null) {
            jars = java.util.Arrays.stream(files).map(File::getName).sorted().toList();
        }
        return ApiResponse.ok(new PluginOverview(adapters, processors, jars));
    }

    public record PluginOverview(List<String> providerAdapters, List<String> promptProcessors, List<String> externalJars) {
    }
}
