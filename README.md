# AIBase

AI 服务基础组件：**服务商配置管理** 与 **提示词管理** 的通用基础服务。

每次开发 AI 服务都要管理服务商配置（Base URL / API Key / 模型 / 图标 / 上下文窗口）与提示词模板——AIBase 把这两件事做成开箱即用的独立服务：

- **供应商管理**：CRUD、API Key AES-256 加密存储、模型列表与上下文窗口、Anthropic/OpenAI 兼容连接测试、内置主流国产厂商预设（DeepSeek / MiniMax / 火山引擎 / 硅基流动 / 智谱 / Kimi）
- **提示词管理**：模板 CRUD、分类、`{{变量}}` 占位与渲染预览、编辑自动归档版本历史、渲染插件管道
- **插件扩展**：`ProviderAdapter`（新协议适配）与 `PromptProcessor`（内容处理管道）双 SPI，外部 jar 即插即用
- **零依赖部署**：内嵌 SQLite 单文件数据库 + 单容器镜像，前端打包于后端 jar 内

## 技术栈

- 后端：Java 17 / Spring Boot 3.3 / SQLite（Xerial JDBC）
- 前端：Vue 3 / TypeScript / Element Plus / Vite
- 部署：Docker 多阶段构建 → GHCR 镜像 → 服务器 docker compose

## 快速开始

### 本地开发

```bash
# 后端（默认端口 18081，SQLite 落在 backend/data/）
cd backend
mvn spring-boot:run

# 前端（dev 端口 5181，代理 /api 到 18081）
cd frontend/web
npm install
npm run dev
```

打开 http://localhost:5181 即可使用。

### Docker 部署

```bash
docker build -t aibase .
docker run -p 18081:18081 -e AIBASE_ENC_KEY=$(openssl rand -base64 32) -v aibase-data:/app/data aibase
```

首次启动自动初始化数据库，并写入 8 个主流厂商预设（API Key 留空，配置后启用）。

## API 概览

| 端点 | 说明 |
|---|---|
| `GET/POST /api/providers` | 供应商列表 / 创建 |
| `PUT/DELETE /api/providers/{id}` | 更新 / 删除 |
| `POST /api/providers/{id}/test` | 连接测试（已保存配置） |
| `POST /api/providers/test` | 连接测试（未保存表单配置） |
| `GET/POST /api/prompts` | 提示词列表 / 创建 |
| `PUT/DELETE /api/prompts/{id}` | 更新（内容变化自动归档版本）/ 删除 |
| `POST /api/prompts/{id}/render` | 渲染（`{{变量}}` 替换 + 插件管道） |
| `GET /api/prompts/{id}/versions` | 版本历史 |
| `GET /api/plugins` | 已注册适配器 / 处理器 / 外部 jar |

## 插件开发

实现 SPI 接口，声明在 `META-INF/services`，打包 jar 放入数据目录 `plugins/`，重启生效：

```java
// 新协议适配（如 Gemini、自定义网关）
public class GeminiAdapter implements ProviderAdapter {
    public String type() { return "GEMINI_COMPATIBLE"; }
    public ConnectionTestResult test(Provider provider) { /* ... */ }
}

// 内容处理管道（如敏感信息脱敏、压缩）
public class RedactProcessor implements PromptProcessor {
    public String name() { return "redact"; }
    public String process(String content, Map<String, String> variables) { /* ... */ }
}
```

类路径实现（Spring Bean）在启动时自动注册；`plugins/` 目录中的 jar 通过 ServiceLoader 加载。

## 配置

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `AIBASE_PORT` | `18081` | HTTP 端口 |
| `AIBASE_DATA_DIR` | `./data` | 数据目录（SQLite 文件 + plugins/） |
| `AIBASE_ENC_KEY` | 内置开发密钥 | API Key 加密密钥（Base64 32 字节），**生产必须设置** |

## 开源说明

- 图标资源参考 [cc-switch](https://github.com/felippe-regazio/cc-switch)（MIT, © Jason Young）
- 预设模型上下文窗口数据参考 [models.dev](https://models.dev)（OpenRouter 开源模型数据库）
- 本仓库采用 MIT 许可证
