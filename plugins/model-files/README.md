# 模型文件（`model-files`）

模型文件管理插件：文件上传、固定下载链接（token 防穷举）、版本/内容 HASH 条件下载，每个应用独立数据。

## 元信息

| 字段 | 值 |
|------|-----|
| type | `model-files`（全局唯一，与 `manifest.json.pluginType` 一致） |
| 版本 | `1.0.0`（与 `manifest.json.version` 一致） |
| 数据作用域 | `APP_LOCAL`（与 `manifest.json.defaultDataScope` 一致） |
| 作用域覆盖 | 否（`scopeOverrideAllowed` 未声明） |
| 插件目录 | `plugins/model-files/` |

## 插件作用

- **文件上传**：支持单文件与多文件（目录）上传，multipart 或 JSON base64 两种载荷；单文件 sha256 校验与整体内容 HASH 记录。
- **固定下载链接**：`env.files().publish` 生成平台公开托管 token（`/api/files/{token}/download`，防穷举/304/限流/审计）；重新发布先撤销旧 token 防孤儿累积。
- **版本与更新**：按 `id` 或 `token` 定位更新既有条目，更新后版本 +1、下载计数清零。
- **数据集发布**：文件库整体发布为「模型文件」INTERNAL 数据集，复用数据集接口与密级管理；`assets`/`assetSource` 暴露文件字节。
- **典型场景**：应用内托管模型文件（gguf/safetensors 等），生成固定下载链接供外部按版本/HASH 取用。

## 版本信息

| 版本 | 说明 |
|------|------|
| 1.0.0 | 首个版本：上传/更新/删除、公开托管（token）、版本与 HASH、数据集发布、`logTables()` 日志清理声明 |

> 版本演进维护约定：新增能力 / 破坏性变更 bump `manifest.json.version` 并在本表追加一行。

## 系统 SPI（平台能力使用情况）

- **通用能力**：
  - `env.store()` —— 文件元数据（entity_key=`files`，单条 JSON 数组整体存储）。
  - `env.files()` —— 文件读写（实例隔离存储根）与 `publish`/`unpublish` 公开托管。
  - `env.datasets()` —— 发布 `model-files` INTERNAL 数据集（`render`/`assets`/`assetSource`）。
  - `env.ops()` / `env.info()` —— 上传/删除审计。
- **能力门面**：无。
- **事件订阅**：无。
- **声明式接入**：
  - `schema.sql` —— 建 `model_files`、`download_logs`、`upload_logs` 表（历史遗留关系表，当前数据走 plugin_store + files()，保留兼容旧库）。
  - `cleanupTables()` —— 应用删除时级联清理 `model_files` 表 `app_id` 行（`download_logs`/`upload_logs` 按 file_id 关联，历史遗留表不单独清理）。
  - `logTables()` —— 声明 `download_logs`（`downloaded_at`）与 `upload_logs`（`uploaded_at`）由 LogCleanupService 定时清理。

## 提供的 SPI（双向 SPI）

本插件未通过 `provides()` 暴露能力。

## 端点（endpoints）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `list` | 文件列表 |
| POST | `upload` | 上传文件（multipart 或 JSON base64） |
| DELETE | `delete/{id}` | 删除文件 |
| GET | `download/{id}` | 下载文件（二进制，仅单文件） |
| POST | `publish/{id}` | （重新）公开托管（仅单个文件） |

外部调用地址：`/api/apps/{appId}/plugins/model-files/ep/{path}`

## 前端 UI（可选）

- `app-space`（应用空间 Tab「模型文件」）—— 文件列表、上传（单/多文件）、版本与 HASH 展示、下载链接生成、删除。

## 开发与构建

```bash
# 前端面板改动后重建
cd ui-src && npm install && npm run ui:build   # → ../ui/（构建产物随仓库提交）

# 后端改动无需编译，Node 22 type-stripping 直接运行；等待约 10s 热重载
```

> 完整插件开发规范见 [`docs/plugin-development.md`](../../docs/plugin-development.md)。
