package cn.aibase;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * AIBase 启动入口。
 *
 * <p>AI 服务基础组件：服务商配置管理（Provider）与提示词管理（Prompt），
 * 内嵌 SQLite 零依赖部署，前端静态资源打包于 classpath:/static。</p>
 */
@SpringBootApplication
public class AIBaseApplication {

    public static void main(String[] args) {
        SpringApplication.run(AIBaseApplication.class, args);
    }
}
