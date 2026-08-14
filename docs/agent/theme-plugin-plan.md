# UI 主题插件机制 — 规划（设计评审稿）

> 状态：**规划 / 待评审**。本文是把「主题当作插件」落地前的完整方案：目标、范围、接口、模块划分、加载流、改动清单、实施步骤、风险与回退。
> 关联：`docs/agent/ui-design.md §9`（设计稿）、`docs/ui-demo-white-preview.html`（白色现代主题参考）。
> 策略先行原则：第一版以「**CSS token 重皮肤 + 可选主壳 slot 覆盖**」起步，不要求主题重写整个 App.vue，先满足「多主题切换、持久化、可自定义」的 80% 价值，避免一次性大重构。

---

## 1. 目标与原则

### 1.1 目标

- UI 主题以**插件**形式存在：`plugins/<theme-dir>/`，可安装多套、一键切换、持久化。
- 切换主题 = 换一套 `--atlas-*` token + 可选覆盖主壳局部 UI（Logo、品牌区），**业务组件零改动**。
- 至少一个 `default:true` 主题兜底，卸载/加载失败不白屏。

### 1.2 非目标（第一版不做）

- 主题运行时**完全替换** App.vue 整体骨架（侧栏/内容全部自定义）——太重，先靠 token + 局部 slot 覆盖达成观感差异，整体骨架替换列为二期。
- 主题自定义业务路由/数据流。

### 1.3 原则

- 复用现有 UI 资产管线（`/_pluginui/{type}/*` 静态服务 + manifest + entry.js），不另起一套。
- 复用「slot 挂载」心智：新增一个 `shell` slot 语义，主题用它覆盖主壳局部。
- 后端只加「主题清单」读取与「默认主题」识别，不把主题运行逻辑塞进后端。
- 前端新增 `themeRegistry`，负责加载/应用/切换/持久化/回落。

---

## 2. 架构现状（已核对）

| 层 | 现有机制 | 对主题的影响 |
|----|---------|-------------|
| 后端 UI 资源 | `plugin-ui.service.ts` 读 `plugins/{type}/ui/`，`plugin-ui.controller.ts` 暴露 `/_pluginui/{type}/{path}` | **可直接复用**：主题入口/token 也可经此静态服务 |
| 后端 manifest | `PluginUiManifest{pluginType,name,icon,version,slots}`，`manifestOf()` 读 `ui/manifest.json` | 需扩展 `theme` 字段，或新增 `theme` 读取 |
| 后端插件注册 | `PluginRegistry` / `AtlasPlugin.type` 全局唯一 | 需放行并识别 `type:'theme'`（或新保留前缀），不当作业务插件实例化 |
| 前端 slot | `PluginSlotName` = `app-space` / `console` / `system-menu`，`slotsOf()` 动态 import `/_pluginui/{type}/{entry}` | 新增 `'shell'` slot 值用于主题覆盖 |
| 前端壳 | `App.vue` **硬编码**侧栏+content chrome | 需拆出可覆盖部位 / 读取当前主题 token |
| 样式 | `style.css :root` 定义 `--atlas-*`（当前白色现代） | 主题即覆盖这些变量，`[data-theme]` 作用域隔离 |

### 2.1 架构示意

```text
┌──────────── Browser 前端 (web) ─────────────┐
│  main.ts                                   │
│    ├─ initPluginSlots()  ──┐               │
│    └─ initThemes()         │               │
│                            ▼               │
│   slotRegistry.ts      themeRegistry.ts    │
│   (app-space/console/   |- /api/themes      │
│    system-menu/shell)    |- 应用 tokens→:root │
│                          |- localStorage 持久化│
│                          |- 失败→回落 default │
│          ▲ 响应式 currentTheme              │
│          │                                 │
│   App.vue: <div id="app" [data-theme]>      │
│      ├─ 默认侧栏+content chrome             │
│      └─ <PluginMount mode="shell"/> (可选)  │
└──────────────┬─────────────────────┬───────┘
               │ /_pluginui/{type}/*  │ /api/themes
┌──────────────▼──────────┐   ┌───────▼────────────┐
│ 后端 core               │   │ plugins/{theme}/   │
│  plugin-ui.controller   │   │  manifest.json     │
│  plugin-ui.service      │◄──┤   Ui entry/hash.js │
│  (复用静态服务+过滤)      │   │   icons/, README   │
└─────────────────────────┘   └────────────────────┘
```

---

## 3. 接口设计

### 3.1 主题 manifest 扩展（`@atlas/types`）

```ts
// PluginUiSlot.slot 新值
export type PluginSlotName = 'app-space' | 'console' | 'system-menu' | 'shell'

export interface ThemeTokens {
  [cssVar: string]: string            // 例如 "--atlas-bg": "#ffffff"
}

// manifest.json 的 theme 段（可选；无则视为普通插件）
export interface PluginUiManifest {
  pluginType: string
  name: string
  icon?: string
  version?: string
  slots: PluginUiSlot[]
  theme?: {
    /** 是否为平台默认主题（至少一个，缺省第一版按是否 default=true 判断） */
    default?: boolean
    /** 覆盖的一组 --atlas-* 变量；缺省则继承平台内置默认 token */
    tokens?: ThemeTokens
    /** 可选：主题自带的主壳局部覆盖入口（如品牌 Logo / 强调组件），Entry 契约同 PluginUiEntry */
    shellEntry?: string
  }
}
```

### 3.2 前端 `themeRegistry.ts`（新增，`packages/web/src/plugin-host/`）

```ts
export interface AtlasTheme {
  pluginType: string
  name: string
  icon?: string
  default: boolean
  tokens: Record<string, string>
  shellEntry?: () => Promise<PluginUiEntry>
}

// 响应式当前主题
export const currentTheme = shallowReactive<{ theme: AtlasTheme; applied: boolean }>({ theme: null!, applied: false })

export async function initThemes(): Promise<void>   // 启动：拉 /api/plugins/ui + /api/plugins 过滤 theme，加载默认
export function selectTheme(pluginType: string): Promise<boolean>  // 应用切换并持久化到 localStorage
export function themeOf(pluginType: string): AtlasTheme | null
export function useTheme(): ComputedRef<AtlasTheme>   // 当前主题
```

### 3.2.1 应用策略

- 把 `theme.tokens` 写入根元素 `document.documentElement.style`（`[data-theme=...]`）或直接 setProperty 到 `:root`；卸载时先还原为内置默认。为隔离，建议 `[data-theme="<pluginType>"]` 挂在 `#app` 外 + `:root` 备用。
- `shellEntry` 若提供，挂载到主壳预留的 `<PluginMount mode="shell"/>` 区域（如覆盖品牌区/高亮组件）；缺省时用内置默认 chrome。

### 3.3 后端（改动最小）

- `plugin-ui.service.ts`：`allManifests()` 已全量返回 manifest，只需在 `@atlas/types` 里让 `PluginUiManifest` 感知 `theme?` 字段（JSON.parse 透传即可）。
- `plugin-ui.controller.ts`：已能 `/_pluginui/{type}/{entry}`、`icons/...` 服务主题的 shellEntry 与图标，**默认无需新增端点**；可选加一个 `GET /api/themes` 汇总（过滤 `theme?`），前端 `initThemes` 用它更干净。
- `plugin.registry`：主题插件是否作为实例化业务插件处理需要在序列化层说明（见 §4.3）。

---

## 4. 目录 / 模块划分

```text
packages/
  types/src/index.ts
    + PluginUiManifest.theme?   // 类型
    + PluginSlotName + 'shell'
  core/src/plugins/
    plugin-ui.service.ts        // (微改) 复用 + 可选全量 theme 过滤
    (可选) plugins.controller.ts 或复用 ui controller 增 /api/themes
  web/src/
    plugin-host/themeRegistry.ts   // 新增：主题加载/应用/切换/持久化/回落
    plugin-host/slotRegistry.ts    // 扩：slotsOf('shell') 过滤主题 shellEntry
    App.vue                        // 重构：初始应用主题 → 渲染当前主题 token 作用域 + 预留 shell 挂载点
    style.css                      // 内置默认 token 抽成可被覆盖的 :root（含白色现代）
    views/SettingsView.vue(可选)    // 主题切换面板（列出已装主题，radio 选择）
plugins/
  theme-default/                    // 新增：白色现代主题插件（把当前设计包成插件）
    manifest.json                  // { pluginType:'theme-default', ..., theme:{default:true,tokens:{...}} }
    ui/manifest.json               // slots 含 shell（可选）或仅靠 tokens
    ui/entry.{hash}.js             // 空 shell 或品牌区覆盖（可选）
    icons/theme.svg
    README.md
```

---

## 5. 加载流（时序）

```text
用户打开 Atlas
  ① main.ts: initPluginSlots()   +   initThemes()
  ② themeRegistry.initThemes():
        GET /api/themes (或 /api/plugins/ui 过滤 theme?)
        取 default=true 的主题 → 应用到 :root/[data-theme]（写 CSS 变量）
        读 localStorage['atlas-theme'] → 若存在且已注册 → selectTheme(它)
  ③ App.vue: 根元素挂 [data-theme=当前主题]；渲染默认 chrome；若有 shellEntry 挂 <PluginMount mode="shell"/>
  ④ 用户切换主题（设置页）:
        selectTheme(newTheme)
        · apply tokens（写 CSS 变量/切换 [data-theme]）
        · 重挂/卸载 shellEntry
        · localStorage['atlas-theme']=newTheme.pluginType
  ⑤ 主题插件热加载/卸载：registry 变化 → 若正在用被卸载主题 → 回落 default
  ⑥ 任何一步加载失败 → 回落 default 主题，页面不白屏
```

### 关键点

- **tokens 应用**是主干（零组件改造即可换肤）；`shellEntry` 是可选增强。先用 token 达成，shell 作为二期。
- **回落**在 `selectTheme`/`initThemes` 内 try/catch，永远有 default 兜底。

---

## 6. 文件改动清单（估算）

| 文件 | 改动 | 风险 |
|------|------|------|
| `@atlas/types` `index.ts` | 类型 + shell slot | 低 |
| `core/.../plugin-ui.service.ts` | 复用；可选全量过滤 | 低 |
| `core` (可选) 主题汇总端点 | 新增 1 个只读端点 | 低 |
| `web/.../slotRegistry.ts` | `slotsOf('shell')` | 低 |
| `web/.../themeRegistry.ts` | 新增核心 | 中（新代码） |
| `web/src/App.vue` | 应用主题作用域 + 预留挂载点 | 中（壳改动） |
| `web/src/style.css` | 默认 token 抽成可覆盖根 | 低–中 |
| `web/src/views/SettingsView.vue` | 主题切换 UI（新视图/并入安全设置） | 中 |
| `main.ts` | 调用 `initThemes` | 低 |
| plugins/theme-default/ | 新增白色现代主题插件 | 低–中（构建/脚本） |
| `docs/agent/ui-design.md` | 规范化（已含 §9 设计稿） | — |

---

## 7. 实施步骤（分阶段，先 token 后 shell）

### Phase 1 — 机制骨架（先跑通切换/持久化/回落）

1. `@atlas/types` 加 `theme?` 字段与 `shell` slot。
2. `themeRegistry.ts`：`initThemes`/`selectTheme`/`useTheme`，应用 tokens 到根、localStorage 持久化、失败回落。
3. 后端 `PluginUiService` 复用 +（可选）`/api/themes`。
4. `main.ts` 接入 `initThemes`；`App.vue` 根元素挂 `[data-theme]`。
5. 新增 `plugins/theme-default/`，只含 `manifest.json`（`theme:{default:true, tokens:白色现代}`），UI 空 shell。

### Phase 2 — 主题切换入口

1. 提供一个主题切换 UI（可临时放安全设置页或单独设置页）：列出已装主题（`/api/themes`）、radio 选择、切换即时生效。

### Phase 3 — shell 覆盖（可选增强）

1. `slotsOf('shell')` 支持；`App.vue` 预留 `<PluginMount mode="shell"/>`；演示 shellEntry 覆盖品牌区/重点组件。
2. 加一个第二主题样例（如深色 `theme-obsidian`）用于对比验证切换。

### Phase 4 — 收尾

1. 测试（vitest：themeRegistry 切换/持久化/回落；后端 manifest 解析）。
2. `ui-design.md` 把 §9 从设计稿升级为正式规范；补齐主题插件 README 模板。

---

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| `PluginSlotName` 加 `'shell'` 影响现有 slot 枚举 | 向后兼容：加枚举值不破坏既有值；`slotsOf` 对未知 slot 兜底空数组 |
| 主题 token 与组件硬编码色冲突 | 规范 §10 反模式：组件必须用 `--atlas-*`，否则主题覆盖不生效；落地时同步清理硬编码 |
| 主题插件被当作业务插件实例化（误触发 init/destroy） | 注册层识别 `type:'theme'`/manifest `theme?`，跳过实例化路径（明确策略见 §1.3） |
| 卸载在用主题 --> 白屏 | `selectTheme` 卸载先校验 fallback；themeRegistry 恒保留 `default` |
| 动态 import 主题 entry 失败（构建产物 hash） | 沿用现有 entry 加载 + try/catch 回落 |
| 主题不刷新组件的 Element Plus 主色 | 需同步覆盖 `--el-color-primary` 等，或提供主题默认映射 |
| 后端清单不带 theme（若不加 /api/themes） | 前端从 `/api/plugins/ui` 整体过滤 `manifest.theme`，无需新端点 |

---

## 9. 验收标准

- [ ] 安装多套主题（theme-default 必选 + 一个样例），设置页可切换，刷新保持。
- [ ] 切换主题后，业务组件与插件面板随 `--atlas-*` token 联动换肤，无需改组件。
- [ ] 卸载/删除在用主题或加载失败 → 自动回落 default，不白屏。
- [ ] 新增 slot `shell` 不破坏现有 `app-space/console/system-menu` 行为（现有插件面板可用）。
- [ ] 全量 `npm test` 通过；`lint:md` 通过。

---

## 10. 里程碑建议

- **M1（机制 + default 主题 + 切换）**：Phase 1+2，交付"能装多个主题、能切换、能持久化、有兜底"。
- **M2（shell 覆盖 + 样例主题）**：Phase 3，交付"主题可自定义局部组件"。
- **M3（规范 + 测试固化）**：Phase 4。

> 建议 M1 优先落地——它用最少改动达成主题化的核心价值，且不影响现有功能；M2/M3 视需求再排。
