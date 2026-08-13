# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，并采用 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
- 开发规范体系（`docs/agent/`）：通用/后端/前端/插件/UI 五份编码规范
- `AGENTS.md`：面向 AI 编码代理的项目开发指引
- 开源社区基础设施：贡献指南、行为准则、安全策略、Issue/PR 模板、CI 测试流水线
- `npm run typecheck` 脚本（types/core/web 三层类型检查）

### 修复
- 删除单个插件实例不再误触发插件级 `destroy()`（H1）
- 卸载插件后新建应用不再失败（`autoInstantiate` 跳过未加载插件）（H2）
- 插件卸载/热重载时正确 dispose 实例 env 并 re-init 已启用实例（H3）
- 实例作用域变更时注销旧作用域 SPI 注册（H4）
- 移除 `require('busboy')`，统一 ESM import，消除生产构建脆弱性（M1）
- `matchPath` 转义正则元字符，端点路径按字面匹配（M5）
- 插件 UI slot key 唯一化，修复同插件多 slot 冲突（M3）
- 登录后重新拉取插件 UI manifest，修复登录后插件 Tab/卡片不出现（M4）
- 管理面/数据面插件端点分发共用 `dispatchPluginEndpoint`，鉴权/规则/审计作策略回调注入（M2）
- `$binary` 支持直接返回 `Buffer`，避免大文件 base64 全量往返（M6）
- SPI `resolve` 改为本 app 本地覆盖优先，其次全局共享（M7）
- 插件 UI 资源路径先 URL 解码再截取，与 `@Param` 解码保持一致（L1）
- `PlatformFacade.version` 读取 monorepo 根 `package.json`，随发布自动同步（L2）
- `plugin_store.version` 写入时递增，并提供 `putIfVersion` 乐观锁（CAS）与 `version()` 读取（L3）
- `toMountEntry` 向核心面板传递 `mode`/`refresh`（L4）
- `PluginMount` 用挂载代数消除异步 load 竞态（L5）
- 数据面 `appId` 非整数返回 400（原 403）（L6）
- 移除后端已废弃的内置插件分支（`require.resolve` 等死代码）（L7）
- `ops.log` 级别归一化支持 `DEBUG`（L8）
- 模板与文档补充 `import.meta.url` 带 query 的隐性约定（L9）

### 测试
- 前端引入 vitest + @vue/test-utils + jsdom + axios-mock-adapter：slotRegistry / http 拦截器 / PluginMount（10 用例）
- 后端新增 `plugin-dispatch.endpoint.spec.ts`：公共分发（JSON/Buffer/base64/guard 拦截/500 脱敏/404）与数据面鉴权（400/403/401）
- H3 热重载 re-init/dispose、M7 本地优先解析（service 层）、L3 乐观锁回归测试

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

[Unreleased]: https://github.com/welsione/atlas/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/welsione/atlas/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/welsione/atlas/releases/tag/v0.1.0
