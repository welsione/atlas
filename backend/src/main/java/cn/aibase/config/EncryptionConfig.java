package cn.aibase.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-GCM 加密器：API Key 等敏感配置的加解密。
 *
 * <p>密钥来源：配置 {@code aibase.encryption-key}（Base64 编码 32 字节）。
 * 未配置时使用内置开发密钥（仅限本地开发，生产必须注入）。</p>
 */
@Slf4j
@Configuration
@EnableConfigurationProperties(AIBaseProperties.class)
public class EncryptionConfig {

    private static final byte[] DEV_KEY = {
            0x2b, 0x7e, 0x15, 0x16, 0x28, (byte) 0xae, (byte) 0xd2, (byte) 0xa6,
            (byte) 0xab, (byte) 0xf7, 0x15, (byte) 0x88, 0x09, (byte) 0xcf, 0x4f, 0x3c,
            (byte) 0x8a, 0x2d, 0x10, 0x11, 0x3f, 0x6c, 0x52, 0x1d,
            0x77, (byte) 0x94, (byte) 0xef, 0x33, (byte) 0xa5, 0x02, 0x59, 0x4e
    };

    @Bean
    public AesEncryptor aesEncryptor(AIBaseProperties properties) {
        byte[] key = DEV_KEY;
        if (properties.getEncryptionKey() != null && !properties.getEncryptionKey().isBlank()) {
            key = Base64.getDecoder().decode(properties.getEncryptionKey());
        } else {
            log.warn("未配置 aibase.encryption-key，使用内置开发密钥（生产环境必须通过 AIBASE_ENC_KEY 注入）");
        }
        if (key.length != 32) {
            throw new IllegalStateException("aibase.encryption-key 必须是 Base64 编码的 32 字节密钥");
        }
        return new AesEncryptor(key);
    }

    /**
     * AES-256-GCM 加解密实现（随机 IV 前置，密文格式 iv + ciphertext）。
     */
    public static class AesEncryptor {

        private static final String TRANSFORMATION = "AES/GCM/NoPadding";
        private static final int IV_LENGTH = 12;
        private static final int TAG_BITS = 128;

        private final SecretKeySpec keySpec;
        private final SecureRandom random = new SecureRandom();

        public AesEncryptor(byte[] key) {
            this.keySpec = new SecretKeySpec(key, "AES");
        }

        public String encrypt(String plain) {
            try {
                byte[] iv = new byte[IV_LENGTH];
                random.nextBytes(iv);
                Cipher cipher = Cipher.getInstance(TRANSFORMATION);
                cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_BITS, iv));
                byte[] ciphertext = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
                byte[] combined = new byte[IV_LENGTH + ciphertext.length];
                System.arraycopy(iv, 0, combined, 0, IV_LENGTH);
                System.arraycopy(ciphertext, 0, combined, IV_LENGTH, ciphertext.length);
                return Base64.getEncoder().encodeToString(combined);
            } catch (Exception ex) {
                throw new IllegalStateException("API Key 加密失败", ex);
            }
        }

        public String decrypt(String encrypted) {
            try {
                byte[] combined = Base64.getDecoder().decode(encrypted);
                byte[] iv = new byte[IV_LENGTH];
                System.arraycopy(combined, 0, iv, 0, IV_LENGTH);
                Cipher cipher = Cipher.getInstance(TRANSFORMATION);
                cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_BITS, iv));
                byte[] plain = cipher.doFinal(combined, IV_LENGTH, combined.length - IV_LENGTH);
                return new String(plain, StandardCharsets.UTF_8);
            } catch (Exception ex) {
                throw new IllegalStateException("API Key 解密失败", ex);
            }
        }
    }
}
