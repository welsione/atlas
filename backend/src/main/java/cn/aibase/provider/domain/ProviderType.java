package cn.aibase.provider.domain;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

/**
 * 供应商协议类型：决定模型创建与连接测试的适配策略。
 *
 * <p>新增协议类型由插件通过 {@code ProviderAdapter} 扩展，注册时返回自定义类型名。</p>
 */
@Getter
@AllArgsConstructor
public enum ProviderType {

    OPENAI_COMPATIBLE("OpenAI 兼容"),
    ANTHROPIC_COMPATIBLE("Anthropic 兼容");

    private final String label;
}
