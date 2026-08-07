package cn.aibase.plugin;

import java.util.Map;

/**
 * 提示词处理器 SPI：提示词内容的预处理/后处理扩展点。
 *
 * <p>扩展场景：内容压缩、格式转换、敏感信息脱敏、多语言翻译等。
 * 实现类注册为 Spring Bean，或打入外部插件 jar 由 PluginManager 加载。</p>
 */
public interface PromptProcessor {

    /**
     * 处理器唯一名称（用于展示与去重）。
     */
    String name();

    /**
     * 处理提示词内容。
     *
     * @param content   原始提示词
     * @param variables 渲染后的变量（含用户传入的变量）
     * @return 处理后的提示词；不处理时原样返回
     */
    String process(String content, Map<String, String> variables);
}
