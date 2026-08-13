# 提示词管理（`prompts`）

提示词模板管理插件：维护提示词模板、变量声明与渲染、版本历史，每个应用独立数据。

## 元信息

| 字段 | 值 |
|------|-----|
| type | `prompts`（全局唯一，与 `manifest.json.pluginType` 一致） |
| 版本 | `1.0.0`（与 `manifest.json.version` 一致） |
| 数据作用域 | `APP_LOCAL`（与 `manifest.json.defaultDataScope` 一致） |
| 作用域覆盖 | 否（`scopeOverrideAllowed` 未声明） |
| 插件目录 | `plugins/prompts/` |

## 插件作用

- **模板管理**：提示词的增删改查、分类（默认 `default`）、启用开关与排序。
- **变量渲染**：声明变量（名称/描述/必填），`render` 端点按 `{{变量名}}` 占位渲染，必填缺失项返回 `missingVariables`。
- **版本历史**：内容变更自动版本 +1，保留最近 10 条历史（`MAX_HISTORY`），支持从任意历史版本恢复（生成新版本）。
- **典型场景**：应用内集中管理可复用的提示词模板，供对话/生成流程按变量渲染取用。

## 版本信息

| 版本 | 说明 |
|------|------|
| 1.0.0 | 首个版本：模板 CRUD、分类、变量渲染、版本历史与恢复、删除/更新审计 |

> 版本演进维护约定：新增能力 / 破坏性变更 bump `manifest.json.version` 并在本表追加一行。

## 系统 SPI（平台能力使用情况）

- **通用能力**：
  - `env.store()` —— 提示词数据（entity_key=`prompts`，单条 JSON 数组整体存储）。
  - `env.ops()` / `env.info()` —— 增删改审计（`新增/更新/恢复/删除`）。
- **能力门面**：无。
- **事件订阅**：无。
- **声明式接入**：
  - `schema.sql` —— 建 `prompts` 与 `prompt_versions` 表（历史遗留关系表，当前数据走 plugin_store，保留兼容旧库）。
  - `cleanupTables()` —— 应用删除时级联清理 `prompts` 表 `app_id` 行（`prompt_versions` 无 app_id 列，历史遗留表不单独清理）。

## 提供的 SPI（双向 SPI）

本插件未通过 `provides()` 暴露能力。

## 端点（endpoints）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `list` | 提示词列表 |
| GET | `categories` | 分类列表 |
| POST | `create` | 新增提示词 |
| PUT | `update/{id}` | 更新提示词（内容变更版本 +1） |
| POST | `restore/{id}` | 从历史版本恢复（生成新版本） |
| DELETE | `delete/{id}` | 删除提示词 |
| POST | `render/{id}` | 变量占位渲染 |
| GET | `versions/{id}` | 版本历史 |

外部调用地址：`/api/apps/{appId}/plugins/prompts/ep/{path}`

## 前端 UI（可选）

- `app-space`（应用空间 Tab「提示词」）—— 模板列表、分类过滤、编辑与变量配置、版本历史浏览与恢复、渲染预览。

## 开发与构建

```bash
# 前端面板改动后重建
cd ui-src && npm install && npm run ui:build   # → ../ui/（构建产物随仓库提交）

# 后端改动无需编译，Node 22 type-stripping 直接运行；等待约 10s 热重载
```

> 完整插件开发规范见 [`docs/plugin-development.md`](../../docs/plugin-development.md)。
