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
 * OpenAI 兼容协议适配器：向 {baseUrl}/models 发送鉴权请求验证配置。
 */
@Slf4j
@Component
public class OpenAIProviderAdapter implements ProviderAdapter {

    private static final int TIMEOUT_SECONDS = 10;

    @Override
    public String type() {
        return "OPENAI_COMPATIBLE";
    }

    @Override
    public ConnectionTestResult test(Provider provider) {
        String url = provider.getBaseUrl().replaceAll("/+$", "") + "/models";
        long start = System.currentTimeMillis();
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bearer " + provider.getApiKey())
                    .GET()
                    .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                    .build();
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            long latency = System.currentTimeMillis() - start;
            int code = response.statusCode();
            if (code == 200) {
                return new ConnectionTestResult(true, "连接成功", latency);
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
}
