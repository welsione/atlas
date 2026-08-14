# 前端核心框架开发规范（packages/web）

适用范围：`packages/web/src/**` 的贡献者。核心原则：**services 层唯一 HTTP 出口、slot 运行时契约单一、挂载/卸载对称**。

---

## 1. 目录与分层

```text
views/         页面（组合层）：App.vue / ConsoleView / AppSpaceView / ...
services/      API 层：唯一 HTTP 出口，薄封装 http.ts
plugin-host/   插件挂载运行时：PluginMount.vue + slotRegistry.ts（契约单一入口）
runtime/       共享运行时导出：vue/ep/icons/@atlas/runtime 的 vendor 入口
types/         前端补充类型（优先复用 @atlas/types）
```

- **services 层是唯一 HTTP 出口**：所有请求经 `http.ts` 的 `get/post/put/del`，禁止在组件里直接 `axios` / `fetch`。
- **DTO 类型优先从 `@atlas/types` 导入**，`packages/web/src/types` 只放前端特有的视图类型；后端 DTO 不得在 web 重复定义。

```ts
// ✅
import type { App, PluginOverviewRow } from '../types'
const res = await pluginApi.overview(appId, page, size)

// ❌ 组件内直接 axios
axios.get(`/api/apps/${id}/plugins`)
```

## 2. 组件与状态

- Vue 3 `<script setup lang="ts">`；`defineProps<...>()` / `defineEmits<...>()` 显式类型。
- **不直接改 props**：需要联动时复制本地副本（`AppSpaceView` 的 `localApp` 模式）。
- 跨组件共享的响应式状态用**模块级 `reactive`**（`slotRegistry` 的 `pluginManifests` 模式），避免 props 层层下钻。
- 组件卸载必须清理副作用（`onBeforeUnmount` + 定时器/事件监听/挂载的插件实例）。

## 3. slot 运行时（契约单一入口）

> `slotRegistry.ts` 是插件 UI 的**唯一注册/查询入口**，`PluginMount.vue` 是**唯一挂载器**。新 slot 类型或渲染位置改动必须收敛到这里。

- **F-01 slot key 必须唯一**：格式 `plugin:${pluginType}` 对同一插件多个同类型 slot 会碰撞（Vue 重复 key、Tab 覆盖）。同一插件多个 slot 需追加子标识：`plugin:${type}:${tab ?? title ?? idx}`。
- **F-02 `initPluginSlots` 生命周期**：`/api/plugins/ui` 与 `/api/plugins` 需要管理认证，登录前会 401。**登录成功后（`handleAuthed`）必须重新调用 `initPluginSlots()`**，否则插件 Tab/卡片/侧边菜单要刷新页面才出现。启动时调用一次 + 登录后补一次，缺一不可。
- **F-03 mount/unmount 对称**：`PluginMount` 卸载时 `unmount?.()` + `host.innerHTML = ''`，且要处理「load 异步进行中被卸载」的竞态（挂载前再次确认 host 仍在且未被卸载）。
- **F-04 图标统一走 `pluginIconUrl` / `iconOf`**：不要在各视图手写图标 URL 拼接。

```ts
// ✅ 唯一 key
result.push({ key: `plugin:${m.pluginType}:${s.tab ?? s.title ?? 'slot'}`, ... })

// ❌ 多个 slot 同 key
result.push({ key: `plugin:${m.pluginType}`, ... })
```

## 4. 共享运行时（runtime/）

- `vue` / `element-plus` / `@element-plus/icons-vue` / `@atlas/runtime` 是 **external**：由 `index.html` 的 import map 指向 `/runtime/*-vendor.js`，插件 UI 与主应用共享单实例。
- **新增运行时导出必须三处同步**：
  1. `packages/web/src/runtime/*-entry.ts` 的 `export *`；
  2. `vite.config.ts` 的 `rollupOptions.external`；
  3. `index.html` 的 import map。
  缺一处会导致「主应用与插件 UI 两个 Vue 实例」或「运行时解析失败」。
- 图标库独立 vendor（`icons-entry.ts`），避免与 element-plus 的 Filter/Message/Sort 命名冲突——新增导出时注意命名空间冲突。

## 5. 构建与静态同步

- 前端产物发布路径：`npm run build:web`（→ `web/dist`）→ `npm run sync:static`（→ `core/static` 与 `core/dist/static`）。
- **提交前必须 `sync:static`**：运行中的服务从 `core/static` 读产物，只 build 不同步会导致「改了代码线上不生效」。
- 插件面板构建走插件目录自己的 `ui-src/build.mjs`，**不**参与主应用 build。

## 6. 测试规范

- 已有基础覆盖（`vitest run`，jsdom）：
  - `slotRegistry.spec.ts`：`slotsOf` / `useSlotsOf` / `pluginIconUrl` / `toMountEntry` / `initPluginSlots`（纯逻辑 + mock http）；
  - `http.spec.ts`：请求拦截（Bearer）、401 派发 `atlas:unauthorized`、错误提示（mock adapter）；
  - `PluginMount.spec.ts`：mount → unmount 清理、load 进行中卸载的竞态；
  - `App.spec.ts`：认证门（登录/登出切换）+ 登录后重拉插件 slot（F-02 回归）。
- 新增逻辑**必须补测试**的硬性场景：
  - slotRegistry 的新增 slot 类型 / key 生成规则（唯一 key 回归）；
  - http.ts 拦截器行为变更（401/错误码处理）；
  - `PluginMount` / `App` 生命周期改动（挂载/卸载对称、认证门）；
  - 认证相关回归（F-02：登录成功必须 `initPluginSlots()`）。
- 优先测纯函数与契约边界，组件快照测试不作硬性要求。

## 7. 反模式（Code Review 拦截项）

| ❌ 反模式 | ✅ 正确做法 |
|-----------|-------------|
| 组件里 `axios`/`fetch` | 走 `services/*` + `http.ts` |
| 手写 `localStorage` 读写 token（散落各处） | 用 `AUTH_TOKEN_KEY` 常量 |
| 在视图里拼接插件图标 URL | `pluginIconUrl(pluginType, iconOf(pluginType))` |
| 重复定义后端 DTO | 从 `@atlas/types` 导入 |
| 修改 props | 复制本地副本 / emit 事件 |
| mount 后不返回 unmount | 插件 entry 与 `toMountEntry` 都必须返回清理函数 |
