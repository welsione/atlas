# {插件名}（`{pluginType}`）

一句话定位：{插件解决什么问题、核心能力一句话}。

## 元信息

| 字段 | 值 |
|------|-----|
| type | `{pluginType}`（全局唯一，与 `manifest.json.pluginType` 一致） |
| 版本 | `{x.y.z}`（与 `manifest.json.version` 一致） |
| 数据作用域 | `APP_LOCAL` / `GLOBAL_SHARED`（与 `manifest.json.defaultDataScope` 一致） |
| 作用域覆盖 | `{是/否}`（`scopeOverrideAllowed`，仅允许 SHARED → LOCAL） |
| 插件目录 | `plugins/{pluginType}/` |

## 插件作用

- {能力一}：{说明}
- {能力二}：{说明}
- {典型场景}：{说明}

## 版本信息

| 版本 | 说明 |
|------|------|
| {x.y.z} | {当前版本变更说明；首个版本写明能力范围} |

> 版本演进维护约定：新增能力 / 破坏性变更 bump `manifest.json.version` 并在本表追加一行。

## 系统 SPI（平台能力使用情况）

{选填。列出本插件实际用到的平台 SPI；未用到的项不列。}

- **通用能力**：
  - `env.store()` —— {用途，如：键值存储业务数据}
  - `env.crypto()` —— {用途，如：API Key 加密落库}
  - `env.datasets()` —— {用途，如：发布数据集 / 同步敏感凭证}
  - `env.files()` —— {用途，如：文件读写 + publish 公开托管}
  - `env.ops()` / `env.info()/warn()` —— {用途，如：增删改审计}
  - `env.config()` —— {用途，如：读取实例配置}
- **能力门面**：{`env.apps()` / `env.monitor()` / `env.security()` / `env.platform()` 中实际用到者}
- **事件订阅**：`env.events().on(...)` —— {订阅了哪些事件、用途}
- **声明式接入**：
  - `schema.sql` —— {建了哪些表}
  - `cleanupTables()` —— {应用删除级联清理哪些表}
  - `logTables()` —— {声明哪些日志表由平台定时清理}
  - `publicUrls()` / `resourceName()` —— {如用到}

{若仅使用基础能力，写：目前仅使用 `env.store()` 等基础通用能力，未使用能力门面 / 事件 / 声明式接入。}

## 提供的 SPI（双向 SPI）

{选填。若本插件通过 `provides()` 向其他插件/内核暴露能力，列出；未暴露则不写本节。}

| 命名空间 | 版本 | 能力说明 | 消费方式 |
|----------|------|----------|----------|
| `{namespace}` | `{version}` | {能力对象做什么；密钥/权限约定} | `env.spi<{接口}>('{pluginType}', '{namespace}')` |

> 能力接口类型定义在 `packages/types/src/spi/`，消费方据此获得类型安全。

## 依赖的其他插件 SPI（选填）

{若通过 `dependsOn()` 声明了对其他插件的能力依赖，列出；否则不写本节。}

- `{pluginType}/{namespace}` —— {依赖原因}（消费方式：`env.spi(...)`）

## 端点（endpoints）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `list` | {说明} |
| POST | `create` | {说明} |

外部调用地址：`/api/apps/{appId}/plugins/{pluginType}/ep/{path}`

## 前端 UI（可选）

- {slot}（`console` 控制台卡片 / `app-space` 应用空间 Tab / `system-menu` 系统侧边菜单）—— {说明}

## 开发与构建

```bash
# 前端面板改动后重建
cd ui-src && npm install && npm run ui:build   # → ../ui/（构建产物随仓库提交）

# 后端改动无需编译，Node 22 type-stripping 直接运行；等待约 10s 热重载
```

> 约定：加载器用 `?v={hash}` 做 cache-busting，插件内 `import.meta.url` 会带 query，取相对路径必须先 `.split('?')[0]`（参考 providers 的 `loadBuiltinReference`）。

> 完整插件开发规范见 [`docs/plugin-development.md`](../../docs/plugin-development.md)。
