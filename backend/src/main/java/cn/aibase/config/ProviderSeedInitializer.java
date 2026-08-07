package cn.aibase.config;

import cn.aibase.provider.domain.Provider;
import cn.aibase.provider.infrastructure.ProviderJdbcRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 初始化预设供应商种子：主流国产厂商（Anthropic 兼容端点）与两个通用兼容入口。
 *
 * <p>仅在 providers 表为空时执行；apiKey 留空、enabled=false，由用户配置后启用。
 * 模型窗口为发布时基线，可后续在页面上自行维护。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProviderSeedInitializer implements ApplicationRunner {

    private final ProviderJdbcRepository repository;

    @Override
    public void run(ApplicationArguments args) {
        if (!repository.findAll().isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        List<Provider> seeds = List.of(
                seed("DeepSeek", "ANTHROPIC_COMPATIBLE", "https://api.deepseek.com/anthropic",
                        "icons/deepseek.svg", "#1E88E5",
                        List.of(model("deepseek-v4-pro", 1000000), model("deepseek-v4-flash", 1000000)),
                        "deepseek-v4-pro", now),
                seed("MiniMax", "ANTHROPIC_COMPATIBLE", "https://api.minimaxi.com/anthropic",
                        "icons/minimax.svg", "#FF6B6B",
                        List.of(model("MiniMax-M2.7", 204800), model("MiniMax-M3", 1000000)),
                        "MiniMax-M2.7", now),
                seed("火山引擎", "ANTHROPIC_COMPATIBLE", "https://ark.cn-beijing.volces.com/api/coding",
                        "icons/huoshan.png", "#3370FF",
                        List.of(model("doubao-seed-2-1-pro-260628", 262144)),
                        "doubao-seed-2-1-pro-260628", now),
                seed("硅基流动", "ANTHROPIC_COMPATIBLE", "https://api.siliconflow.cn",
                        "icons/siliconflow.svg", "#6E29F6",
                        List.of(model("deepseek-ai/DeepSeek-V4-Pro", 1000000), model("zai-org/GLM-5.2", 1049000)),
                        "deepseek-ai/DeepSeek-V4-Pro", now),
                seed("智谱 AI", "ANTHROPIC_COMPATIBLE", "https://open.bigmodel.cn/api/anthropic",
                        "icons/zhipu.svg", "#0F62FE",
                        List.of(model("glm-5.2", 1000000), model("glm-5.1", 200000)),
                        "glm-5.2", now),
                seed("Kimi", "ANTHROPIC_COMPATIBLE", "https://api.moonshot.cn/anthropic",
                        "icons/kimi.svg", "#6366F1",
                        List.of(model("kimi-k2.7-code", 262144), model("kimi-k3", 1048576)),
                        "kimi-k2.7-code", now),
                seed("Anthropic 兼容", "ANTHROPIC_COMPATIBLE", "", "icons/anthropic.svg", "#D97757", List.of(), "", now),
                seed("OpenAI 兼容", "OPENAI_COMPATIBLE", "", "icons/openai.svg", "#000000", List.of(), "", now)
        );
        for (Provider p : seeds) {
            repository.insert(p);
        }
        log.info("已初始化 {} 个预设供应商", seeds.size());
    }

    private Provider seed(String name, String type, String baseUrl, String icon, String color,
                          List<Provider.ProviderModel> models, String defaultModel, LocalDateTime now) {
        Provider p = new Provider();
        p.setName(name);
        p.setProviderType(type);
        p.setApiKey("");
        p.setBaseUrl(baseUrl);
        p.setIcon(icon);
        p.setIconColor(color);
        p.setModels(models);
        p.setDefaultModel(defaultModel);
        p.setMaxTokens(models.isEmpty() ? null : models.get(0).contextTokens());
        p.setTimeoutSeconds(240);
        p.setExtraConfig("{}");
        p.setEnabled(false);
        p.setDefault(false);
        p.setSortOrder(0);
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        return p;
    }

    private Provider.ProviderModel model(String modelId, int contextTokens) {
        return new Provider.ProviderModel(modelId, contextTokens);
    }
}
