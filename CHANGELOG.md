# Changelog

## [1.1.0](https://github.com/welsione/atlas/compare/v1.0.0...v1.1.0) (2026-09-02)


### 新增

* AIBase 基础服务——供应商配置管理 + 提示词管理 + 插件 SPI ([385fe61](https://github.com/welsione/atlas/commit/385fe614452a928f6c791b91e765842627579368))
* **atlas:** 全 TS 重构——插件目录化（顶层 plugins/）、monitor 框架内置、env 能力扩展（store scope/files/crypto）、前端面板重建 ([ff8ece3](https://github.com/welsione/atlas/commit/ff8ece3743e39c67071715ddef59f34d48e57f02))
* **modelfile:** 下载审计 + 版本/HASH + 条件下载（有更新才下载） ([716f670](https://github.com/welsione/atlas/commit/716f670e7c403659ed975ff937cea5a88046c0dc))
* **modelfile:** 固定随机下载链接——复制长期可用，防穷举 ([fa3d77b](https://github.com/welsione/atlas/commit/fa3d77bfa30d3a80f8ff3d81098627df559f31ad))
* **modelfile:** 模型文件管理——目录/zip 上传、流式下载、路径安全 ([32c12dd](https://github.com/welsione/atlas/commit/32c12dd26cd0688b1e924979de4549aaee0d7892))
* **monitor:** 接口监控管理面与数据面联动完善 ([586b9d0](https://github.com/welsione/atlas/commit/586b9d059ed96762a3756cb43610f29094acaf71))
* **monitor:** 控制台——上传/下载流量监控 + 服务器运行数据 ([ec0bfb7](https://github.com/welsione/atlas/commit/ec0bfb7a73ef18877f7a77ae3600626e5845d83d))
* **plugins:** 插件体系完善——system-menu 系统级侧边菜单槽位、machine-monitor 机器监控插件（控制台卡片+侧边详情）、providers 重构为 OpenAI/Anthropic 双兼容接口（cc-switch 图标库+自定义上传、models.dev 模型参考库快速选择、卡片点开详情抽屉）、prompts/model-files UI 打磨；插件 UI 构建改为 CSS 内联（修复平台不加载 style.css 的样式缺失）；补充开发文档与 README ([54b29fd](https://github.com/welsione/atlas/commit/54b29fd3c176c46c55bf8219b55a789d83615944))
* **security:** 安全加固——IP 黑名单+自动封禁、多维限流、管理认证 ([5f80e72](https://github.com/welsione/atlas/commit/5f80e72cbb789196d07005d84f94702db0aa7172))
* **spi:** SPI 治理完成 + 建表 SQL 提升为框架级 schema.sql 约束 ([3d25cbf](https://github.com/welsione/atlas/commit/3d25cbf5580542be28c55dbd8648dcb93399db1f))
* **spi:** 插件双向 SPI 落地——provides/dependsOn/env.spi()、PluginSpiRegistry（惰性构建/引用计数/作用域）、生命周期编排（启用注册/删除注销/热替换重建/拓扑排序+环检测）、providers 暴露 model-gateway 一等能力；插件业务表迁移至插件 schemaDdl（providers/prompts/model-files）；修复 P0-1 unregister 混合 scope 引用计数 bug 与 P0-2 dependsOn.spi 契约缺口，补 P1 回归测试（44/44 全绿） ([fbca649](https://github.com/welsione/atlas/commit/fbca649312b0928fed47a690b0cae26af2b84f37))


### 修复

* **modelfile:** 测试清理顺序——先删磁盘条目再清表，避免 id 复用残留冲突 ([a23fe78](https://github.com/welsione/atlas/commit/a23fe78dc1f1a2ff2f43614f13c6f51a8e2ff204))
* **monitor:** 磁盘空间探测兜底（目录不存在时回退工作目录）+ 测试数据目录整体清理 ([a987f83](https://github.com/welsione/atlas/commit/a987f83997903d6bdab0e64b91541cfc858e7073))
* **ops:** changelog 忽略改为脚本参数方式 ([5283b52](https://github.com/welsione/atlas/commit/5283b5238ba9a1d94641199d7e68e303da5d68a1))
* **ops:** changelog-sections 的 section 值去掉 ### 前缀，修复双 ### 渲染 ([9892075](https://github.com/welsione/atlas/commit/9892075a0d2d0c161839bca2ac62efd67c39c99c))
* **ops:** labeler v5 配置改 any/all 格式，opencode-review 补写权限 ([1903c36](https://github.com/welsione/atlas/commit/1903c365bb81d3d930009e5b75e07a6934c9e830))
* **ops:** labeler v5 配置改为 changed-files 匹配格式 ([eef2574](https://github.com/welsione/atlas/commit/eef25746c4138eac0e88c51b795691463d74d95e))
* **ops:** linked-versions 共享单一 tag（include-component-in-tag=false） ([4a5054f](https://github.com/welsione/atlas/commit/4a5054fe40012132cefe5f6ab218a32da952f0a8))
* **ops:** linked-versions 的 tag-pattern 对齐基线 v{version} ([8e25f97](https://github.com/welsione/atlas/commit/8e25f979f7c7ff83808c580d49aedce0b2344c39))
* **ops:** lint 忽略全部层级 changelog 文件 ([94e41e9](https://github.com/welsione/atlas/commit/94e41e908d85799980814da39162b8bf4972bc22))
* **ops:** opencode 评论工作流补 GITHUB_TOKEN 写权限 ([613f5d3](https://github.com/welsione/atlas/commit/613f5d33ad700786858de86e95d396956e475261))
* **ops:** release-notes 移除非法 --format 参数，支持手动补跑 ([046e86b](https://github.com/welsione/atlas/commit/046e86b04f0cf29488c90672613d22fa7ab4df8a))
* **ops:** release-please 显式 target-branch=release，镜像快照前缀改 release- ([720bd1c](https://github.com/welsione/atlas/commit/720bd1cb3e74cbf355d0f39f59b8eb45cdaa81d5))
* **ops:** release-please 配置文件重命名为无点前缀 release-please-config.json ([e8b08cc](https://github.com/welsione/atlas/commit/e8b08ccc1c58a555d345057d8d9d672ad98aa8f7))
* **ops:** 补回 MD060 关闭配置（中文表格对齐规则） ([a3d1614](https://github.com/welsione/atlas/commit/a3d1614837a0ef6d2ad7f3a67c275902f83c32d3))
* **plugins:** 修复 review 遗留问题并补齐生命周期/分发测试 ([f0cc663](https://github.com/welsione/atlas/commit/f0cc66303f1bbd5ebba9c2d1c46e921ced8189d9))


### 文档

* **build:** 开发规范体系、开源基础设施与 CI ([c0e5b3d](https://github.com/welsione/atlas/commit/c0e5b3d93c9272d4fcb69c4a806c30191493436b))
* **ops:** 分支与发布规范写入 AGENTS.md，repository-ops 同步 release 触发语义 ([2a1ce9c](https://github.com/welsione/atlas/commit/2a1ce9cd52dbaed7b999e0d9c11c27a84323a5dc))
* **ops:** 基线 tag 统一为 atlas-v{version} 前缀 ([f547a05](https://github.com/welsione/atlas/commit/f547a052f7250f33a001150576268e0f2d370040))
* **ops:** 补充分支模型——master 产品发布 / pre-release 测试发布 ([9300bd4](https://github.com/welsione/atlas/commit/9300bd490dd3112678416c3c38121d25dc4d8099))
* 同步触发 labeler 与审查重跑 ([82702d3](https://github.com/welsione/atlas/commit/82702d3f8381b88263a1bfc46617e22e4d5ba3c3))

## 1.0.0 (2026-08-13)


### 新增

* AIBase 基础服务——供应商配置管理 + 提示词管理 + 插件 SPI ([385fe61](https://github.com/welsione/atlas/commit/385fe614452a928f6c791b91e765842627579368))
* **atlas:** 全 TS 重构——插件目录化（顶层 plugins/）、monitor 框架内置、env 能力扩展（store scope/files/crypto）、前端面板重建 ([ff8ece3](https://github.com/welsione/atlas/commit/ff8ece3743e39c67071715ddef59f34d48e57f02))
* **modelfile:** 下载审计 + 版本/HASH + 条件下载（有更新才下载） ([716f670](https://github.com/welsione/atlas/commit/716f670e7c403659ed975ff937cea5a88046c0dc))
* **modelfile:** 固定随机下载链接——复制长期可用，防穷举 ([fa3d77b](https://github.com/welsione/atlas/commit/fa3d77bfa30d3a80f8ff3d81098627df559f31ad))
* **modelfile:** 模型文件管理——目录/zip 上传、流式下载、路径安全 ([32c12dd](https://github.com/welsione/atlas/commit/32c12dd26cd0688b1e924979de4549aaee0d7892))
* **monitor:** 接口监控管理面与数据面联动完善 ([586b9d0](https://github.com/welsione/atlas/commit/586b9d059ed96762a3756cb43610f29094acaf71))
* **monitor:** 控制台——上传/下载流量监控 + 服务器运行数据 ([ec0bfb7](https://github.com/welsione/atlas/commit/ec0bfb7a73ef18877f7a77ae3600626e5845d83d))
* **plugins:** 插件体系完善——system-menu 系统级侧边菜单槽位、machine-monitor 机器监控插件（控制台卡片+侧边详情）、providers 重构为 OpenAI/Anthropic 双兼容接口（cc-switch 图标库+自定义上传、models.dev 模型参考库快速选择、卡片点开详情抽屉）、prompts/model-files UI 打磨；插件 UI 构建改为 CSS 内联（修复平台不加载 style.css 的样式缺失）；补充开发文档与 README ([54b29fd](https://github.com/welsione/atlas/commit/54b29fd3c176c46c55bf8219b55a789d83615944))
* **security:** 安全加固——IP 黑名单+自动封禁、多维限流、管理认证 ([5f80e72](https://github.com/welsione/atlas/commit/5f80e72cbb789196d07005d84f94702db0aa7172))
* **spi:** SPI 治理完成 + 建表 SQL 提升为框架级 schema.sql 约束 ([3d25cbf](https://github.com/welsione/atlas/commit/3d25cbf5580542be28c55dbd8648dcb93399db1f))
* **spi:** 插件双向 SPI 落地——provides/dependsOn/env.spi()、PluginSpiRegistry（惰性构建/引用计数/作用域）、生命周期编排（启用注册/删除注销/热替换重建/拓扑排序+环检测）、providers 暴露 model-gateway 一等能力；插件业务表迁移至插件 schemaDdl（providers/prompts/model-files）；修复 P0-1 unregister 混合 scope 引用计数 bug 与 P0-2 dependsOn.spi 契约缺口，补 P1 回归测试（44/44 全绿） ([fbca649](https://github.com/welsione/atlas/commit/fbca649312b0928fed47a690b0cae26af2b84f37))


### 修复

* **modelfile:** 测试清理顺序——先删磁盘条目再清表，避免 id 复用残留冲突 ([a23fe78](https://github.com/welsione/atlas/commit/a23fe78dc1f1a2ff2f43614f13c6f51a8e2ff204))
* **monitor:** 磁盘空间探测兜底（目录不存在时回退工作目录）+ 测试数据目录整体清理 ([a987f83](https://github.com/welsione/atlas/commit/a987f83997903d6bdab0e64b91541cfc858e7073))
* **ops:** changelog 忽略改为脚本参数方式 ([5283b52](https://github.com/welsione/atlas/commit/5283b5238ba9a1d94641199d7e68e303da5d68a1))
* **ops:** changelog-sections 的 section 值去掉 ### 前缀，修复双 ### 渲染 ([9892075](https://github.com/welsione/atlas/commit/9892075a0d2d0c161839bca2ac62efd67c39c99c))
* **ops:** labeler v5 配置改 any/all 格式，opencode-review 补写权限 ([1903c36](https://github.com/welsione/atlas/commit/1903c365bb81d3d930009e5b75e07a6934c9e830))
* **ops:** labeler v5 配置改为 changed-files 匹配格式 ([eef2574](https://github.com/welsione/atlas/commit/eef25746c4138eac0e88c51b795691463d74d95e))
* **ops:** linked-versions 共享单一 tag（include-component-in-tag=false） ([4a5054f](https://github.com/welsione/atlas/commit/4a5054fe40012132cefe5f6ab218a32da952f0a8))
* **ops:** linked-versions 的 tag-pattern 对齐基线 v{version} ([8e25f97](https://github.com/welsione/atlas/commit/8e25f979f7c7ff83808c580d49aedce0b2344c39))
* **ops:** lint 忽略全部层级 changelog 文件 ([94e41e9](https://github.com/welsione/atlas/commit/94e41e908d85799980814da39162b8bf4972bc22))
* **ops:** opencode 评论工作流补 GITHUB_TOKEN 写权限 ([613f5d3](https://github.com/welsione/atlas/commit/613f5d33ad700786858de86e95d396956e475261))
* **ops:** release-notes 移除非法 --format 参数，支持手动补跑 ([046e86b](https://github.com/welsione/atlas/commit/046e86b04f0cf29488c90672613d22fa7ab4df8a))
* **ops:** release-please 显式 target-branch=release，镜像快照前缀改 release- ([720bd1c](https://github.com/welsione/atlas/commit/720bd1cb3e74cbf355d0f39f59b8eb45cdaa81d5))
* **ops:** release-please 配置文件重命名为无点前缀 release-please-config.json ([e8b08cc](https://github.com/welsione/atlas/commit/e8b08ccc1c58a555d345057d8d9d672ad98aa8f7))
* **ops:** 补回 MD060 关闭配置（中文表格对齐规则） ([a3d1614](https://github.com/welsione/atlas/commit/a3d1614837a0ef6d2ad7f3a67c275902f83c32d3))
* **plugins:** 修复 review 遗留问题并补齐生命周期/分发测试 ([f0cc663](https://github.com/welsione/atlas/commit/f0cc66303f1bbd5ebba9c2d1c46e921ced8189d9))


### 文档

* **build:** 开发规范体系、开源基础设施与 CI ([c0e5b3d](https://github.com/welsione/atlas/commit/c0e5b3d93c9272d4fcb69c4a806c30191493436b))
* **ops:** 分支与发布规范写入 AGENTS.md，repository-ops 同步 release 触发语义 ([2a1ce9c](https://github.com/welsione/atlas/commit/2a1ce9cd52dbaed7b999e0d9c11c27a84323a5dc))
* **ops:** 基线 tag 统一为 atlas-v{version} 前缀 ([f547a05](https://github.com/welsione/atlas/commit/f547a052f7250f33a001150576268e0f2d370040))
* **ops:** 补充分支模型——master 产品发布 / pre-release 测试发布 ([9300bd4](https://github.com/welsione/atlas/commit/9300bd490dd3112678416c3c38121d25dc4d8099))
* 同步触发 labeler 与审查重跑 ([82702d3](https://github.com/welsione/atlas/commit/82702d3f8381b88263a1bfc46617e22e4d5ba3c3))

## 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，并采用 [语义化版本](https://semver.org/lang/zh-CN/)。

> 本文件由 **release-please 自动维护**（版本区块从 Conventional Commits 自动生成），
> 请勿手动维护 Unreleased 区块；发布流程见 [docs/repository-ops.md](docs/repository-ops.md)。
