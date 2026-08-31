# Atlas 系统模块清单（system.md）

> 依据运行中的服务 `http://127.0.0.1:18081`（develop 分支）与代码实际实现梳理。
> 用途：模块索引 + 逐模块 Review 记录。Review 结论见文末「模块 Review」。

## 0. 系统概览

- **形态**：全 TypeScript 插件化 AI 服务基础平台。应用为核心的多租户：管理面（管理端认证）+ 数据面（应用凭证/令牌）双通道。
- **仓库**：npm workspaces monorepo — `packages/types`（共享 DTO/SPI 契约）、`packages/core`（NestJS 后端）、`packages/web`（Vue 3 前端）；插件在 `plugins/`（目录热加载，前后端一体）。
- **访问入口**：
  - 管理面：`http://127.0.0.1:18081`（hash 路由：`#/console` `#/apps` `#/plugins` `#/ops` `#/security`）
  - 数据面：`/api/v1/*`（应用凭证认证，错误脱敏）
  - 插件静态 UI：`/_pluginui/{pluginType}/**`

## 1. 认证与安全（security + auth）

| 功能 | 后端 | 前端 |
|------|------|------|
| 管理端登录/状态 | `POST /api/auth/login`、`GET /api/auth/status`（`security/auth.controller.ts`） | `LoginView.vue`（登录页）、`SecurityView.vue`（`#/security`，认证状态展示） |
| 数据面应用换令牌 | `POST /api/v1/app/auth`（appId+appSecret → 短时效令牌，`auth/app-auth.controller.ts`） | — |
| IP 黑白名单/安全中间件 | `security/security.middleware.ts`（仅拦 `/api/*`，`isPublic` 放行插件声明的公开 URL）、`ip-rule.repository.ts`；规则经 `spi/security.facade.ts` 暴露给插件 SPI | — |
| 401 全局回落 | `web/services/http.ts` 派发 `atlas:unauthorized` | `App.vue` 监听回落登录页 |

## 2. 应用管理（apps）

| 功能 | 后端 | 前端 |
|------|------|------|
| 应用 CRUD/生命周期 | `GET/POST /api/apps`、`POST :id/rotate`（轮换凭证）、`POST :id/revoke`（吊销）、`POST :id/activate`、`DELETE :id`（`apps/app.controller.ts`） | `AppsView.vue`（`#/apps`，分页/创建抽屉）、`AppSpaceView.vue`（`#/apps/{id}`） |
| 应用详情看板 | — | `AppSpaceView` board Tab（`#/apps/{id}` / `#/apps/{id}/board`）：身份英雄面板、凭证贯通条（轮换/复制）、指标卡×3、危险操作区（吊销/删除二次确认） |
| 应用插件实例 | 见 §3 | `AppSpaceView` instances Tab（`#/apps/{id}/instances`） |

## 3. 插件体系（plugins + spi）

| 功能 | 后端 | 前端 |
|------|------|------|
| 插件注册表（目录扫描） | `GET /api/plugins`（分页 `{rows,total,page,size}`）、`GET /api/plugins/spi-overview`、`POST /api/plugins/:type/unload`、`POST /api/plugins/reload`（`plugins/plugin.controller.ts`）；`plugin.loader.ts`/`plugin.registry.ts`/`plugin.watcher.ts`（~10s 轮询热加载） | `PluginsAdminView.vue`（`#/plugins`，注册表 + 手动重载 + SPI 总览） |
| 插件实例（应用维度） | `GET /api/apps/:appId/plugins`、`POST :pluginType/enable`、`POST :pluginType/disable`、`DELETE :pluginType`、`GET/POST :pluginType/config` | `AppSpaceView` instances Tab：「实例化插件」选择器、实例列表、配置编辑 |
| 插件 UI 清单与静态资源 | `GET /api/plugins/ui`（`plugin-ui.service.ts`，icon 合并磁盘主 manifest）、`GET /_pluginui/*`（`plugin-ui.controller.ts`） | `plugin-host/slotRegistry.ts`（图标/清单唯一入口，磁盘优先、注册表回退）+ `PluginMount.vue`（唯一挂载器） |
| 插件端点分发（管理面） | `ALL /api/apps/:appId/plugins/:type/ep*`（`plugin.dispatch.controller.ts`，公开端点受 external-interface 规则约束） | 插件面板内部调用 |
| 插件端点分发（数据面） | `ALL /api/v1/app/:appId/plugins/:type/:apiToken/ep*`（`plugin-data.controller.ts`，应用令牌认证、错误脱敏） | — |
| 插件文件发布/下载 | `GET /api/files/:token/meta`、`GET /api/files/:token/download`（`plugin-file-download.controller.ts`，配合 `files().publish()`） | — |
| 数据存储三通道 SPI | `store()`（结构化）/ `files()`（二进制）/ `crypto()`（密钥信封加密），由插件 env 提供 | — |
| 核心功能 SPI | `spi/`：`platform-event-emitter`（事件）、`app/monitor/security/platform facades`（薄转发）、`extension.registry`、`plugin-spi.registry`（scope 变更注销旧 SPI）、`schema-bootstrap.service`（插件表 DDL 声明式建表） | — |
| 系统级插件菜单/卡片 slot | system-menu / console / app-space slot | `#/plugin/{type}`（系统插件详情页，如 machine-monitor）、`ConsoleView` 插件卡片、`AppSpaceView` 插件 Tab |

## 4. 数据集分发（datasets）

| 功能 | 后端 | 前端 |
|------|------|------|
| 数据集管理 | `GET/POST /api/apps/:appId/datasets`、`DELETE :datasetId`、`PUT :datasetId`、`POST :datasetId/refresh`（版本刷新，`datasets/dataset.controller.ts`） | `AppSpaceView` datasets Tab → `panels/DatasetsPanel.vue` |
| 资产（二进制） | `POST :datasetId/assets`（上传）、`DELETE :datasetId/assets/:path` | DatasetsPanel |
| 密钥（信封加密） | `POST :datasetId/secrets`（`envelope-crypto.ts`，SECRET 级） | DatasetsPanel（密钥不回显） |
| 授权（跨应用） | `POST :datasetId/grants`、`DELETE :datasetId/grants/:grantAppId` | DatasetsPanel |
| 审计 | `GET :datasetId/audit` | DatasetsPanel |
| 数据面消费 | `GET /api/v1/datasets/:token/` + `meta`·`data`·`secrets`·`assets/:path`（`consume.controller.ts`，消费令牌认证、错误脱敏） | — |
| 版本调度 | `dataset.scheduler.ts`（后台任务） | — |

## 5. 接口监控与对外接口治理（monitor）

| 功能 | 后端 | 前端 |
|------|------|------|
| 应用接口监控 | `GET /api/apps/:appId/monitor/` + `overview`·`endpoints`·`series`·`recent`·`top-resources`·`top-ips`·`top-apps`（`monitor/monitor.controller.ts`） | `AppSpaceView` monitor Tab → `panels/MonitorPanel.vue` |
| 对外接口（External Interface）治理 | `GET/PUT /api/apps/:appId/monitor/interfaces`、`POST .../interfaces/reset`（`external-interface-rule.repository.ts`；管理面公开端点 `public===true` 须过规则白名单） | MonitorPanel（接口治理区） |

## 6. 运维台（ops）

| 功能 | 后端 | 前端 |
|------|------|------|
| 运维总览 | `GET /api/ops/overview` | `OpsView.vue`（`#/ops`）：统计卡 + 插件运行状态 |
| 运维日志 | `GET /api/ops/logs`（`plugins/ops.controller.ts` + `ops-log.service.ts`） | OpsView 日志表 |

## 7. 控制台（console）

| 功能 | 前端 |
|------|------|
| 总览仪表盘 | `ConsoleView.vue`（`#/console`）：应用统计卡（点击进应用管理）、插件服务卡片（console slot）、最近应用 |

## 8. 内置插件（plugins/）

| 插件 | 数据范围 | 功能 | UI 位置 |
|------|----------|------|---------|
| providers 供应商管理 | GLOBAL_SHARED | OpenAI/Anthropic 兼容供应商配置、API Key 加密（crypto()）、模型选择、图标上传 | AppSpace 插件 Tab + Console 卡片 |
| prompts 提示词管理 | APP_LOCAL | 提示词模板管理（应用独立） | AppSpace 插件 Tab |
| model-files 模型文件 | APP_LOCAL | 模型文件管理（files() 二进制、大文件 publish 下载） | AppSpace 插件 Tab |
| machine-monitor 机器监控 | GLOBAL_SHARED | 机器 CPU/内存/磁盘/负载/进程监控（system-menu 系统插件，5s 轮询 + 历史/进程每分钟刷新） | `#/plugin/machine-monitor` + Console 卡片 |
| template（模板） | — | 插件开发模板，加载器恒跳过 | — |

## 9. 共享基础设施

- **types**：`@atlas/types` 共享 DTO + 插件 SPI 契约（前后端单一事实来源）。
- **web 运行时**：vue/element-plus/icons/@atlas/runtime external vendor + import map 三处同步（`runtime/*-entry.ts`、`vite.config.ts`、`index.html`）。
- **web 基础件**：`services/http.ts`（唯一 HTTP 出口，Bearer 拦截/401 事件/错误提示）、`hashRoute.ts`（轻量路由）、`format.ts`（时间本地化 fmtTime）、`style.css`（`--atlas-*` 设计 token）。
- **core 基础件**：`common/utils.ts`（`now()` 时间戳/分页/限流器/客户端 IP）、`common/response.ts`（`ok()`/`error()`）、`AppExceptionFilter`（错误统一映射）、SQLite（`schema.sql` + `user_version` 迁移）。

---

## 模块 Review

> 逐模块前后端 review 记录（按 §1~§8 顺序），问题分级：🔴 高（红线/功能缺陷）、🟡 中（规范偏离/隐患）、🟢 低（建议）。
> 测试基线：后端 Jest 112/112 通过、前端 Vitest 20/20 通过（review 时点）。

### §1 认证与安全 — 2 项发现

- 🟡 `packages/core/src/plugins/plugin.repository.ts:166`、`plugin-file.registry.ts:48,82` — 手写 `new Date().toISOString().slice(0,19)` 代替 `common/utils.ts` 的 `now()`，违反全仓时间戳统一约定（AGENTS.md §6）。功能等价，属规范偏离。
- 🟢 `packages/core/src/plugins/plugin-data.controller.ts:45-62`、`plugin.dispatch.controller.ts:42-48` — controller 内手写 `error()`/`res.status().json()`，形式上偏离「controller 不手写 try/catch + error()」。但这是数据面/分发面的**有意设计**：需精确控制 401/403/404 状态码并脱敏，不宜并入全局 filter 泛化。属可接受例外，建议在 core-backend.md 注明该豁免边界。
- ✅ 其余核验通过：登录 HMAC token + timingSafeEqual 恒时比较；登录限流（10 次/分/IP）；`clientIp` 默认不信 XFF；AppTokenService 内存令牌有过期清扫 + 吊销即时生效；IP 黑名单覆盖全部 `/api/*`；`publicUrls()` 放行机制集中管理；安全响应头 nosniff/DENY。

### §2 应用管理 — 未发现问题

- ✅ 轮换/吊销/删除均二次确认（前端 ElMessageBox）；吊销即时令牌失效（validate 时查应用状态）；前端 AppsView 分页 hash 同步正确。

### §3 插件体系 — 1 项发现

- ✅ R-01~R-06 全链路核验通过：
  - R-01：`deleteInstance` 不调插件级 `destroy()`，仅 store/事件/SPI 精确清理（plugin.service.ts:219 注释 + 实现）；
  - R-02：`autoInstantiate` 过滤 `d.loaded` 才启用，未加载插件静默跳过；
  - R-03/R-04：`plugin.unloaded` 事件 → `spiRegistry.unregister` + `disposeInstancesOf`（env dispose 退订事件）；`plugin.loaded` → `rebuildSpiFor` + `reinitInstancesOf`；
  - R-05：scope 变更先 `spiRegistry.unregister(type, appId, 旧scope)` 再更新（enableInstance）；混合 scope 精确注销不误减共享引用；
  - R-06：热替换 cache-busting（entryUrl 带 `?v=hash`），`watcher.resyncKnown` 防重复热替换。
- 🔴 **PUBLIC_FILE 对外接口启停规则未在下载路径强制**：`monitor.controller.ts:166-185` 把公开文件下载列为可启停的对外接口（`kind:'PUBLIC_FILE', key:token`），管理面 PUT 可停用；但 `plugin-file-download.controller.ts` 的 `meta/download` 全程未调 `externalInterfaceRuleRepository.isAllowed(appId,'PUBLIC_FILE',token)`（文件 grep 0 处）。即「停用」状态在界面显示已停，实际下载端点仍 200 放行——对外接口治理闭环漏洞（与已修复的 DATASET/PLUGIN_EP 同类，commit 317933a 修了那两类，漏了这类）。
- 🟢 `plugin-ui.controller.ts:26` `registry.byType(pluginType)` 在前、404 用 `res.end()`——未认证请求对未注册插件返回空 404，防探测行为合理，无需改动。

### §4 数据集分发 — 1 项发现

- ✅ 核验通过：信封加密链路完整（KEK 包 DEK → AES-256-GCM 随机 IV）；SECRET 级才发 DEK；`consume` 错误统一 404/429 泛化不透内部细节（防探测）；全链路访问审计 + 密钥访问独立日志；上传限 64MB；管理面资产路径 `safeAssetPath` 校验。
- 🟡 **`safeAssetPath` 未做 resolve 后双重校验**（dataset.service.ts:200-205）：仅做字符串过滤（禁 `..`、绝对路径、`\0`），未像规范要求「`isSafePath` + `resolve().startsWith()` 双重校验」做落盘前根目录 containment 复查。当前过滤已挡住已知穿越形态（Windows 反斜杠也归一），但按规范属防御深度缺口——建议落盘前补 `resolve(root, path).startsWith(root + sep)` 断言。注意核心 `isSafePath` 定义在 `plugin-ui.service.ts:86`（非 common），跨模块复用路径不直观，建议顺手下沉 common。
- 🟢 `dataset.scheduler.ts` 后台刷新任务无并发上限说明——当前规模无碍，规模化后需关注。

### §5 接口监控 — 未发现问题（治理漏洞见 §3）

- ✅ MonitorPanel 接口启停带 aria-label；PUT 前有 `requireDeclaredExternalInterface` 防无效规则行；接口目录聚合数据集/公开 ep/文件三类。

### §6 运维台 — 未发现问题

- ✅ 日志与总览走 `ops-log.service` 统一写入；分页 pageParams 规范。

### §7 控制台 — 未发现问题

- ✅ 统计卡键盘可达（button + focus-visible）；ConsoleView 每应用并发 `pluginApi.overview(a.id,1,1)` 在应用数大时有 N+1 隐患（🟢，当前规模可接受）。

### §8 内置插件 — 2 项发现

- ✅ 数据三选一全部合规：providers API Key 走 `env.crypto()`（不落明文、对外 payload 默认 masked、`exposeApiKey` 显式开关）；prompts/model-files/machine-monitor 走 `store()`；model-files 大文件走 `files().publish()`，无自建下载端点；`import.meta.url` 均带 `.split('?')[0]`；无 `require()`；ui/ 产物与 ui-src 同步（构建时间一致）。
- 🟡 **prompts / model-files / machine-monitor 的 `main.js` mount 未做重复挂载防护**：`createApp` 后直接 `app.mount(el)`，返回 unmount 正确，但若宿主在同一 el 上二次 mount（PluginMount 已保证不会），Vue 会告警。PluginMount.vue 挂载前已 `innerHTML=''` 兜底，属低风险。providers 同构。🟢 建议。
- 🟡 **prompts / model-files 的 App.vue 无任何定时器/监听器**（grep 无 timer/listener），无需清理——合规；machine-monitor 定时器已 `onBeforeUnmount` 清理（上轮修复过 tick 逻辑）。此项实为 ✅，列出仅为记录核对过程。
- 🟢 providers 内置图标上传 `join(builtinDir, basename(path))` 已用 basename 归一，无穿越。

### §9 前端横向核验 — 2 项发现

- ✅ 无组件内 fetch/axios（services 唯一出口）；无硬编码颜色、无纯黑阴影；无 14px 正文字号（出现的 14px 均为卡片标题档位、18px/20px 均为图标字号——图标字号不在 §2.2 档位表内，建议规范补充「图标字号 18/20px」档位）；删除/轮换/吊销均有二次确认；PluginMount 挂载竞态（mountSeq）处理正确；App.vue F-02 登录后重拉 slot 有回归测试。
- 🟡 **`MonitorPanel.vue:9` 与 `AppSpaceView.vue:52` 的 Tab 状态双写**：hash 路由（`#/apps/{id}/{tab}`）与 localStorage（`atlas-space-tab`/`atlas-monitor-tab`）并存，初始值 localStorage 优先级低于 hash 但两处语义重复；hash 已能恢复 Tab，localStorage 属遗留通道，建议收敛到 hash 单一事实来源。
- 🟡 **ConsoleView N+1**（同 §7，前端侧）：应用多时串行瀑布变小（Promise.all 并发），但仍是每应用一次请求；建议后端提供聚合端点或 ops overview 携带计数。

### 汇总

| 级别 | 数量 | 代表项 |
|------|------|--------|
| 🔴 高 | 1 | PUBLIC_FILE 启停规则未在 /api/files 下载路径强制（治理闭环漏洞） |
| 🟡 中 | 5 | safeAssetPath 缺 resolve 双重校验、时间戳散落手写、Tab 状态 hash/localStorage 双写、ConsoleView N+1、数据面 controller error() 豁免未注明 |
| 🟢 低 | 4 | isSafePath 位置、图标字号档位未入规范、插件 main.js 二次挂载防护、scheduler 并发说明 |

**总体结论**：核心红线（插件生命周期 R-01~R-06、密钥加密、防穿越主体、错误脱敏、测试覆盖）全部达标；唯一需尽快修复的是 🔴 PUBLIC_FILE 下载路径的对外接口启停强制——一行 `isAllowed` 判断即可补齐闭环。
