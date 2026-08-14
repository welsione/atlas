# 对外接口统一架构（External Interface）— 设计落地稿

> 状态：**已落地（实施完成）**。把当前割裂的三类「数据面暴露」——数据集、插件公开端点、文件公开下载——统一为**同一类一等公民「对外接口」**，提供统一目录、统一启停、统一统计审计，并把插件公开端点提升到数据集同级的安全能力（token 寻址 / 敏感度 / 启停 / 审计）。
> 关联：`docs/plugin-development.md §7（端点）、§8（数据集）`、`docs/spi-development.md`、`packages/core/src/plugins`、`packages/core/src/monitor`、`packages/core/src/datasets`。
> 实施要点：插件公开端点升级为 **token 寻址防枚举 + 敏感度 + 统一启停 + 数据面审计**；数据集与文件保持各自 token 消费模型，纳入统一治理目录与启停。

---

## 1. 目标与非目标

### 1.1 目标

- 引入统一的 **「对外接口（External Interface）」** 抽象，收敛三类数据面暴露形态。
- 接口管理页仅管理**对外开放接口**；插件面板内部交互接口（管理面）不在此管理，也不被启停规则约束。
- 插件公开端点升级为数据集同级一等公民：**token 寻址防枚举 + 敏感度（PUBLIC/INTERNAL/SECRET）+ 授权白名单 + 启停 + 只读 GET 的 304 条件请求 + IP 限流 + 全量审计**。
- 统一目录：接口管理页一张表展示三类对外接口，可启停、看统计。
- 统一审计：三类对外调用同源写入 `api_access_logs` 聚合。

### 1.2 非目标（第一版不做）

- 插件公开端点支持任意 `POST/PUT/DELETE` 的一等公民化全套（若含副作用，仍保留管理面语义；数据面 token 化的主要目的是只读/受控读取）。
- 数据集消费入口（`/api/v1/datasets/{token}/meta|data|secrets|assets`）与文件下载（`/api/files/{token}`）**不重写**，仅纳入统一治理。
- 不引入独立的「对外接口 token 兑换」机制（沿用现有应用凭证，见 §4）。

### 1.3 原则

- **默认对内**：插件 `endpoints()` 声明的端点默认仅管理面可用（插件面板交互）；只有显式标记 `public: true` 的才对外开放。
- **数据面仅暴露 public**：消费应用以 token 只能访问标记为对外（public）并已启用的接口，内部端点数据面一律 404（防探测）。
- **接口管理 = 对外接口治理**：目录、启停、统计都只针对对外接口。

---

## 2. 架构现状（已核对）

| 形态 | 数据面消费入口 | 鉴权 / 治理 | 一等公民能力 |
|------|---------------|-------------|-------------|
| **数据集** `plugin.datasets()` / `datasets` 表 | `/api/v1/datasets/{token}/meta\|data\|secrets\|assets/*` | Bearer 令牌(应用凭证或匿名) + 敏感度 + `dataset_app_grants` 白名单 | ✅ token 防穷举、PUBLIC/INTERNAL/SECRET、信封加密、304 ETag、IP 限流、审计 |
| **插件公开 ep** `endpoints()` `public:true` | 待定（见 §4） | 应用凭证 Bearer（必须是 appId 属主）+ `endpoint_rules` 启停 | ⚠️ 弱：无 token、无敏感度、无条件请求、有启停 + 审计 |
| **文件公开下载** `files().publish()` `plugin_file_tokens` 表 | `/api/files/{token}/meta\|download` | 防穷举 token + 304 + IP 限流 | ✅ token 防穷举、304、限流、审计 |

现状缺口：

- 插件对外 ep 的 appId 直接暴露在 URL（`/api/v1/app/{appId}/...`），可枚举、无敏感度。
- 三类对外形态在接口管理页展示割裂（插件 ep 进『接口管理』，数据集/文件只在『流量分析/最近访问』出现）。
- 数据集与文件没有「停用」入口（status 是 PUBLISHED 语义，但接口目录不提供启停操作）。

---

## 3. 统一抽象：对外接口（External Interface）

```ts
type ExternalInterfaceKind = 'DATASET' | 'PLUGIN_EP' | 'PUBLIC_FILE'

interface ExternalInterface {
  kind: ExternalInterfaceKind
  appId: number            // 属主应用
  pluginType: string        // 来源插件（'' 表示非插件）
  name: string              // 接口名 / summary
  method?: string           // PLUGIN_EP 才有：GET/POST/...
  path?: string             // PLUGIN_EP 才有：ep/ 相对路径
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'SECRET'
  token: string             // 对外寻址 token（防穷举）
  enabled: boolean          // 统一启停位
  // 统计（来自 api_access_logs 聚合，仅 PLUGIN_EP / 只读 GET 的 DATASET data 计入）
  count: number
  failures: number
  bytes: number
  lastAccess: string
}
```

- **DATASET**：`token` = `datasets.token`；`sensitivity` = `datasets.sensitivity`；`enabled` 由统一启停表承载（不改 datasets 表语义）。
- **PLUGIN_EP**：`token` 为插件公开端点新生成（实例启用时按 public ep 派生，见 §5）。
- **PUBLIC_FILE**：`token` = `plugin_file_tokens.token`；`sensitivity` 第一版固定 `PUBLIC`（文件按 token 即公开）。

---

## 4. 数据面消费模型

### 4.1 统一寻址（插件公开 ep）

第一版消费入口（不暴露 appId / 插件名，防枚举）：

```text
GET /api/v1/app/{appId}/plugins/{pluginType}/{apiToken}/ep/{method}/{path}
```

- `{apiToken}` 是插件公开端点专属 token（实例启用时按 public ep 派生，32 字节随机）。
- 认证仍用**应用凭证 Bearer**（属主 appId 校验 + token 解析出对应插件公开 ep）。
- 停用 → 404（防探测）；非 public / 无匹配 token → 404。

> 说明：`{appId}` 仍然在 URL 中用于应用凭证校验属主关系（应用只能访问自己实例），但与旧路径 `/api/v1/app/{appId}/plugins/{type}/ep/{path}` 相比，**新增 token 段可防止未持 token 者枚举具体端点 path**，也会把 path 从「可猜路径」改为「token + path」双因子。

### 4.2 敏感度与授权

- `PUBLIC`：任意持 token 消费方（可匿名）。
- `INTERNAL` / `SECRET`：插件公开 ep 的数据面仅允许属主应用（凭据=属主 appId，天然满足）；跨应用授权复用 `dataset_app_grants` 的机制留给数据集（插件公开 ep 第一版不引入跨应用 grant 表）。
- `SECRET` 的信封加密/密钥接口对插件公开 ep 的语义：插件公开 ep 返回值若含密钥，ep 的 handler 用 `env.crypto()` 自行保管，第一版不做 `secrets` 子接口（保留管理面读取）。

### 4.3 统一启停

新增 `external_interface_rules`（或复用并改造 `endpoint_rules`）承载统一启停位：

```text
external_interface_rules(
  id, app_id, kind, key UNIQUE(app_id, kind, key)  -- key: 数据集 id / 插件 ep path / 文件 token
  enabled, created_at, updated_at
)
```

- 无规则行 = 默认启用。
- `enabled=false` → 数据面该接口 404（防探测）。
- 插件内部端点（非 public）不生成规则、不受启用约束。

---

## 5. 插件契约变更

### 5.1 `PluginEndpoint` 增加字段

```ts
interface PluginEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  summary: string
  /** 对外开放（数据面可访问）。默认 false = 仅管理面（插件面板交互）。 */
  public?: boolean
  /** 仅 public 生效：对外敏感度，默认 PUBLIC。 */
  sensitivity?: 'PUBLIC' | 'INTERNAL' | 'SECRET'
  handle(env, pathParams, body): ...
}
```

### 5.2 实例启用生成对外 ep token

- 实例启用（`enableInstance`）时，扫描 `endpoints()` 中 `public:true` 的端点，按 `(appId, pluginType, method, path)` 生成/复用 `api_token`（存新表 `plugin_ep_tokens`）。
- 实例停用/卸载 → 注销 token（公开 ep 立即失效）。
- 热重载 re-init 时按最新 `public` 声明同步 token。

### 5.3 现有插件标记

- `plugins/providers`：`config` 端点标记 `public:true` + `sensitivity:INTERNAL`（对外配置，属主应用数据面读取）；`list/create/update/delete/test/reference/*/icons/*` 保持对内。
- 其余插件（model-files / machine-monitor / prompts / template）：无对外的动态 ep（对外走数据集/文件），不标记，保持对内。

---

## 6. 后端改造范围（初估）

| 模块 | 改动 |
|------|------|
| `packages/core/src/db/schema.sql` | 新增 `plugin_ep_tokens`、`external_interface_rules` 表 |
| `packages/core/src/db/schema-initializer.ts` | 新增 v4 迁移（建表 + 回填规则默认启用） |
| `packages/types/src/index.ts` | `PluginEndpoint.public/sensitivity` |
| `packages/core/src/plugins/plugin-ep-token.repository.ts` | 新增：插件公开 ep token 的生成/复用/注销 |
| `packages/core/src/monitor/external-interface-rule.repository.ts` | 新增：统一启停规则（数据集/插件 ep/文件 共用 `key`） |
| `packages/core/src/plugins/plugin.service.ts` | `enableInstance`/`unload`/热重载触点同步 ep token |
| `packages/core/src/plugins/plugin-data.controller.ts` | token 寻址 + 敏感度/启停/404（统一目录聚合在 monitor.controller） |
| `packages/core/src/plugins/plugin.dispatch.controller.ts` | 管理面启停规则仅约束 public ep |
| `packages/core/src/monitor/monitor.controller.ts` | 接口目录统一聚合三类 + 统一启停 API（`/interfaces` PUT） |
| `packages/core/src/monitor/monitor.repository.ts` | 目录/统计数据源扩展（`externalStats`） |
| `packages/web/src/services/monitorApi.ts` | 统一接口目录 / 启停 API（kind+key） |
| `packages/web/src/views/panels/MonitorPanel.vue` | 接口管理页统一展示三类 + 启停 + 敏感度 tag |

---

## 7. 实施步骤

✅ 全部完成：

1. schema + 迁移 v4（`plugin_ep_tokens`、`external_interface_rules`）。
2. 契约：`PluginEndpoint.public/sensitivity`。
3. 后端：ep token 仓储 + `plugin.service` 触点。
4. 后端：数据面 token 寻址 + 启停/防探测。
5. 后端：管理面启停规则仅约束 public ep。
6. 后端：统一对外接口目录聚合 + monitor API。
7. 前端：MonitorPanel 接口管理页统一展示三类。
8. 插件迁移（providers config 标 public:true + sensitivity:INTERNAL）。
9. 测试基线全绿（108 passed，含新增对外接口治理 6 例）+ 文档落地。

---

## 8. 风险与回退

- **插件公开 ep token 生命周期**：热重载/停用/卸载必须同步收回，否则 token 泄漏。已纳入 R-03/R-04 触点（`disposeInstancesOf`/`disableInstance`/`deleteInstance` 注销，`enableInstance`/`rebuildSpiFor` 重建）。
- **数据面消费入口变更**（新增 token 段）会破坏既有 `/api/v1/app/.../ep/{path}` 直接调用方；按决策采用**立即切换**（不保留旧路径），在 `docs/plugin-development.md` 显著标注新路径。
- **敏感度对插件公开 ep 的边界**：`SECRET` 级插件 ep 的密钥读取仍走管理面（env.crypto 解密），数据面不引入 `secrets` 子接口，避免过度设计。
- **文件公开下载敏感度**：第一版固定 `PUBLIC`；若需 INTERNAL/SECRET，待文件 token 模型扩展后再定。
- 回退：`external_interface_rules` / `plugin_ep_tokens` 为增量表，删表 + 回退消费入口改动即可，不破坏既有数据集/文件数据。
