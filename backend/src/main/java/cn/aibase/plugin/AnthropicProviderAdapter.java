package cn.aibase.plugin;

import cn.aibase.provider.domain.Provider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Anthropic 兼容协议适配器：向 {baseUrl}/v1/messages 发送最小化请求验证配置。
 */
@Slf4j
@Component
public class AnthropicProviderAdapter implements ProviderAdapter {

    private static final int TIMEOUT_SECONDS = 10;

    @Override
    public String type() {
        return "ANTHROPIC_COMPATIBLE";
    }

    @Override
    public ConnectionTestResult test(Provider provider) {
        String url = provider.getBaseUrl().replaceAll("/+$", "") + "/v1/messages";
        long start = System.currentTimeMillis();
        try {
            String body = """
                    {"model":"%s","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}
                    """.formatted(effectiveModel(provider));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", provider.getApiKey())
                    .header("anthropic-version", "2023-06-01")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                    .build();
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            long latency = System.currentTimeMillis() - start;
            int code = response.statusCode();
            if (code == 200 || code == 201) {
                return new ConnectionTestResult(true, "连接成功", latency);
            }
            if (code == 400) {
                return new ConnectionTestResult(true, "连接成功（密钥有效）", latency);
            }
            if (code == 401 || code == 403) {
                return new ConnectionTestResult(false, "认证失败（HTTP " + code + "）", latency);
            }
            return new ConnectionTestResult(false, "API 返回 HTTP " + code, latency);
        } catch (Exception ex) {
            long latency = System.currentTimeMillis() - start;
            String msg = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
            return new ConnectionTestResult(false, "连接失败：" + msg, latency);
        }
    }

    private String effectiveModel(Provider provider) {
        if (provider.getDefaultModel() != null && !provider.getDefaultModel().isBlank()) {
            return provider.getDefaultModel();
        }
        return provider.getModels().isEmpty() ? "claude-sonnet-4-5" : provider.getModels().get(0).modelId();
    }
}
