<p align="center">
  <img src="packages/web/public/icons/atlas.svg" width="48" height="48" alt="Atlas Logo" style="vertical-align: middle" />
  <strong style="vertical-align: middle; font-size: 1.5em">Atlas</strong>
</p>

<h2 align="center">全 TS 插件化 AI 服务基础平台</h2>

[![CI](https://github.com/welsione/atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/welsione/atlas/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](CHANGELOG.md)

以应用为核心的多租户平台：数据集版本化分发（PUBLIC/INTERNAL/SECRET + 信封加密）、插件体系（前后端一体打包、目录热加载）、接口监控、运维台工作日志。

> **参与贡献**：[贡献指南](CONTRIBUTING.md) · [行为准则](CODE_OF_CONDUCT.md) · [安全策略](SECURITY.md) · [变更日志](CHANGELOG.md)

## 技术栈

- **全 TypeScript**：后端 NestJS + better-sqlite3（关系表 + JSON 列 + JSON1）+ node:crypto，前端 Vue 3 + Element Plus + Vite
- Node 22+（外部插件可直接写 `.ts` 运行，无需编译）
- npm workspaces monorepo

## 目录结构

```text
packages/
  types/      # 共享 DTO + 插件 SPI 契约（@atlas/types）
  core/       # NestJS 后端：应用/凭证/插件引擎/数据集/安全/运维台
  web/        # 前端：控制台/应用管理/应用空间/插件注册表/运维台
plugins/
  providers/ prompts/ model-files/ machine-monitor/   # 目录插件（前后端一体）
  template/   # 插件模板（加载器恒跳过）
data/
  plugins/    # 外部插件目录（运行时热加载，ATLAS_PLUGINS_DIR 可覆盖）
```

## 快速开始

```bash
npm install
npm run build:web        # 前端构建
npm run sync:static      # 前端构建产物同步到 core/static 与 core/dist/static（运行中服务生效）
npm run dev              # 后端（http://127.0.0.1:18081）
```

测试：`npm test`（后端 Jest，13 用例）。

## 核心概念

### 应用空间（一级实体）

一切数据挂靠在应用上：插件实例、数据集、敏感凭证、审计。创建应用自动实例化全部已注册插件；`app_id + app_secret`（SHA-256，仅创建/轮换时展示一次）换短时效令牌（`POST /api/v1/app/auth`），吊销即时生效。

### 插件（前后端一体）

**目录插件**（无内置概念，全部从仓库根 `plugins/` 加载，`ATLAS_PLUGINS_DIR` 可覆盖；`template` 目录被加载器跳过）：

```text
plugins/weather/
  manifest.json    # {pluginType, name, description, version, defaultDataScope, icon, entry}
  icons/           # 插件图标（manifest.icon 相对路径指向这里，可选）
  src/index.ts     # export default: AtlasPlugin（Node 22 type-stripping 直接运行）
  ui/              # manifest.json（slots: app-space Tab / console 卡片）+ entry.<hash>.js
  ui-src/          # 前端面板源码（npm run ui:build → ui/）
```

- **热加载**：目录内容哈希扫描（约 10 秒），更新自动热替换（cache-busting 绕过模块缓存）、删除热卸载（数据保留）
- **图标**：manifest `icon` 声明（相对路径 `icons/x.svg` / data URI / http URL），应用空间 Tab、插件实例表格、插件注册表、控制台卡片统一展示；图标文件经 `/_pluginui/{type}/icons/` 平台服务（防穿越）
- **运行时契约**：`PluginEnvironment` 提供 `store()`（通用存储）/ `files()`（文件存储 + 公开托管）/ `crypto()`（插件派生密钥加密）/ `datasets()`（版本化发布）/ `ops()`（运维台工作日志）/ `config()` / `info|warn|error` / `instance()`
- **声明式端点**：`/api/apps/{appId}/plugins/{type}/ep/{path}`（热注册/热注销，支持 `{param}`、multipart 上传、二进制下载）
- **UI 契约**：entry 为 ESM，`export default { mount(el, ctx) → unmount }`；运行时依赖（vue/element-plus/icons/`@atlas/runtime`）由平台提供单实例，插件不打包。slot 分三类：`app-space` 应用空间 Tab、`console` 控制台卡片、`system-menu` 系统级侧边菜单（全局插件面板，无应用上下文）
- 数据隔离由插件声明，实例可单向覆盖（SHARED→LOCAL，反向禁止）
- **系统级插件**：`GLOBAL_SHARED` 作用域 + `system-menu` slot，菜单挂在主侧边栏；如 machine-monitor（部署机器性能监控，控制台卡片 + 侧边菜单详情面板）
- **插件开发**：复制 `plugins/template/` 起步，完整规范见 [docs/plugin-development.md](docs/plugin-development.md)（含 SPI 契约、env API、UI slot、安全规范、FAQ）

### 数据集（版本化数据分发）

内容哈希驱动版本：内容变更才 bump 版本，消费方轮询 meta、变化才下载（`If-None-Match` → 304 免流量）。

#### 密级与访问控制

| 级别 | 访问 | 存储 |
|---|---|---|
| PUBLIC | token 直达（防穷举） | 明文 |
| INTERNAL | Bearer 应用令牌 + 白名单授权 | 明文 |
| SECRET | 令牌 + 逐项授权 + **每次访问审计** | **信封加密**（KEK=ATLAS_ENC_KEY → 每数据集随机 DEK → AES-256-GCM），明文永不落库 |

外部访问统一走数据面 `/api/v1/datasets/{token}/...`（公开前缀，无需平台登录）：

| 端点 | 说明 |
|---|---|
| `GET /meta` | 元信息（名称/敏感度/版本/内容哈希/资产数/更新时间） |
| `GET /data` | 内容 JSON（ETag/304、限流、审计） |
| `GET /secrets` | SECRET 级敏感凭证（Bearer + 白名单，逐次审计，明文取用） |
| `GET /assets/{path}` | 文件资产下载（同密级鉴权，Content-Type/ETag，文本类自动 `charset=utf-8`） |

匿名访问 meta 各密级均开放；data/assets 按密级鉴权（PUBLIC 直达，INTERNAL/SECRET 需 Bearer 应用令牌且消费方应用在授权白名单内）；secrets 仅 SECRET 级。应用空间可对数据集做「跨应用授权」（grants）、撤销与审计查看。

#### 资产（文件数据）

数据集除 JSON 内容外可携带文件资产（`assets_json` 清单 + 下载端点），密级管理/授权/审计与内容完全一致：

- **手动数据集**：管理面 `POST/DELETE /api/apps/{appId}/datasets/{id}/assets` 上传/删除（multipart 或 base64，单文件 ≤64MB），磁盘存储于 `{dataDir}/dataset-files/{datasetId}/`
- **插件注册数据集**：插件声明 `assets()` 清单 + `assetSource()` 懒加载字节（core 不落盘，如供应商图标读插件目录、模型文件经 `env.files()`），内容即时生效

#### 插件注册数据集

插件通过 `AtlasPlugin.datasets()` 声明数据集（如供应商配置、模型文件），平台在实例启用/启动补同步时自动创建并持续维护：

- **管理面内容锁定**：不可删除、不可编辑内容/名称（交由插件管理），仅可调整敏感度（密级管理）；授权白名单、审计查看保留
- 内容（`render`）、敏感凭证（`secrets`，SECRET 级自动同步/停用）、资产清单（`assets`）均由插件声明，数据变更后 `env.datasets().refresh(key)` 即时同步

#### 手动数据集管理（应用空间 → 数据集）

新建/管理抽屉：名称/描述/内容 JSON 编辑、敏感度调整、文件上传、访问方式（URL + curl 示例一键复制）、刷新、删除。刷新模式 `MANUAL`（手动）或 `SCHEDULED`（定时，插件渲染源）。

### 控制台 / 运维台

- **控制台**（默认首页）：统计卡片 + 插件注册的 console slot 卡片；侧边栏渲染系统级插件（system-menu slot）菜单项
- **运维台**：跨应用工作日志（`ops_logs`），插件经 `env.ops()` 写入；按应用/插件/级别过滤 + 24h 趋势

## 配置（环境变量）

| 变量 | 说明 |
|---|---|
| `ATLAS_PORT` | 端口（默认 18081） |
| `ATLAS_DATA_DIR` | 数据目录（默认 ./data） |
| `ATLAS_PLUGINS_DIR` | 插件目录（默认仓库根 plugins/） |
| `ATLAS_ENC_KEY` | 数据集信封加密 KEK（SECRET 级必配） |
| `ATLAS_ADMIN_PASSWORD` | 管理登录密码（与 KEY 均未配置时管理接口开放，仅限本地开发） |
| `ATLAS_ADMIN_KEY` | 固定管理 Token（请求头 X-Atlas-Key） |
| `ATLAS_PLUGIN_SCAN_INTERVAL_MS` | 插件扫描间隔（默认 10000） |

## 主要 API

- 管理面：`/api/apps`（应用 CRUD/凭证轮换吊销）、`/api/plugins`（注册表/卸载）、`/api/apps/{appId}/plugins/...`（实例与内置插件数据）、`/api/apps/{appId}/datasets...`（数据集 CRUD/敏感度/内容/资产上传删除/授权/审计/刷新）、`/api/ops/...`（运维台）
- 数据面（公开）：`/api/v1/app/auth`（应用凭证换令牌）、`/api/v1/datasets/{token}/meta|data|secrets|assets/{path}`（数据集消费）、`/api/v1/app/{appId}/plugins/{type}/ep/{path}`（插件数据面网关，应用凭证 Bearer 鉴权）、`/api/files/{token}/meta|download`（插件文件公开托管下载）
- 插件 UI：`/api/plugins/ui`（清单，管理认证）、`/_pluginui/{type}/{path}`（资源，公开）

## 仓库运维

仓库自动化运维套件（release-please 发布、opencode AI 审查、Dependabot、markdownlint/commitlint 门禁等）见 [docs/repository-ops.md](docs/repository-ops.md)；贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
sync
