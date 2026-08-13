# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，并采用 [语义化版本](https://semver.org/lang/zh-CN/)。

> 本文件由 **release-please 自动维护**（版本区块从 Conventional Commits 自动生成），
> 请勿手动维护 Unreleased 区块；发布流程见 [docs/repository-ops.md](docs/repository-ops.md)。

## [0.3.0](https://github.com/welsione/atlas/compare/atlas-v0.2.0...atlas-v0.3.0) (2026-08-13)


### 新增

* **monitor:** 接口监控管理面与数据面联动完善 ([2dfc0b0](https://github.com/welsione/atlas/commit/2dfc0b094c6aff051528bda4e14ab0cba2486b73))


### 修复

* **ops:** changelog 忽略改为脚本参数方式 ([33b2601](https://github.com/welsione/atlas/commit/33b2601679bf7a083d3cdad03a68cd10fd7c1997))
* **ops:** changelog-sections 的 section 值去掉 ### 前缀，修复双 ### 渲染 ([e76bd8d](https://github.com/welsione/atlas/commit/e76bd8df6b0c01b5311abe13871955acfdfffd50))
* **ops:** linked-versions 的 tag-pattern 对齐基线 v{version} ([e20a308](https://github.com/welsione/atlas/commit/e20a3085ebdbb2336151d6c04bd02a224e8dc98b))
* **ops:** lint 忽略全部层级 changelog 文件 ([f5414a1](https://github.com/welsione/atlas/commit/f5414a185546edacf374f6b1b73e5084489ed9cb))
* **ops:** release-please 配置文件重命名为无点前缀 release-please-config.json ([db4cd97](https://github.com/welsione/atlas/commit/db4cd973a67746c0310686f2d5568f9856e94283))
* **ops:** 补回 MD060 关闭配置（中文表格对齐规则） ([9bc0b97](https://github.com/welsione/atlas/commit/9bc0b977e64b288ca7cc8e1d67f4989a2c673fb7))
* **plugins:** 修复 review 遗留问题并补齐生命周期/分发测试 ([74bdaec](https://github.com/welsione/atlas/commit/74bdaecca4cc90a1be034e6e5afa4f271205dc86))


### 文档

* **build:** 开发规范体系、开源基础设施与 CI ([6743c4a](https://github.com/welsione/atlas/commit/6743c4a7eade132ad115e8647bfd4339540104a6))
* **ops:** 基线 tag 统一为 atlas-v{version} 前缀 ([a7afa0f](https://github.com/welsione/atlas/commit/a7afa0f1463efd9949173e2d49df29c01937b6ef))

## [0.2.0] - 2026-08-12

### 新增

- **插件体系（前后端一体）**：目录插件热加载（约 10s 轮询）、声明式端点（含 `{param}`、multipart 上传、二进制下载）、插件 UI slot（app-space / console / system-menu）
- **插件双向 SPI**：`provides()` / `dependsOn()` / `env.spi()` 能力编排，拓扑排序启用 + 环检测 + semver 契约约束
- **插件声明式数据集注册**：`datasets()` 自动创建/同步，含敏感凭证（secrets）、文件资产（assets + 懒加载 assetSource）
- **数据集密级与访问控制**：PUBLIC / INTERNAL / SECRET，SECRET 级信封加密（KEK → DEK → AES-256-GCM）、跨应用授权、逐次审计
- **数据集资产**：文件上传/下载、ETag 304 条件请求、IP 限流
- **插件文件公开托管**：`env.files().publish()` → `/api/files/{token}/download|meta`（防穷举 token + 304 + 限流 + 审计）
- **接口监控**：数据面聚合、端点启停规则（`endpoint_rules`）
- **运维台**：跨应用工作日志（`ops_logs`）、24h 趋势
- **安全**：IP 黑名单、管理认证、应用凭证轮换/吊销（SHA-256 + 短时效令牌）
- 内置插件：providers（供应商管理 + model-gateway SPI）、prompts、model-files、machine-monitor

### 变更

- 后端由内置插件迁移为纯目录插件加载管线
- `plugin_store` 增加 `plugin_type` 维度，隔离不同插件数据

## [0.1.0] - 2026-08-07

### 新增

- 项目骨架：npm workspaces monorepo（types / core / web）
- 应用空间 CRUD、应用凭证（app_id + app_secret）
- 基础数据集发布与消费

[0.2.0]: https://github.com/welsione/atlas/compare/atlas-v0.1.0...atlas-v0.2.0
[0.1.0]: https://github.com/welsione/atlas/releases/tag/v0.1.0
