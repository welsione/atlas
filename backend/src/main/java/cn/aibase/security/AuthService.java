package cn.aibase.security;

import cn.aibase.config.AIBaseProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;

/**
 * 管理认证服务：登录签发 HMAC 签名 token，双通道校验（Bearer token / X-AIBase-Key）。
 *
 * <p>配置：{@code AIBASE_ADMIN_PASSWORD}（登录密码）与 {@code AIBASE_ADMIN_KEY}（固定管理 Token）；
 * 两者均未配置时管理接口开放（本地开发模式，启动打 WARN）。</p>
 */
@Slf4j
@Service
public class AuthService {

    /** token 有效期（毫秒）。 */
    private static final long TOKEN_TTL_MS = 12 * 60 * 60 * 1000L;

    private final AIBaseProperties properties;
    private final byte[] hmacKey;

    public AuthService(AIBaseProperties properties) {
        this.properties = properties;
        this.hmacKey = deriveKey(properties.getEncryptionKey());
        if (!authEnabled()) {
            log.warn("未配置 AIBASE_ADMIN_PASSWORD / AIBASE_ADMIN_KEY，管理接口未启用认证（仅限本地开发，生产必须设置）");
        }
    }

    /** 管理认证是否启用。 */
    public boolean authEnabled() {
        return notBlank(properties.getAdminPassword()) || notBlank(properties.getAdminKey());
    }

    /** 校验登录密码。 */
    public boolean verifyPassword(String password) {
        String expected = properties.getAdminPassword();
        return notBlank(expected) && MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                (password == null ? "" : password).getBytes(StandardCharsets.UTF_8));
    }

    /** 签发登录 token（payload=过期时间戳，HMAC-SHA256 签名）。 */
    public String issueToken() {
        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(String.valueOf(System.currentTimeMillis() + TOKEN_TTL_MS)
                        .getBytes(StandardCharsets.UTF_8));
        String sig = sign(payload);
        return payload + "." + sig;
    }

    /** 校验 Bearer token。 */
    public boolean verifyToken(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        int dot = token.indexOf('.');
        if (dot <= 0) {
            return false;
        }
        String payload = token.substring(0, dot);
        String sig = token.substring(dot + 1);
        if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.UTF_8),
                sig.getBytes(StandardCharsets.UTF_8))) {
            return false;
        }
        try {
            long exp = Long.parseLong(new String(
                    Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8));
            return exp > System.currentTimeMillis();
        } catch (Exception ex) {
            return false;
        }
    }

    /** 校验固定管理 Token（X-AIBase-Key 头）。 */
    public boolean verifyAdminKey(String key) {
        String expected = properties.getAdminKey();
        return notBlank(expected) && MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                (key == null ? "" : key).getBytes(StandardCharsets.UTF_8));
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacKey, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("token 签名失败", ex);
        }
    }

    /** HMAC 密钥：由加密密钥派生（32 字节）。 */
    private byte[] deriveKey(String encryptionKey) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return md.digest((encryptionKey == null ? "aibase-auth" : encryptionKey)
                    .getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("认证密钥派生失败", ex);
        }
    }

    private boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
