# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，并采用 [语义化版本](https://semver.org/lang/zh-CN/)。

> 本文件由 **release-please 自动维护**（版本区块从 Conventional Commits 自动生成），
> 请勿手动维护 Unreleased 区块；发布流程见 [docs/repository-ops.md](docs/repository-ops.md)。

## [0.4.1](https://github.com/welsione/atlas/compare/v0.4.0...v0.4.1) (2026-08-13)


### 修复

* **ops:** labeler v5 配置改 any/all 格式，opencode-review 补写权限 ([91e434a](https://github.com/welsione/atlas/commit/91e434af125c8e6c80da836929e9fa856e9877ff))
* **ops:** labeler v5 配置改为 changed-files 匹配格式 ([5974707](https://github.com/welsione/atlas/commit/5974707e098822c351781953c157a3691e17e82a))
* **ops:** opencode 评论工作流补 GITHUB_TOKEN 写权限 ([d55c49b](https://github.com/welsione/atlas/commit/d55c49b6545efaf2df6d970dc30237ca66fda65d))
* **ops:** release-notes 移除非法 --format 参数，支持手动补跑 ([e9c81a9](https://github.com/welsione/atlas/commit/e9c81a9bd997272470ba980744f3a4019bef26ca))


### 文档

* **ops:** 补充分支模型——master 产品发布 / pre-release 测试发布 ([a8cf09e](https://github.com/welsione/atlas/commit/a8cf09ebf8a8844ba712bee7c4401fc076dd30b3))
* 同步触发 labeler 与审查重跑 ([cfe2a94](https://github.com/welsione/atlas/commit/cfe2a94bb9acf1fc814667e06ff810e5182bede5))

## [0.4.0](https://github.com/welsione/atlas/compare/v0.3.0...v0.4.0) (2026-08-13)


### 新增

* AIBase 基础服务——供应商配置管理 + 提示词管理 + 插件 SPI ([eed5a29](https://github.com/welsione/atlas/commit/eed5a290729a3c1b65e20676d4ab7181bf9b822f))
* **atlas:** 全 TS 重构——插件目录化（顶层 plugins/）、monitor 框架内置、env 能力扩展（store scope/files/crypto）、前端面板重建 ([ce7d950](https://github.com/welsione/atlas/commit/ce7d9509b16cc0e93c023b14f69258624036e8f9))
* **modelfile:** 下载审计 + 版本/HASH + 条件下载（有更新才下载） ([ea36871](https://github.com/welsione/atlas/commit/ea368719b3ca6ddcf8f8cf601a3954b10131e5eb))
* **modelfile:** 固定随机下载链接——复制长期可用，防穷举 ([6b1405f](https://github.com/welsione/atlas/commit/6b1405f9a1da6aac2a6d8edf72adcede053f4083))
* **modelfile:** 模型文件管理——目录/zip 上传、流式下载、路径安全 ([4d494a2](https://github.com/welsione/atlas/commit/4d494a2bc8874c73b011948825e7f652199c46a7))
* **monitor:** 接口监控管理面与数据面联动完善 ([2dfc0b0](https://github.com/welsione/atlas/commit/2dfc0b094c6aff051528bda4e14ab0cba2486b73))
* **monitor:** 控制台——上传/下载流量监控 + 服务器运行数据 ([7b347be](https://github.com/welsione/atlas/commit/7b347be0dac97375b17dbfef20f54eb60f6a1752))
* **plugins:** 插件体系完善——system-menu 系统级侧边菜单槽位、machine-monitor 机器监控插件（控制台卡片+侧边详情）、providers 重构为 OpenAI/Anthropic 双兼容接口（cc-switch 图标库+自定义上传、models.dev 模型参考库快速选择、卡片点开详情抽屉）、prompts/model-files UI 打磨；插件 UI 构建改为 CSS 内联（修复平台不加载 style.css 的样式缺失）；补充开发文档与 README ([bc17dc2](https://github.com/welsione/atlas/commit/bc17dc243be3380693bff4b241ed5258c91c8b0c))
* **security:** 安全加固——IP 黑名单+自动封禁、多维限流、管理认证 ([21549e9](https://github.com/welsione/atlas/commit/21549e9bfd49a170fb06c16f42fc7a7806f8a917))
* **spi:** SPI 治理完成 + 建表 SQL 提升为框架级 schema.sql 约束 ([fb2d5eb](https://github.com/welsione/atlas/commit/fb2d5ebd1a06202ed8adae331f4d27b4be1397ef))
* **spi:** 插件双向 SPI 落地——provides/dependsOn/env.spi()、PluginSpiRegistry（惰性构建/引用计数/作用域）、生命周期编排（启用注册/删除注销/热替换重建/拓扑排序+环检测）、providers 暴露 model-gateway 一等能力；插件业务表迁移至插件 schemaDdl（providers/prompts/model-files）；修复 P0-1 unregister 混合 scope 引用计数 bug 与 P0-2 dependsOn.spi 契约缺口，补 P1 回归测试（44/44 全绿） ([a009b7b](https://github.com/welsione/atlas/commit/a009b7bbe69df6452a4516f6e3c79e2e0055057e))


### 修复

* **modelfile:** 测试清理顺序——先删磁盘条目再清表，避免 id 复用残留冲突 ([4c8c98e](https://github.com/welsione/atlas/commit/4c8c98e3232212010ba7f500c22970cc15b4dd4a))
* **monitor:** 磁盘空间探测兜底（目录不存在时回退工作目录）+ 测试数据目录整体清理 ([b87404a](https://github.com/welsione/atlas/commit/b87404a09f9e235f861f702a7f553b7febfaa2ec))
* **ops:** changelog 忽略改为脚本参数方式 ([33b2601](https://github.com/welsione/atlas/commit/33b2601679bf7a083d3cdad03a68cd10fd7c1997))
* **ops:** changelog-sections 的 section 值去掉 ### 前缀，修复双 ### 渲染 ([e76bd8d](https://github.com/welsione/atlas/commit/e76bd8df6b0c01b5311abe13871955acfdfffd50))
* **ops:** linked-versions 共享单一 tag（include-component-in-tag=false） ([5d2bc1c](https://github.com/welsione/atlas/commit/5d2bc1c1322ebd397c51aa3a49b1ad7f27505b1a))
* **ops:** linked-versions 的 tag-pattern 对齐基线 v{version} ([e20a308](https://github.com/welsione/atlas/commit/e20a3085ebdbb2336151d6c04bd02a224e8dc98b))
* **ops:** lint 忽略全部层级 changelog 文件 ([f5414a1](https://github.com/welsione/atlas/commit/f5414a185546edacf374f6b1b73e5084489ed9cb))
* **ops:** release-please 配置文件重命名为无点前缀 release-please-config.json ([db4cd97](https://github.com/welsione/atlas/commit/db4cd973a67746c0310686f2d5568f9856e94283))
* **ops:** 补回 MD060 关闭配置（中文表格对齐规则） ([9bc0b97](https://github.com/welsione/atlas/commit/9bc0b977e64b288ca7cc8e1d67f4989a2c673fb7))
* **plugins:** 修复 review 遗留问题并补齐生命周期/分发测试 ([74bdaec](https://github.com/welsione/atlas/commit/74bdaecca4cc90a1be034e6e5afa4f271205dc86))


### 文档

* **build:** 开发规范体系、开源基础设施与 CI ([6743c4a](https://github.com/welsione/atlas/commit/6743c4a7eade132ad115e8647bfd4339540104a6))
* **ops:** 基线 tag 统一为 atlas-v{version} 前缀 ([a7afa0f](https://github.com/welsione/atlas/commit/a7afa0f1463efd9949173e2d49df29c01937b6ef))

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
