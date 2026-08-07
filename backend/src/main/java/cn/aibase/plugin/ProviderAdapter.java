package cn.aibase.plugin;

import cn.aibase.provider.domain.Provider;

/**
 * 供应商协议适配器 SPI：连接测试与（未来）模型调用的协议实现。
 *
 * <p>扩展点：实现本接口并注册为 Spring Bean（类路径插件），或将实现类打入外部插件
 * jar 放入 {@code plugins/} 目录（由 PluginManager 加载）。{@link #type()} 返回
 * 协议类型名（如 {@code OPENAI_COMPATIBLE}），与 providers.providerType 对应。</p>
 */
public interface ProviderAdapter {

    /**
     * 本适配器支持的协议类型名，如 OPENAI_COMPATIBLE / ANTHROPIC_COMPATIBLE。
     */
    String type();

    /**
     * 执行连接测试。
     *
     * @param provider 已解密的供应商配置（apiKey 为明文）
     * @return 测试结果，message 用于展示原因
     */
    ConnectionTestResult test(Provider provider);

    /**
     * 连接测试结果。
     */
    record ConnectionTestResult(boolean success, String message, Long latencyMs) {
    }
}
