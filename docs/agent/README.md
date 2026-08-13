# Atlas 开发规范总览

本目录定义 Atlas 平台的**编码规范与约定**（怎么写代码），与以下**教程/契约文档**互补：

| 文档 | 定位 |
|------|------|
| `docs/plugin-development.md` | 插件开发**教程**（契约、SPI、端点、数据集、UI、FAQ） |
| `docs/spi-development.md` | 核心功能 SPI **契约**（生命周期事件、门面、建表） |
| `docs/agent/*`（本目录） | **编码规范**（分层、命名、错误处理、安全红线、反模式） |

## 规范索引

| 文档 | 适用对象 | 内容 |
|------|----------|------|
| [README.md](./README.md) | 全部 | 通用约定（TS/ESM/命名/时间戳/日志/错误/安全） |
| [core-backend.md](./core-backend.md) | `packages/core` 贡献者 | 后端分层、DI、响应契约、DB 迁移、插件生命周期红线、测试 |
| [core-frontend.md](./core-frontend.md) | `packages/web` 贡献者 | 前端分层、services、slot 运行时、共享运行时、测试 |
| [plugins.md](./plugins.md) | `plugins/*` 开发者 | 插件编码约定、生命周期红线、SPI、UI、反模式清单 |
| [ui-design.md](./ui-design.md) | 前端 + 插件 UI | 设计 token、布局、组件、图标、动效、可访问性、反模式 |

## 规范效力

- **红线（❌ 禁止）**：违反会导致数据不一致、安全漏洞或运行时崩溃，Code Review 必须拦截。
- **约定（✅ 推荐）**：保持代码库一致性的默认做法，偏离需在 MR 中说明理由。
- 本规范对**新增代码**强制执行；存量代码如违反规范，在**触碰该文件时顺手修正**，不做一次性大重构。

---

## 通用约定

### 1. TypeScript

- 全仓 `strict: true`，禁止 `// @ts-ignore`（确需忽略用 `// @ts-expect-error` + 注释说明）。
- **公共 API 必须有类型**：SPI 契约（`@atlas/types`）、DTO、门面接口、跨包导出都必须显式声明；仅函数内部实现可依赖推断。
- 避免 `any`：优先 `unknown` + 类型收窄；对第三方无类型对象用 `as` 断言并附注释。
- 类型断言用 `as`，不用 `<T>`（保持与 JSX/模板语法无歧义）。

```ts
// ✅ 公共契约显式类型
export interface ModelGatewaySpi { chat(req: ModelGatewayRequest): Promise<ModelGatewayResponse> }

// ❌ any 逃逸
const data: any = JSON.parse(raw)
```

### 2. 模块系统（ESM）

- 全仓统一 **ESM**：`import` / `export`；相对导入**必须带 `.js` 扩展名**（`module: NodeNext` 要求）。
- **禁止 `require()`**（详见 [core-backend.md](./core-backend.md) §2）：第三方 CJS 库用默认导入或 `createRequire`。
- **禁止循环 `import`**：跨模块循环依赖用 Nest DI（`forwardRef` + Symbol token，见 `spi/tokens.ts`）。
- 外部插件是动态 `import` 隔离的运行时，**类型共享在编译期、禁止运行时跨插件 import**。

```ts
// ✅
import { PluginRegistry } from './plugin.registry.js'

// ❌ 循环 import：app.service → plugin.service → app.facade → app.service
```

### 3. 命名

| 对象 | 约定 | 示例 |
|------|------|------|
| 文件/目录 | kebab-case | `plugin-loader.ts`、`dataset.service.ts` |
| 类 | PascalCase | `PluginLoader`、`AppExceptionFilter` |
| 变量/函数 | camelCase | `findAllDefs`、`rowToDef` |
| 常量 | UPPER_SNAKE_CASE | `PLUGIN_MANIFEST`、`SCHEMA_VERSION` |
| DB 列 | snake_case | `plugin_type`、`content_hash` |
| TS/DTO 字段 | camelCase | `pluginType`、`contentHash` |
| `pluginType` / SPI namespace | kebab-case，全局唯一 | `machine-monitor`、`model-gateway` |

- **DB↔实体映射在 repository 边界一次完成**（`rowToDef` / `rowToInstance` 模式），不得让 snake_case 泄漏到 service/controller。

### 4. 时间戳

- 一律用 `common/utils.ts` 的 `now()`（格式 `yyyy-MM-dd HH:mm:ss`，与 SQLite `datetime('now','localtime')` 对齐）。
- 禁止在业务代码手写 `new Date().toISOString().slice(0, 19).replace('T', ' ')` 或 `toISOString()` 混用。

```ts
// ✅
import { now } from '../common/utils.js'
run(row.created_at, now())

// ❌ 格式不一致
const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
```

### 5. 日志

- 后端用 Nest `Logger`（`new Logger(ClassName.name)` 带上下文）；插件用 `env.ops()` / `env.info/warn/error`。
- 分级语义：
  - `error`：需要人工处理（异常、失败）。
  - `warn`：异常但可恢复（插件加载失败、同步跳过）。
  - `info`：关键操作审计（增删改、发布、轮换）。
  - `debug`：调试信息（生产默认不关心）。
- **敏感信息禁止进日志**：密钥、token、完整 SQL、明文密文一律不得打印；异常堆栈只在服务端记录、不返回客户端。

### 6. 错误处理

- 业务错误**抛异常**（`ValidationError` / `NotFoundError` / `DuplicateError`），由 `AppExceptionFilter` 统一映射为 HTTP 状态码 + `{code,message,data}` 信封。
- **controller 不手写 try/catch 再 `error()`**：让异常冒泡到全局过滤器。
- 未知异常不透出内部细节（SQL/路径/堆栈只进服务端日志，客户端返回通用 500 文案）。
- 数据面（公开 `/api/v1`）错误**必须脱敏**，管理面（`/api`）可返回可读原因。

```ts
// ✅ controller 薄
@Post()
create(@Body() body) {
  return ok(this.service.create(body.name))
}
// service 内 throw new ValidationError(...) 即可

// ❌ controller 手写 try/catch + error()
try { ... } catch (e) { return error(400, (e as Error).message) }
```

### 7. 安全红线（全部代码）

| 红线 | 说明 |
|------|------|
| 路径防穿越 | 所有文件路径操作必须 `isSafePath` + `resolve(x).startsWith(resolve(root))` **双重校验**，缺一不可 |
| Header/文件名注入 | 回写 `Content-Disposition` 等头前必须 `sanitizeDispositionFilename` |
| 密钥不落盘/不返显 | 敏感字段用信封加密（`EnvelopeCrypto`）或插件 `env.crypto()`；日志、响应、数据集内容中不得出现明文 |
| 数据面脱敏 | `/api/v1` 对外错误信息不得含内部路径/SQL/密钥片段 |
| 限流 + 审计 | 公开可匿名访问的下载/取用端点必须有 IP 限流（`createRateLimiter`）+ `api_access_logs` 审计 |
