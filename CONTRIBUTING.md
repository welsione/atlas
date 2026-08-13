# 贡献指南

感谢你对 Atlas 的关注！本文档说明如何参与贡献：报告问题、提交代码、开发插件、参与评审。

## 目录

- [行为准则](#行为准则)
- [快速开始](#快速开始)
- [开发流程](#开发流程)
- [提交信息规范](#提交信息规范)
- [代码规范](#代码规范)
- [测试要求](#测试要求)
- [贡献插件](#贡献插件)
- [报告 Bug 与提建议](#报告-bug-与提建议)

## 行为准则

本项目遵循 [Contributor Covenant 行为准则](CODE_OF_CONDUCT.md)，请所有参与者阅读并遵守。

## 快速开始

```bash
# 环境要求：Node ≥ 22
git clone https://github.com/<your-org>/atlas.git
cd atlas
npm install

# 后端开发（http://127.0.0.1:18081）
npm run dev

# 前端构建 + 同步到运行中的服务
npm run build:web
npm run sync:static

# 测试与类型检查
npm test
npm run typecheck
```

## 开发流程

1. **Fork 仓库**并在本地建功能分支：`git checkout -b feat/xxx` 或 `fix/xxx`。
2. **小步提交**：每个提交只做一件事，便于评审与回溯。
3. **写测试**：改动后端逻辑必须补 `*.spec.ts`；改动前端纯逻辑补前端测试。
4. **跑本地检查**：`npm run lint:md && npm run typecheck && npm test`，前端改动需 `npm run sync:static`。
5. **提交 PR**：填写 PR 模板，说明动机、改动、验证方式；关联相关 issue。PR 打开后 opencode 会自动 AI 审查。

### 分支命名

- `feat/描述`：新功能
- `fix/描述`：缺陷修复
- `docs/描述`：文档
- `chore/描述`：构建/依赖/杂项

## 提交信息规范

采用 [Conventional Commits](https://www.conventionalcommits.org/)，格式：

```text
<type>(<scope>): <subject>

[body]

[footer]
```

- `type`：`feat` / `fix` / `docs` / `test` / `refactor` / `chore` / `perf` / `build` / `ci` / `style` / `revert`
- `scope`（可选）：`core` / `web` / `types` / `plugins` / `datasets` / `security` 等
- `subject`：祈使句、首字母小写、不超过 72 字符、不加句号

示例：

```text
feat(plugins): 支持插件声明式数据集注册
fix(core): 修复卸载插件后新建应用失败的问题
docs(agent): 新增后端核心框架开发规范
```

> **⚠️ 提交类型决定发布版本**（release-please 全自动发布）：`feat` → minor、`fix` → patch、
> `feat!` / `BREAKING CHANGE` → major。每次 `feat` 合并都会触发一次版本发布，
> 请勿滥用 `feat` 描述小改动。

提交格式由本地钩子（commitlint）与 CI 双重强制，格式不合规将被拒绝。

## 代码规范

改动前先读对应规范，红线与反模式已固化在 `docs/agent/`：

| 改动范围 | 规范 |
|----------|------|
| 通用约定 | `docs/agent/README.md` |
| 后端核心框架 | `docs/agent/core-backend.md` |
| 前端核心框架 | `docs/agent/core-frontend.md` |
| 插件开发 | `docs/agent/plugins.md` |
| UI 设计 | `docs/agent/ui-design.md` |

更多项目级约定见 [AGENTS.md](AGENTS.md)。

## 测试要求

- 后端测试框架 Jest，单测与源码同目录（`*.spec.ts`）。
- **必须覆盖**：插件实例生命周期（enable/disable/delete）、数据作用域（DataScope）、双向 SPI 解析、依赖拓扑排序与环检测。
- 测试用临时目录 + 内存 SQLite，不污染开发数据。
- 前端至少覆盖纯逻辑与契约边界（`slotRegistry`、`http` 拦截器、`PluginMount` 挂载清理）。

```bash
npm test                 # 全量后端测试
npm test -- --watch      # 监听模式
```

## 贡献插件

插件是 Atlas 的一等公民。贡献新插件：

1. `cp -R plugins/template plugins/my-plugin`，替换 manifest 与实现。
2. 遵循 `docs/plugin-development.md`（契约）与 `docs/agent/plugins.md`（规范）。
3. 附带 `README.md`（功能说明、端点清单、配置项）。
4. 前端面板（如有）提交 `ui/` 构建产物。

官方插件（`providers` / `prompts` / `model-files` / `machine-monitor`）是最佳参考实现。

## 报告 Bug 与提建议

- 用 [Bug Report](.github/ISSUE_TEMPLATE/bug_report.yml) 模板报告缺陷，附最小复现步骤。
- 用 [Feature Request](.github/ISSUE_TEMPLATE/feature_request.yml) 模板提建议。
- **安全漏洞请勿公开提交 issue**，参见 [SECURITY.md](SECURITY.md) 的私下报告流程。

## 评审流程

1. 维护者会检查：规范红线（`docs/agent/`）、测试、文档一致性；PR 打开时 opencode 自动出 AI 审查意见。
2. 评审意见请以客观、建设性方式提出（见行为准则）。
3. 通过后由维护者合并；重大变更可能需要多次往返。
4. 需要 AI 协助时，可在 PR/issue 评论中提及 `/opencode`（见 [docs/repository-ops.md](docs/repository-ops.md)）。

再次感谢你的贡献！🎉
