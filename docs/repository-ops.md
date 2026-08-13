# 仓库运维指南（Repository Ops）

> 本文档说明本仓库的**自动化运维套件**：发布、AI 审查、依赖、PR/Issue、质量门禁的机制与使用方式。
> 面向维护者（maintainer）与高频贡献者；普通贡献流程见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## 1. 套件总览

| 能力 | 机制 | 触发 |
|------|------|------|
| 版本发布 | release-please（commit 语义驱动） | master 推送 |
| Release Notes 润色 | opencode（OpenCode Go 订阅） | release 发布 |
| PR 自动 AI 审查 | opencode GitHub Agent | PR 打开/更新 |
| AI 按需操作 | `/opencode` / `/oc` 评论 | issue/PR 评论 |
| 提交规范强制 | commitlint + husky | 本地提交 + CI |
| 文档规范 | markdownlint（全量） | 本地 pre-commit + CI |
| 依赖提醒 | Dependabot（不自动合并） | 每周一 |
| PR 自动标签 | labeler（路径驱动） | PR 打开/同步 |
| 过期清理 | stale | 每天 03:00 |
| 文档死链 | lychee | 每周一 04:00 |
| 质量门禁 | CI（lint→typecheck→build→test） | 每次推送/PR |

## 2. 版本发布流程（release-please）

**核心原理**：发布版本由 **Conventional Commits 语义**自动推断，无需手动 bump：

| 提交类型 | 版本变化 |
|----------|----------|
| `feat` | minor（0.2.0 → 0.3.0） |
| `fix` / `perf` | patch（0.2.0 → 0.2.1） |
| `feat!` 或 body 含 `BREAKING CHANGE:` | major（0.2.0 → 1.0.0） |
| `docs` / `chore` / `test` / `ci` 等 | 无版本变化 |

**完整流程**（master 推送后自动）：

```text
push master → release-please 评估 → 开 release PR（bump 4 处 package.json + package-lock + CHANGELOG）
    → 人工合并 release PR → 自动打 tag + 创建 GitHub Release
    → tag 触发 build-push.yml 构建 GHCR 镜像（ghcr.io/welsione/atlas）
    → release 发布触发 release-notes.yml 用 opencode 润色 Release Notes
```

- 版本号四处同步：根 `package.json` + `packages/{types,core,web}`（`linked-versions` 插件锁定）。
- **release PR 合并后发布即生效**；如需撤销，回滚 release PR 即可（下个 release PR 会修正版本）。
- 首次基线：`v0.2.0` tag 标记上一发布状态（见 §7 部署清单）。

## 3. AI 能力（opencode + OpenCode Go）

### 3.1 PR 自动审查（opencode-review.yml）

每个 PR 打开/更新时自动触发，opencode 按 `docs/agent/` 开发规范审查并输出评论：

- 红线检查（ESM/显式 `@Inject`/路径防穿越/脱敏/UI token）
- 潜在 bug、插件生命周期对称性、CHANGELOG 同步
- 输出：PR 摘要 → 分级问题清单（file:line）→ 建议

> 快速审查（~1-2 分钟）；深度审查请在本地对 PR 分支跑 agent（见 §3.3）。

### 3.2 按需操作（opencode.yml）

在 issue 或 PR 评论中提及 `/opencode` 或 `/oc`：

| 指令示例 | 效果 |
|----------|------|
| `/opencode explain this issue` | 解释 issue 上下文 |
| `/opencode fix this` | 新建分支实现修复并开 PR |
| 行级评论 `/oc add error handling here` | 按文件/行号上下文直接修改并提交 |

### 3.3 本地深度审查（手动）

```bash
git fetch origin pull/<PR 号>/head:pr-<PR 号>
git checkout pr-<PR 号>
opencode        # 或 claude/pi，让 agent 基于全仓上下文深度审查
```

### 3.4 配置要求

- GitHub Actions secrets 需配置 **`OPENCODE_API_KEY`**（OpenCode Go 订阅 key，`opencode auth ls` 查看，
  provider 为 `opencode-go`；本地 key 存于 `~/.local/share/opencode/auth.json`）。
- 模型：`opencode-go/deepseek-v4-flash`（可在各 workflow 的 `model` 输入调整，`opencode models opencode-go` 查看可选）。
- 费用：审查/润色走 OpenCode Go 订阅额度，无额外计费。

## 4. 本地质量门禁

```bash
npm run lint:md      # markdownlint 全量检查（CI 同款）
```

| 钩子 | 时机 | 内容 |
|------|------|------|
| `.husky/pre-commit` | 提交前 | `lint-staged`：仅对暂存的 `*.md` 跑 markdownlint --fix |
| `.husky/commit-msg` | 提交信息 | commitlint 校验 Conventional Commits 格式 |

提交格式不合规会被本地直接拒绝：

```text
<type>(<scope>): <subject>

type ∈ feat | fix | perf | refactor | test | docs | build | chore | ci | style | revert
```

> 重要：**提交类型决定发布版本**（见 §2），`feat` 会触发 minor 发布，谨慎使用。

## 5. 依赖维护（Dependabot）

- 每周一检查 npm 依赖更新，minor/patch 分组为单个 PR，打 `dependencies` 标签。
- **不自动合并**：人工确认（重点看破坏性变更与 `better-sqlite3` 等原生模块）后合并。
- 合并依赖 PR 前建议本地 `npm ci && npm test`（CI 亦会拦截）。
- 安全漏洞（GitHub Security 扫描）按严重级别由 GitHub 直接出 advisory PR。

## 6. PR/Issue 维护约定

- **标签**：labeler 按路径自动打 `docs/core/web/plugins/ci`；`dependencies` 由 Dependabot 打。
- **stale**：30 天无活动标记、7 天后关闭；`dependencies`/`security` 标签豁免。
- **发布语义**：PR 标题即最终 commit 语义，开 PR 前想清楚 type（尤其 `feat`）。

## 7. 工作流与 Secrets 清单

| Secret | 用途 | 必填 |
|--------|------|------|
| `OPENCODE_API_KEY` | opencode AI（审查/评论/润色） | 是（AI 功能） |
| `GITHUB_TOKEN` | 平台内置（release-please/actions 自动） | 否 |

### 首次部署清单（新 clone / 新 GitHub 仓库）

1. 配置 `OPENCODE_API_KEY`（Settings → Secrets and variables → Actions）。
2. 确认基线 tag：`git tag -l` 应含 `v0.2.0`；缺失时 `git tag v0.2.0 <上次发布 commit> && git push origin v0.2.0`。
3. 推送 master 后观察：CI 通过 → release-please 开 0.3.0 候选 release PR（验证版本推断，不合并）。
4. 首次验证 AI：手动触发 `opencode-review` workflow 或对任意 PR 评论 `/opencode`。

## 8. 故障排查

| 现象 | 排查 |
|------|------|
| release-please 未开 PR | 确认最后 release PR 已合并；`git log` 最近提交无 `feat/fix`（无版本变化属正常） |
| opencode 审查无评论 | 检查 `OPENCODE_API_KEY` 是否配置、workflow 权限（`pull-requests: read`） |
| release-please 版本推断异常 | 检查是否有未打 tag 的历史；基线 tag 需指向上一发布 commit |
| 本地提交被 commit-msg 拒绝 | 按 §4 格式改写提交信息后重试（`git commit --amend`） |
