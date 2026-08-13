# Changelog

## [0.4.0](https://github.com/welsione/atlas/compare/v0.3.0...v0.4.0) (2026-08-13)


### 新增

* **atlas:** 全 TS 重构——插件目录化（顶层 plugins/）、monitor 框架内置、env 能力扩展（store scope/files/crypto）、前端面板重建 ([ce7d950](https://github.com/welsione/atlas/commit/ce7d9509b16cc0e93c023b14f69258624036e8f9))
* **plugins:** 插件体系完善——system-menu 系统级侧边菜单槽位、machine-monitor 机器监控插件（控制台卡片+侧边详情）、providers 重构为 OpenAI/Anthropic 双兼容接口（cc-switch 图标库+自定义上传、models.dev 模型参考库快速选择、卡片点开详情抽屉）、prompts/model-files UI 打磨；插件 UI 构建改为 CSS 内联（修复平台不加载 style.css 的样式缺失）；补充开发文档与 README ([bc17dc2](https://github.com/welsione/atlas/commit/bc17dc243be3380693bff4b241ed5258c91c8b0c))
* **spi:** SPI 治理完成 + 建表 SQL 提升为框架级 schema.sql 约束 ([fb2d5eb](https://github.com/welsione/atlas/commit/fb2d5ebd1a06202ed8adae331f4d27b4be1397ef))
* **spi:** 插件双向 SPI 落地——provides/dependsOn/env.spi()、PluginSpiRegistry（惰性构建/引用计数/作用域）、生命周期编排（启用注册/删除注销/热替换重建/拓扑排序+环检测）、providers 暴露 model-gateway 一等能力；插件业务表迁移至插件 schemaDdl（providers/prompts/model-files）；修复 P0-1 unregister 混合 scope 引用计数 bug 与 P0-2 dependsOn.spi 契约缺口，补 P1 回归测试（44/44 全绿） ([a009b7b](https://github.com/welsione/atlas/commit/a009b7bbe69df6452a4516f6e3c79e2e0055057e))


### 修复

* **plugins:** 修复 review 遗留问题并补齐生命周期/分发测试 ([74bdaec](https://github.com/welsione/atlas/commit/74bdaecca4cc90a1be034e6e5afa4f271205dc86))

## [0.3.0](https://github.com/welsione/atlas/compare/types-v0.2.0...types-v0.3.0) (2026-08-13)


### 新增

* **atlas:** 全 TS 重构——插件目录化（顶层 plugins/）、monitor 框架内置、env 能力扩展（store scope/files/crypto）、前端面板重建 ([ce7d950](https://github.com/welsione/atlas/commit/ce7d9509b16cc0e93c023b14f69258624036e8f9))
* **plugins:** 插件体系完善——system-menu 系统级侧边菜单槽位、machine-monitor 机器监控插件（控制台卡片+侧边详情）、providers 重构为 OpenAI/Anthropic 双兼容接口（cc-switch 图标库+自定义上传、models.dev 模型参考库快速选择、卡片点开详情抽屉）、prompts/model-files UI 打磨；插件 UI 构建改为 CSS 内联（修复平台不加载 style.css 的样式缺失）；补充开发文档与 README ([bc17dc2](https://github.com/welsione/atlas/commit/bc17dc243be3380693bff4b241ed5258c91c8b0c))
* **spi:** SPI 治理完成 + 建表 SQL 提升为框架级 schema.sql 约束 ([fb2d5eb](https://github.com/welsione/atlas/commit/fb2d5ebd1a06202ed8adae331f4d27b4be1397ef))
* **spi:** 插件双向 SPI 落地——provides/dependsOn/env.spi()、PluginSpiRegistry（惰性构建/引用计数/作用域）、生命周期编排（启用注册/删除注销/热替换重建/拓扑排序+环检测）、providers 暴露 model-gateway 一等能力；插件业务表迁移至插件 schemaDdl（providers/prompts/model-files）；修复 P0-1 unregister 混合 scope 引用计数 bug 与 P0-2 dependsOn.spi 契约缺口，补 P1 回归测试（44/44 全绿） ([a009b7b](https://github.com/welsione/atlas/commit/a009b7bbe69df6452a4516f6e3c79e2e0055057e))


### 修复

* **plugins:** 修复 review 遗留问题并补齐生命周期/分发测试 ([74bdaec](https://github.com/welsione/atlas/commit/74bdaecca4cc90a1be034e6e5afa4f271205dc86))
