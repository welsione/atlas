# AGENTS.md — 项目开发指引

> 本文件面向在此仓库工作的 AI 编码代理（agent）。动手前先读本文件与对应的开发规范，遵守约定、避开已知陷阱。

## 1. 项目简介

**Atlas** —— 全 TypeScript 插件化 AI 服务基础平台：以应用为核心的多租户平台，提供数据集版本化分发（PUBLIC/INTERNAL/SECRET + 信封加密）、插件体系（前后端一体打包、目录热加载）、接口监控与运维台。

- 技术栈：后端 NestJS + better-sqlite3 + node:crypto；前端 Vue 3 + Element Plus + Vite；Node ≥ 22（插件直接运行 `.ts`）。
- 仓库形态：npm workspaces monorepo（`packages/types` + `packages/core` + `packages/web`），插件在 `plugins/` 目录。

## 2. 分支与发布规范

### 2.1 分支模型

| 分支 | 定位 | 发布行为 |
|------|------|----------|
| `master` | **默认分支 / 日常开发主线**：所有功能分支 PR 合并到这里 | 仅跑 CI，**不发布** |
| `pre-release` | 测试发布分支：预发布验证、灰度环境 | 仅跑 CI，不触发发布 |
| `release` | **产品发布分支**：唯一触发发布的分支 | 推送 → release-please 评估版本 → release PR → 合并后 tag + GitHub Release + 镜像 |
| 功能分支 | 日常开发（`feat/` `fix/` `docs/` 等） | 仅跑 CI |

### 2.2 发布流程

```text
功能分支 → 合入 master（日常开发，不发布）
        → 合入 pre-release 测试验证（可选）
        → 合入 release 正式发布（git push origin master:release 或 PR 合入）
```

- **只有 `release` 分支上的代码变动才提升版本号、构建镜像、发 release**；`master`/`pre-release` 上的提交不影响版本。
- 版本由 Conventional Commits 语义自动推断：`feat`→minor、`fix`/`perf`→patch、`feat!`/`BREAKING CHANGE`→major、`docs`/`chore`/`ci`/`test` 等→无版本变化。
- 发布链路：release 推送 → release-please 开 release PR（bump 4 处 package.json + package-lock + CHANGELOG）→ 人工合并 → 自动 tag + GitHub Release → GHCR 镜像 → opencode AI 润色 Release Notes。
- 完整机制与故障排查见 [docs/repository-ops.md](docs/repository-ops.md)。

## 3. 常用命令

```bash
npm install            # 安装依赖
npm run dev            # 后端（tsx watch，http://127.0.0.1:18081）
npm run build:web      # 前端构建（→ web/dist）
npm run sync:static    # 前端产物同步到 core/static 与 core/dist/static（运行中服务生效）
npm run build          # 构建 types + core
npm test               # 后端 Jest + 前端 Vitest
npm run lint:md        # markdownlint 文档规范检查（pre-commit 自动跑暂存 md）
```

- 改了前端必须 `build:web` **再** `sync:static`，否则运行中的服务读到旧产物。
- 改了后端源码：`npm run dev` 下热重载；插件目录约 10s 轮询热加载。
- **提交信息必须符合 Conventional Commits**（commit-msg 钩子 + CI 双重强制）；`feat` 会触发 release-please minor 发布，勿滥用。
- 版本发布、AI 审查（PR 自动 + `/opencode` 评论）、Dependabot、labeler/stale 等仓库运维机制见 [docs/repository-ops.md](docs/repository-ops.md)。

## 4. 目录结构

```text
packages/
  types/   共享 DTO + 插件 SPI 契约（@atlas/types，只发类型）
  core/    NestJS 后端：应用/凭证/插件引擎/数据集/安全/运维台
  web/     前端：控制台/应用管理/应用空间/插件注册表/运维台
plugins/
  providers/ prompts/ model-files/ machine-monitor/   目录插件（前后端一体）
  template/    插件模板（加载器恒跳过）
docs/
  agent/    开发规范（见 §5，改代码前必读）
  plugin-development.md   插件开发教程/契约
  spi-development.md      核心功能 SPI 契约
```

## 5. 开发规范（必读指引）

> **改哪块先读哪份**，红线与反模式都固化在规范里。

| 你要做什么 | 先读 |
|-----------|------|
| 任何改动（通用约定） | [docs/agent/README.md](docs/agent/README.md) |
| 改后端核心框架（`packages/core`） | [docs/agent/core-backend.md](docs/agent/core-backend.md) |
| 改前端核心框架（`packages/web`） | [docs/agent/core-frontend.md](docs/agent/core-frontend.md) |
| 开发插件（`plugins/*`） | [docs/agent/plugins.md](docs/agent/plugins.md) + [docs/plugin-development.md](docs/plugin-development.md) |
| 写 UI / 插件面板 | [docs/agent/ui-design.md](docs/agent/ui-design.md) |
| 接入核心功能 SPI（事件/门面/建表） | [docs/spi-development.md](docs/spi-development.md) |

**规范效力**：红线（❌ 禁止）Code Review 必须拦截；约定（✅ 推荐）偏离需说明理由；存量违规在「触碰该文件时顺手修正」，不做一次性大重构。

## 6. 核心约定速查（红线摘要）

> 完整内容见规范正文，此处仅列 agent 最容易踩的硬性约定。

### 全仓通用

- **ESM 统一**：`import`/`export`，相对导入带 `.js` 扩展名；**禁止 `require()`**（第三方 CJS 库用默认导入或 `createRequire`）。
- **显式 `@Inject()`**：项目经 `tsx`/`esbuild` 运行，不发射 `design:paramtypes`，类 token 注入必须显式 `@Inject(SomeClass)`，否则运行时 `undefined`。
- **错误处理**：业务错误抛 `ValidationError`/`NotFoundError`/`DuplicateError`，由 `AppExceptionFilter` 统一映射；**controller 不手写 try/catch + `error()`**。
- **时间戳**：一律 `common/utils.ts` 的 `now()`，禁止散落手写 `toISOString()`。
- **安全**：路径防穿越双重校验（`isSafePath` + `resolve().startsWith()`）；密钥不落日志/不返显；数据面（`/api/v1`）错误脱敏。

### 后端（packages/core）

- 分层：Controller（参数解析 + `ok()`）→ Service（业务/事务）→ Repository（纯 SQL + 行↔实体映射），Facade（薄转发）。
- DB 结构变更走 `schema.sql`（IF NOT EXISTS）+ `user_version` 迁移，**迁移只增不改**；插件表由插件 `schema.sql` 声明，核心不内联插件 DDL。
- **插件生命周期红线（R-01~R-06）**：实例删除 ≠ 插件销毁；`autoInstantiate` 容忍未加载插件；卸载/热重载必须 dispose 实例 env 并 re-init；scope 变更注销旧 SPI；init/destroy 对称。详见 [core-backend.md](docs/agent/core-backend.md) §5。

### 前端（packages/web）

- `services/` 是唯一 HTTP 出口（经 `http.ts`），组件内禁 `axios`/`fetch`；DTO 优先从 `@atlas/types` 导入。
- slot 运行时契约单一入口：`slotRegistry.ts` + `PluginMount.vue`；**slot key 必须唯一**；`initPluginSlots` 启动 + 登录后各调一次。
- 共享运行时（vue/element-plus/icons/@atlas/runtime）三处同步：`runtime/*-entry.ts` + `vite.config.ts` external + `index.html` import map。

### 插件（plugins/*）

- `type`/`pluginType`/SPI namespace kebab-case 全局唯一；`manifest.pluginType` 与 `AtlasPlugin.type` 严格一致。
- 数据三选一：结构化 → `store()`；二进制 → `files()`；密钥 → `crypto()`（**禁止明文落库**）。
- 生命周期：`init(env)` 幂等、`destroy()` 插件级（禁对单实例假设）、模块顶层禁可变状态、禁缓存 `env.spi()` 结果、`import.meta.url` 取相对路径须 `.split('?')[0]`。
- 大文件下载走 `files().publish()`，不用 `$binary` 硬扛；不建自有公开下载端点。

### UI

- 样式只引用 `--atlas-*` token，**禁止硬编码颜色/字号/圆角**；新增颜色先加 token 再用。
- 状态双通道表达（Tag + 文字/图标），不只靠颜色；删除/轮换必须有二次确认。

## 7. 已知陷阱（务必避开）

1. **删除单个插件实例时不要调用插件级 `destroy()`**：`AtlasPlugin.destroy()` 无实例上下文，会误伤其他应用（尤其 `GLOBAL_SHARED` 插件）。—— review H1 / 规范 R-01
2. **卸载插件后新建应用会半成功失败**：`autoInstantiate` 遍历 `findAllDefs()` 含 `loaded=false` 的 def，`enableInstance` 会抛错且 app 已落库。—— review H2 / 规范 R-02
3. **热重载只重建 SPI、不 re-init 已启用实例**，且旧实例 env 未 dispose（事件订阅泄漏）。—— review H3 / 规范 R-03/R-04
4. **`require('busboy')` 依赖 core 被编译为 CJS**，一旦 `packages/core/package.json` 加 `"type":"module"` 生产即崩。—— review M1
5. **前端登录后插件 Tab/卡片不出现**：`initPluginSlots` 登录前 401 静默失败，登录成功未重拉。—— review M4 / 规范 F-02
6. **同一插件多 app-space slot 的 key 冲突**：`slotRegistry` 用 `plugin:${type}` 做 key，需加子标识。—— review M3 / 规范 F-01
7. **`matchPath` 未转义正则元字符**：端点路径含 `.`/`+` 会误匹配。—— review M5

> 完整问题清单与修复建议见评审记录（`.dev/review/`，不入 git）。

## 8. 提交前自查清单

- [ ] 改动对应的规范已读，红线无违反
- [ ] 后端：测试通过（`npm test`）；新逻辑补了 `*.spec.ts`
- [ ] 前端：`build:web` + `sync:static` 已执行；插件面板 `ui:build` 后提交了 `ui/`
- [ ] 无硬编码颜色/字号/密钥/路径拼接；无 `require()`、无散落 `toISOString()`
- [ ] 数据面接口错误已脱敏；删除/危险操作有二次确认
