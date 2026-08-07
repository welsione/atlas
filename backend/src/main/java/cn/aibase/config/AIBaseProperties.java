package cn.aibase.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AIBase 顶层配置属性。
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "aibase")
public class AIBaseProperties {

    /** API Key 加密密钥（Base64 编码 32 字节 AES-256 密钥）；为空时使用内置开发密钥并告警。 */
    private String encryptionKey = "";

    /** 数据根目录：SQLite 文件与外部插件目录的根。 */
    private String dataDir = "./data";

    /** 管理登录密码（设置后管理接口需登录认证）。 */
    private String adminPassword = "";

    /** 固定管理 Token（X-AIBase-Key 头，脚本调用场景）。 */
    private String adminKey = "";
}
