# Atlas — 全 TS 插件化 AI 服务基础平台

以应用为核心的多租户平台：数据集版本化分发（PUBLIC/INTERNAL/SECRET + 信封加密）、插件体系（前后端一体打包、目录热加载）、接口监控、运维台工作日志。

## 技术栈

- **全 TypeScript**：后端 NestJS + better-sqlite3（关系表 + JSON 列 + JSON1）+ node:crypto，前端 Vue 3 + Element Plus + Vite
- Node 22+（外部插件可直接写 `.ts` 运行，无需编译）
- npm workspaces monorepo

## 目录结构

```
packages/
  types/      # 共享 DTO + 插件 SPI 契约（@atlas/types）
  core/       # NestJS 后端：应用/凭证/插件引擎/数据集/安全/运维台
  web/        # 前端：控制台/应用管理/应用空间/插件注册表/运维台
  plugins/    # 内置插件（providers/prompts/model-files/monitor，workspace 包）
data/
  plugins/    # 外部插件目录（运行时热加载）
```

## 快速开始

```bash
npm install
npm run build:web        # 前端构建
npm run sync:static      # 产物同步到 core/static
npm run dev              # 后端（http://127.0.0.1:18081）
```

测试：`npm test`（后端 Jest，13 用例）。

## 核心概念

### 应用空间（一级实体）
一切数据挂靠在应用上：插件实例、数据集、敏感凭证、审计。创建应用自动实例化全部已注册插件；`app_id + app_secret`（SHA-256，仅创建/轮换时展示一次）换短时效令牌（`POST /api/v1/app/auth`），吊销即时生效。

### 插件（前后端一体）

**目录插件**（内置/外部同一形态）：

```
data/plugins/weather/
  manifest.json    # {pluginType, name, description, version, defaultDataScope, entry}
  index.ts         # export default: AibasePlugin（Node 22 type-stripping 直接运行）
  ui/              # manifest.json（slots: app-space Tab / console 卡片）+ entry.<hash>.js
```

- **热加载**：目录内容哈希扫描（约 10 秒），更新自动热替换（cache-busting 绕过模块缓存）、删除热卸载（数据保留）
- **运行时契约**：`PluginEnvironment` 提供 `store()`（通用存储）/ `datasets()`（版本化发布）/ `ops()`（运维台工作日志）/ `config()` / `info|warn|error` / `instance()`
- **声明式端点**：`/api/apps/{appId}/plugins/{type}/ep/{path}`（热注册/热注销）
- **UI 契约**：entry 为 ESM，`export default { mount(el, ctx) → unmount }`；运行时依赖（vue/element-plus/icons/`@aibase/runtime`）由平台 import map 提供单实例，插件不打包
- 数据隔离由插件声明，实例可单向覆盖（SHARED→LOCAL，反向禁止）
- 内置插件类型为保留字；内置插件为平台可信组件（业务在 core），外部插件隔离运行

### 数据集（版本化数据分发）
内容哈希驱动版本，应用轮询 meta、变化才下载（304）：

| 级别 | 访问 | 存储 |
|---|---|---|
| PUBLIC | token 直达（防穷举） | 明文 |
| INTERNAL | Bearer 应用令牌 + 白名单 | 明文 |
| SECRET | 令牌 + 逐项授权 + 审计 | **信封加密**（KEK=AIBASE_ENC_KEY → 每数据集随机 DEK → AES-256-GCM），明文永不落库 |

刷新：手动或定时（SCHEDULED，插件 `datasetSource()` 重渲染）。

### 控制台 / 运维台
- **控制台**（默认首页）：统计卡片 + 插件注册的 console slot 卡片
- **运维台**：跨应用工作日志（`ops_logs`），插件经 `env.ops()` 写入；按应用/插件/级别过滤 + 24h 趋势

## 配置（环境变量）

| 变量 | 说明 |
|---|---|
| `AIBASE_PORT` | 端口（默认 18081） |
| `AIBASE_DATA_DIR` | 数据目录（默认 ./data；外部插件在 data/plugins/） |
| `AIBASE_ENC_KEY` | 数据集信封加密 KEK（SECRET 级必配） |
| `AIBASE_ADMIN_PASSWORD` | 管理登录密码（与 KEY 均未配置时管理接口开放，仅限本地开发） |
| `AIBASE_ADMIN_KEY` | 固定管理 Token（请求头 X-AIBase-Key） |
| `AIBASE_PLUGIN_SCAN_INTERVAL_MS` | 插件扫描间隔（默认 10000） |

## 主要 API

- 管理面：`/api/apps`（应用 CRUD/凭证轮换吊销）、`/api/plugins`（注册表/卸载）、`/api/apps/{appId}/plugins/...`（实例与内置插件数据）、`/api/apps/{appId}/datasets/...`、`/api/ops/...`（运维台）
- 数据面（公开）：`/api/v1/app/auth`（令牌换发）、`/api/v1/datasets/{token}/meta|data|secrets`、`/api/files/{token}/meta|download`（模型文件公开下载）
- 插件 UI：`/api/plugins/ui`（清单，管理认证）、`/_pluginui/{type}/{path}`（资源，公开）
