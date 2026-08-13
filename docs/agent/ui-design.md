# Atlas 前端 UI 设计规范

适用范围：`packages/web` 主应用 UI 与所有插件 UI 面板（插件面板复用同一套设计系统）。

> 本文档是 UI 的**唯一事实来源**：改样式先看这里；新增视觉元素必须落到 token，禁止硬编码颜色/字号/圆角。

---

## 1. 设计原则

1. **简洁克制**：浅灰背景 + 白色内容卡片 + 单一品牌色，装饰性元素最小化（Apple 式界面语言）。
2. **内容优先**：层级靠字号/字重/颜色而非边框堆叠；能用一个 `muted` 说明的，不加第二个标签。
3. **反馈一致**：所有可点击元素有 hover/active/focus 三态，动效统一 0.15–0.2s。
4. **可访问**：可交互元素必须有 `:focus-visible` 焦点环；状态不只靠颜色表达（配图标或文字）。

---

## 2. 设计 Token（Design Tokens）

> 所有样式必须引用 CSS 变量（定义在 `src/style.css` 的 `:root`），**禁止在组件内硬编码颜色/字号/圆角**。

### 2.1 颜色

#### 现有核心 token（已定义，直接使用）

| 变量 | 值 | 用途 |
|------|-----|------|
| `--atlas-bg` | `#f5f5f7` | 页面背景 |
| `--atlas-surface` | `#ffffff` | 卡片/面板背景 |
| `--atlas-stroke` | `#e4e4e8` | 边框、分割线 |
| `--atlas-text` | `#1d1d21` | 主文字 |
| `--atlas-muted` | `#5f5f6a` | 次级文字、说明 |
| `--atlas-accent` | `#4f6ef7` | 品牌色、主按钮、选中、链接 |

#### 待补全的语义 token（当前散落硬编码，必须收敛）

> 现状：错误红 `#f56c6c`、警告橙 `#e6a23c`、中性灰 `#909399` 在多个 `.vue` 中硬编码。请补入 `:root` 后统一替换。

| 变量 | 建议值 | 用途 |
|------|--------|------|
| `--atlas-success` | `#67c23a` | 成功态（Element Plus 默认） |
| `--atlas-warning` | `#e6a23c` | 警告态 |
| `--atlas-danger` | `#f56c6c` | 错误/危险态 |
| `--atlas-info` | `#909399` | 中性信息 |
| `--atlas-accent-weak` | `rgba(79,110,247,0.05)` | 品牌色浅底（选中背景） |
| `--atlas-accent-border` | `rgba(79,110,247,0.18)` | 品牌色浅边框 |
| `--atlas-shadow-card` | `0 6px 20px rgba(79,110,247,0.14)` | 卡片 hover 阴影 |
| `--atlas-shadow-soft` | `0 2px 8px rgba(79,110,247,0.08)` | 轻阴影 |

> 规则：**新增一个颜色 → 先加 token 再用**。临时色值必须在 MR 注释里说明为何不能 token 化。

### 2.2 字体

```css
/* 主字体栈（已定义，勿改） */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
             'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
/* 等宽（代码/ID/密钥） */
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
```

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| 页面标题 | 20px | 600 | `.page-title` |
| 卡片标题 | 16px | 700 | 应用名、面板名 |
| 正文 | 13px | 400 | 描述、表格 |
| 辅助 | 12px | 400 | 脚注、提示、元信息 |
| 等宽 | 12px | 400 | appId、token、pluginType |

- 只允许使用上述字号档位，**不得**出现 14px、15px、18px 等中间值（除非设计明确新增档位并同步本表）。

### 2.3 间距

| token 语义 | 值 | 用途 |
|-----------|-----|------|
| xs | 4px | 图标与文字最小间隔 |
| sm | 8px | 组内元素间隔 |
| md | 12–14px | 卡片内 gap、栅格 gap |
| lg | 16px | 卡片 padding、区块间距 |
| xl | 20–24px | 页面 padding、区块间距 |

- 页面统一 `.page { padding: 24px; max-width: 1200px; margin: 0 auto }`。
- 卡片内 gap 用 10–16px，栅格 gap 用 14–16px，保持节奏一致。

### 2.4 圆角

| 值 | 用途 |
|----|------|
| 8px | 小元素（提示条、输入框附属） |
| 10px | 默认卡片（`.surface`、`.plugin-card`） |
| 12px | 强调卡片（`.app-card`、`.stat-card`） |
| 50% | 圆形（勾选、头像、图标底） |

### 2.5 阴影与描边

- **默认卡片**：`1px solid var(--atlas-stroke)`，无阴影。
- **hover**：`border-color: var(--atlas-accent)` + `box-shadow: var(--atlas-shadow-card)`。
- **选中**：`border-color: var(--atlas-accent)` + 浅底 `var(--atlas-accent-weak)` + 可选 `inset` 环。
- 阴影只用品牌色系（`rgba(79,110,247,…)`），不用纯黑阴影。

### 2.6 动效

| 场景 | 时长 | 缓动 | 效果 |
|------|------|------|------|
| 卡片 hover | 0.15–0.18s | ease | `translateY(-2px)` + 阴影 + 边框色 |
| 卡片 active | — | — | `translateY(0)` 回落 |
| 图标/箭头 | 0.18s | ease | 颜色 + 位移（如 chevron `translateX(2px)`） |
| 抽屉/对话框 | Element Plus 默认 | — | 不自定义 |

- 动效只做**位移 + 阴影 + 边框色 + 颜色**四类，禁止缩放（scale）和大幅位移动画。

---

## 3. 布局体系

### 3.1 页面骨架（所有视图遵循）

```html
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">标题</h1>
      <p class="page-desc">说明</p>
    </div>
    <!-- 右侧操作（刷新按钮等） -->
  </div>
  <div class="surface">…内容…</div>
</div>
```

- `.page-header`：`flex; justify-content: space-between; margin-bottom: 20px`。
- 内容卡片统一 `.surface`（白底、10px 圆角、16px padding）。

### 3.2 栅格

- 卡片网格：`grid-template-columns: repeat(auto-fill, minmax(220px~320px, 1fr)); gap: 14–16px`。
- 应用卡片 `minmax(320px,1fr)`；控制台统计卡 `minmax(220px,1fr)`。
- 创建抽屉的插件选择器用两列网格 `repeat(2, minmax(0,1fr))`，超出滚动（`max-height` + `overflow-y:auto`）。

### 3.3 侧边栏

- 宽 200px，白底 + 右描边；菜单项图标 + 文字；底部固定「退出登录」。
- 系统级插件菜单项（`system-menu` slot）与内置菜单同视觉形态（图标 16px 圆角 3px）。

---

## 4. 组件规范

### 4.1 卡片

| 类型 | 圆角 | 交互 |
|------|------|------|
| `.surface`（内容容器） | 10px | 无 hover |
| `.app-card` / `.plugin-card` / `.stat-card`（可点击） | 12px / 10px / 12px | hover 上浮 + 品牌阴影，`:focus-visible` 焦点环 |

- 可点击卡片必须有 `cursor: pointer`、hover 三态、键盘可达（`tabindex`/原生 button 语义）与 `:focus-visible` 焦点环。
- 卡片内文字溢出统一 `overflow:hidden; text-overflow:ellipsis`（单行）或 `-webkit-line-clamp`（多行，如 `.app-desc` 两行）。

### 4.2 表格

- 统一 Element Plus `<el-table>`：`v-loading`、空态文案 `empty-text`。
- 首列（插件/应用名）用 `min-width` + 图标；类型/状态列用窄列（90–150px）；操作列 `fixed="right"`。
- 状态一律用 `<el-tag>`（见 4.4）+ 图标双通道表达，**不只靠颜色**。

### 4.3 按钮

- 主操作 `type="primary"`（品牌色）；危险操作 `type="danger"` + `plain`；次要操作用文字按钮（`text`）或圆形图标按钮（`circle`）。
- 图标按钮必须配 `el-tooltip` 说明（可访问性）。

### 4.4 Tag 状态色（双通道）

| 状态 | type | 语义 |
|------|------|------|
| 正常/启用/已加载 | `success` | 绿 |
| 暂停/警告/共享 | `warning` | 橙 |
| 吊销/危险 | `danger` | 红 |
| 外部/中性 | `warning` 或 `info` | 橙/灰 |

- Tag 与状态文字同时出现（如「已加载」+ 绿色 Tag），保证色盲可用。

### 4.5 抽屉 / 对话框

- 表单类操作用 `<el-drawer>`（创建应用、数据集管理）；确认类操作用 `<el-message-box>`（删除/轮换/吊销）。
- 凭证展示对话框：`title` 带「仅展示一次」警告 `el-alert`，输入框 `readonly` + 复制按钮。

### 4.6 空状态

- 空数据统一展示：图标（`el-icon`，`--atlas-accent` 色、`opacity:0.5`）+ 说明文案 + 可选次级提示。
- 用 `.empty-hint` / `.empty-state` 容器，居中、`--atlas-muted` 色。

### 4.7 分页

- 统一 `<el-pagination layout="total, sizes, prev, pager, next">`，右下对齐 `.pager`；`page-sizes` 用 `[10,20,50]`。

---

## 5. 图标规范

| 场景 | 尺寸 | 圆角 | 来源 |
|------|------|------|------|
| 插件图标（表格行首/卡片头） | 22px | 5px | 插件 `icons/`（SVG，`pluginIconUrl`） |
| Tab 图标 | 16px | 3px | 同上 |
| 侧边菜单插件图标 | 16px | 3px | 同上 |
| 核心功能图标 | Element Plus 图标 | — | `@element-plus/icons-vue` |

- **插件图标 SVG 规范**：100×100 viewBox、白底圆角、单色系低多边形风格（与平台品牌一致）；`data:` 内嵌或 `icons/xxx.svg` 相对路径，禁止外链位图。
- 核心功能（数据集、监控等）用 Element Plus 图标组件，**不混用**插件 SVG 与 EP 图标表达同一语义。

---

## 6. 插件 UI 视觉规范

插件面板是平台 UI 的一部分，**必须复用本设计系统**：

- **背景/文字/边框**：一律用 `--atlas-*` token，不自定义配色方案（品牌色可微调但需在插件 README 说明）。
- **卡片/表格/分页**：直接使用平台 `.surface` 样式与 `<el-table>`/`<el-pagination>`，保持交互一致。
- **挂载上下文**：面板根容器 `min-height: 120px`（`PluginMount` 已设），面板内部自行布局，避免外边距溢出。
- **模式差异化**（`ctx.mode`）：
  - `console`：卡片模式——概览概要，紧凑（`plugin-card` 头 + 内容）；
  - `app-space`：完整 Tab 面板——完整功能；
  - `system-menu`：系统详情页——无 appId，全量详情。
- 插件 UI 构建产物 `ui/` 不携带样式文件（CSS 已内联进 entry），禁止引入第三方 CSS 框架（Tailwind/Bootstrap），统一用 Element Plus + 本规范 token。

---

## 7. 交互与反馈

| 场景 | 反馈 |
|------|------|
| 异步操作 | `loading` 态（按钮/表格 `v-loading`） |
| 成功 | `ElMessage.success` |
| 失败 | `ElMessage.error`（拦截器统一，见 `services/http.ts`） |
| 危险操作 | `ElMessageBox.confirm` 二次确认，`type: 'warning'`/`'error'` |
| 401 | 全局回落登录页（`atlas:unauthorized` 事件） |
| 复制 | `copyText` + `ElMessage.success` 提示 |

- 统一文案语气：动词开头、简洁（「已启用」「已删除」「请先登录」）。
- 所有删除/轮换/吊销类操作**必须有二次确认**，不得一键执行。

---

## 8. 可访问性（A11y）

- 可交互元素：原生语义（`<button>`/`<a>` 或加 `tabindex="0"` + 键盘事件）+ `:focus-visible` 焦点环（`outline: 2px solid var(--atlas-accent)`）。
- 状态不只靠颜色：Tag + 文字、错误 + 图标双通道。
- 图标按钮必须有 `el-tooltip` 文本说明。
- 对比度：正文 `--atlas-text`(#1d1d21) on `--atlas-surface`(#fff) ≈ 15:1；`--atlas-muted`(#5f5f6a) on white ≈ 6.5:1，均满足 WCAG AA。

---

## 9. 反模式（Code Review 拦截项）

| ❌ 反模式 | ✅ 正确做法 |
|-----------|-------------|
| 组件内硬编码颜色（`#f56c6c` 等） | 用 `--atlas-*` token（先补 token 再用） |
| 新增 14px/15px 等中间字号 | 用 12/13/16/20px 档位 |
| 卡片 hover 用缩放（scale） | 位移 `translateY(-2px)` + 阴影 |
| 图标按钮无 tooltip | 配 `el-tooltip` |
| 状态只靠颜色（无文字/图标） | Tag + 文字双通道 |
| 插件面板自造配色/CSS 框架 | 复用 `--atlas-*` token + Element Plus |
| 删除/轮换无二次确认 | `ElMessageBox.confirm` |
| 手写图标 URL 拼接 | `pluginIconUrl` / `iconOf` |
| 纯黑阴影 `rgba(0,0,0,…)` | 品牌色阴影 `rgba(79,110,247,…)` |
