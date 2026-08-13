# 后端核心框架开发规范（packages/core）

适用范围：`packages/core/src/**` 的贡献者。核心原则：**分层清晰、边界单一、生命周期对称、异常不泄漏**。

---

## 1. 分层职责

```
Controller  →  只做：参数解析（@Param/@Query/@Body）、调用 service、ok() 包装
Service     →  业务逻辑、事务边界、跨模块编排、事件 emit、插件生命周期
Repository  →  纯 SQL 存取 + 行↔实体映射（rowToDef/rowToInstance）
Facade(spi) →  对外能力门面：薄转发 + 惰性解析打破循环依赖
```

- **Controller 不碰 repository、不写业务判断**；分页归一统一 `pageParams()`。
- **Repository 不做业务判断**（不校验权限、不判断 scope 规则），只负责 CRUD 与映射。
- **跨领域编排放 Service**（如 `AppService.create` → `pluginService.autoInstantiate`），不放在 controller。

```ts
// ✅ controller 薄
@Get()
list(@Query('page') page?: string, @Query('size') size?: string) {
  const { page: p, size: s } = pageParams(page, size)
  return ok(this.service.listPage(p, s))
}

// ❌ controller 里写 SQL / 业务规则
```

## 2. 模块与依赖注入（DI）

- 领域分模块：`apps` / `datasets` / `plugins` / `monitor` / `security` / `spi`，新领域先问「该归哪」，避免新的全局杂烩模块。
- **`@Global()` 模块克制使用**：目前仅 `SpiModule` / `PluginModule` 合理，新增全局模块需说明理由。
- **显式 `@Inject()`**：项目经 `tsx`/`esbuild` 运行，**不发射 `design:paramtypes` 元数据**，类 token 注入必须显式 `@Inject(SomeClass)`，否则运行时 `undefined`。
- **循环依赖三板斧**（按优先级）：
  1. 提取 Symbol token（`spi/tokens.ts` 的 `APP_FACADE` 等）——门面类一律用 Symbol 提供；
  2. `forwardRef(() => X)`（`PluginService ↔ DatasetService`）；
  3. `ModuleRef.get(X, { strict: false })` 惰性解析（`AppFacade`/`ExtensionRegistry` 模式）。
- **禁止静态 `import` 门面类到 service**（会引入 app→plugin→spi→app 的运行时环）。
- **禁止 `require()`**（ESM 脆弱性，review M1 来源）：全仓 `"type": "module"`、源码 ESM，用 CJS `require` 会依赖 tsc 把 core 编译为 CJS 才可用，一旦 `packages/core/package.json` 补 `"type": "module"` 生产即 `require is not defined`。第三方 CJS 库用默认导入（`import busboy from 'busboy'`）或 `createRequire`。
  ```ts
  // ✅
  import busboy from 'busboy'

  // ❌
  const busboy = require('busboy')
  ```

## 3. 响应与异常契约

- 统一 `{ code, message, data }`，`code === 0` 成功；用 `ok()` / `error()` 工具，**不手写对象字面量**。
- 业务错误**抛** `ValidationError`(400) / `NotFoundError`(404) / `DuplicateError`(409)，交给 `AppExceptionFilter`。
- 需要透传 HTTP 状态时抛 `HttpException`；**其余异常一律不 catch 后改头换面重抛**，让 filter 兜底。
- 数据面 controller 的错误文案必须脱敏（见 README §7）。

```ts
// ✅
if (!name?.trim()) throw new ValidationError('应用名称不能为空')

// ❌ 每个方法 try/catch + error()
```

## 4. 数据库（better-sqlite3）

- **结构变更走两条管线**：
  1. `db/schema.sql`：`CREATE TABLE/INDEX IF NOT EXISTS`（幂等，可重复执行）；
  2. `SchemaInitializer.MIGRATIONS`：`user_version` 递增的版本化迁移（ALTER/重建表）。
- **迁移只增不改**：历史 migration 一经发布不得修改；新变更追加新版本号。
- **插件自有表由插件 `schema.sql` 声明**，核心禁止内联插件 DDL（`ExtensionRegistry.allSchemaDdl()` 统一执行）。
- 写操作涉及多表一致性时用 `db.transaction(...)`（参考 `AppRepository.deleteCascade`）。
- 查询防御注入：一律参数化 `?` 占位，**禁止字符串拼接 SQL**（动态 `ORDER BY`/表名除外，但必须白名单校验）。

## 5. 插件生命周期红线（P0，来自 review）

> 这些是过去实际踩过/评审发现的坑，违反会直接造成数据不一致或运行时崩溃。

- **R-01 实例删除 ≠ 插件销毁**：`deleteInstance` **不得**调用插件级 `destroy()`。`AtlasPlugin.destroy()` 无实例上下文，删除单实例却销毁插件会误伤其他应用（`GLOBAL_SHARED` 尤其致命）。实例级清理需引入 `destroy(env)` 对等钩子，或只做实例数据/注册清理。
- **R-02 `autoInstantiate` 必须容忍未加载插件**：卸载过的插件 `def.loaded=false` 仍在 `findAllDefs()`，`enableInstance` 对其 `requireLoaded` 会抛错，导致**新建应用半成功**（app 已落库、接口报 400）。必须在 `autoInstantiate` 过滤 `loaded=false` 或逐个 try/catch 跳过。
- **R-03 卸载/热重载必须 `dispose` 实例 env**：`unload()` / `scanExternal()` 热替换时，除 `unregister`(调旧 `destroy`) 外，**必须**对相关实例的 `activeEnvs` 调用 `dispose()` 退订事件；否则事件订阅泄漏、闭包引用已卸载插件。
- **R-04 热重载后必须 `re-init` 已启用实例**：热替换只 `rebuildSpiFor` 不够，依赖 `init` 的初始化（种子数据、事件订阅、资源准备）会丢失；需对已启用实例重新调用 `init(env)`（幂等）。
- **R-05 scope 变更必须注销旧 SPI 注册**：实例 scope 从 `GLOBAL_SHARED`→`APP_LOCAL` 时，先 `unregister` 旧 scope 再 `register` 新 scope；否则旧 `@0` 条目永久残留（`deleteInstance` 只按当前 scope 注销，永远清不掉）。
- **R-06 `init`/`destroy` 对称**：任何「初始化资源」的地方必须有对应的「销毁/退订」路径，且作用域一致（per-instance 或 plugin 级二选一，不能 `init` 是 per-instance、`destroy` 是 plugin 级）。

## 6. 工具函数与常量

- 通用工具集中在 `common/utils.ts`（`now` / `pageParams` / `clientIp` / `createRateLimiter`），**重复出现三次的片段必须提取**。
- 领域内共享的纯函数放对应领域目录（如 `plugins/plugin-dispatch.utils.ts`），不跨领域 import 实现细节。
- 魔法数字/字符串提为命名常量（`PLUGIN_MANIFEST`、`TOTAL_LIMIT` 等）。

## 7. 测试规范

- 单测 `*.spec.ts`，与源码同目录（`plugin.service.spec.ts` 模式）。
- **必须覆盖**（生命周期的坑都在这里）：
  - `enableInstance` / `disableInstance` / `deleteInstance` 三态；
  - scope 分区与单向覆盖（`SHARED→LOCAL` 允许、反向拒绝）；
  - SPI `resolve` 的共享/本地/`minVersion`/缓存失效；
  - `autoInstantiate` 的拓扑排序与环检测（单环、多环）。
- repository 测试用临时目录 + 内存 SQLite（`mkdtempSync` + `better-sqlite3`），测试结束 `rmSync` 清理。
- 涉及文件系统/多媒体的纯函数（`matchPath`、`sanitizeDispositionFilename`、`isSafePath`）**必须有单元测试**。

## 8. 命名与映射对照（速查）

| DB 列 | 实体字段 | 说明 |
|-------|----------|------|
| `plugin_type` | `pluginType` | repository 边界转换 |
| `data_scope` | `dataScope` | `as DataScope` 断言 |
| `content_hash` | `contentHash` | — |
| `loaded` (0/1) | `loaded: boolean` | `=== 1` 转换 |

布尔列 DB 存 `0/1`，实体为 `boolean`，映射用 `=== 1` / `? 1 : 0`，**不得**在 SQL 里写 `'true'/'false'`。
