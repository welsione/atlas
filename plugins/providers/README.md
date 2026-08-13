# 供应商管理（`providers`）

AI 供应商管理插件：维护 OpenAI/Anthropic 兼容接口、API Key 加密落库、模型快速选择与图标管理，并向其他插件暴露 `model-gateway` 对话网关能力。

## 元信息

| 字段 | 值 |
|------|-----|
| type | `providers`（全局唯一，与 `manifest.json.pluginType` 一致） |
| 版本 | `1.0.0`（与 `manifest.json.version` 一致） |
| 数据作用域 | `GLOBAL_SHARED`（与 `manifest.json.defaultDataScope` 一致） |
| 作用域覆盖 | 是（`scopeOverrideAllowed`，仅允许 SHARED → LOCAL） |
| 插件目录 | `plugins/providers/` |

## 插件作用

- **供应商配置**：每个供应商同时维护 OpenAI 兼容与 Anthropic 兼容接口（一般以 BaseUrl 区分），API Key 用 `env.crypto()` 加密后分别存储。
- **模型快速选择**：内置 models.dev 精简版模型参考库（`data/model-reference.json`），支持从 models.dev 远端刷新；供应商可挂接模型清单。
- **图标管理**：内置 `icons/vendors/`（来源 cc-switch）+ 自定义上传（store 存储，SVG 消毒，≤64KB，总数 ≤20）。
- **能力暴露**：通过 `provides()` 暴露 `model-gateway` 命名空间，供其他插件经 `env.spi()` 直接调用 OpenAI 兼容供应商完成对话（密钥由本插件保管，消费方无需感知）。
- **典型场景**：平台侧配置供应商/密钥，供模型网关与各应用统一取用。

## 版本信息

| 版本 | 说明 |
|------|------|
| 1.0.0 | 首个版本：双兼容接口（OpenAI + Anthropic）、API Key 加密、模型参考库、图标上传、`model-gateway` SPI 暴露 |

> 版本演进维护约定：新增能力 / 破坏性变更 bump `manifest.json.version` 并在本表追加一行。

## 系统 SPI（平台能力使用情况）

- **通用能力**：
  - `env.store()` —— 供应商数据（`providers`）、模型参考缓存（`model-reference`）、自定义图标（`custom-icons`）。
  - `env.crypto()` —— API Key 加密落库 / 解密后发起调用。
  - `env.datasets()` —— 发布 `providers-config` SECRET 数据集：`secrets` 同步明文 Key、`assets`/`assetSource` 暴露图标。
  - `env.config()` —— 读取 `exposeApiKey` 开关（决定 `config` 端点是否含明文 Key）。
  - `env.ops()` / `env.info()/warn()` —— 供应商/图标增删改审计、连接测试与调用记录。
- **能力门面**：无。
- **事件订阅**：无。
- **声明式接入**：
  - `schema.sql` —— 建 `providers` 表（历史遗留关系表，当前数据走 plugin_store，保留兼容旧库）。
  - `cleanupTables()` —— 应用删除时级联清理 `providers` 表 `app_id` 行（NULL=全局共享保留）。

## 提供的 SPI（双向 SPI）

| 命名空间 | 版本 | 能力说明 | 消费方式 |
|----------|------|----------|----------|
| `model-gateway` | `1.0.0` | OpenAI 兼容供应商对话网关：`listProviders()` 列供应商（不含明文 Key）、`chat()` 调用 `/chat/completions`（240s 超时，返回 content/model/usage） | `env.spi<ModelGatewaySpi>('providers', 'model-gateway')` |

> 能力接口类型定义在 `packages/types/src/spi/model-gateway.ts`，消费方据此获得类型安全。

## 端点（endpoints）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `list` | 供应商列表（密钥脱敏，管理面） |
| GET | `config` | 对外配置（数据面/应用凭证访问；`exposeApiKey` 开关控制是否含明文 Key） |
| POST | `create` | 新增供应商（至少配置一个接口 BaseUrl） |
| PUT | `update/{id}` | 更新供应商（全字段） |
| DELETE | `delete/{id}` | 删除供应商 |
| POST | `test` | 连接测试（`compat=openai\|anthropic`，用已存密钥） |
| GET | `reference/providers` | 模型参考库：供应商列表 |
| POST | `reference/search` | 模型参考库：搜索模型 |
| POST | `reference/refresh` | 模型参考库：从 models.dev 拉取最新并缓存 |
| GET | `icons/list` | 图标清单（内置 + 自定义） |
| POST | `icons/upload` | 上传自定义图标（SVG，≤64KB，消毒） |
| DELETE | `icons/{name}` | 删除自定义图标（内置图标不可删） |

外部调用地址：`/api/apps/{appId}/plugins/providers/ep/{path}`

## 前端 UI（可选）

- `app-space`（应用空间 Tab「供应商」）—— 供应商列表、双兼容接口配置、密钥管理、模型选择、图标上传与连接测试。

## 开发与构建

```bash
# 前端面板改动后重建
cd ui-src && npm install && npm run ui:build   # → ../ui/（构建产物随仓库提交）

# 后端改动无需编译，Node 22 type-stripping 直接运行；等待约 10s 热重载
```

> 完整插件开发规范见 [`docs/plugin-development.md`](../../docs/plugin-development.md)。
