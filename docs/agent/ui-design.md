# Atlas 前端 UI 设计规范

适用范围：`packages/web` 主应用 UI 与所有插件 UI 面板（插件面板复用同一套设计系统）。

> 本文档是 UI 的**唯一事实来源**：改样式先看这里；新增视觉元素必须落到 token，禁止硬编码颜色/字号/圆角。
>
> **当前默认主题：白色现代（White Modern）**。视觉选型与可缩放参考见 `docs/ui-demo-white-preview.html`，其底部「设计标准」面板记录了本规范的 token 档位。UI 主题可按「主题插件」机制扩展（见 §10）。

---

## 1. 设计原则

1. **整页纯白一体**：侧栏与主内容区共用**同一 `#ffffff` 背景**，无分割线拼贴；靠卡片浮层、菜单高亮与内容本身的层次表达结构。
2. **扁平克制**：默认态几乎无阴影，卡片靠 **浅边框 + 轻阴影** 从纯白底上浮出；hover 时阴影加深、轻微上浮（`translateY(-1px)`），不"一直凸着"。
3. **内容优先**：层级靠字号/字重/颜色而非边框堆叠；能用一个 `muted` 说明的，不加第二个标签。
4. **品牌强调克制**：单一品牌靛蓝 `#4f6ef7` 只用于主按钮、选中、链接、关键图标；成功 `#10b981`、危险 `#e4573d` 表达状态，靠**双通道**（Tag + 文字/图标）保证可读。
5. **动效统一**：0.14–0.2s，只做位移/阴影/颜色/边框四类。
6. **可访问**：交互元素必须有 `:focus-visible` 焦点环；`--atlas-muted` 在纯白上 ≥ 6.5:1。

---

## 2. 设计 Token（Design Tokens）

> 所有样式必须引用 CSS 变量（定义在 `src/style.css` 的 `:root`），**禁止在组件内硬编码颜色/字号/圆角**。

### 2.1 颜色

> 全部颜色定义在 `src/style.css` 的 `:root`。**新增颜色 → 先加 token 再用**；临时色值必须在 MR 注释说明为何不能 token 化。

#### 核心 token（白色现代，已冻结）

| 变量 | 值 | 用途 |
|------|-----|------|
| `--atlas-bg` | `#ffffff` | 整页统一纯白背景（侧栏 + 主内容区同色） |
| `--atlas-surface` | `#ffffff` | 卡片/面板背景 |
| `--atlas-layer` | `#fafbfe` | 浅分层（表头底、悬浮浅底） |
| `--atlas-stroke` | `#e9ecf3` | 边框、分割线（1px） |
| `--atlas-stroke-strong` | `#dde2ec` | 更强边框（hover 加深） |
| `--atlas-text` | `#161a2b` | 主文字（深灰黑） |
| `--atlas-muted` | `#5f6a85` | 次级文字、说明 |
| `--atlas-faint` | `#9aa3b8` | 弱化文字（时间戳、占位） |
| `--atlas-accent` | `#4f6ef7` | 品牌靛蓝：主按钮/选中/链接/关键图标 |
| `--atlas-accent-strong` | `#3d5de8` | 品牌蓝 hover |
| `--atlas-accent-soft` | `#eef1ff` | 品牌浅底（选中项、图标底块、标签底） |
| `--atlas-success` | `#10b981` | 成功态（已启用/正常/新增） |
| `--atlas-warning` | `#f5a623` | 警告态 |
| `--atlas-danger` | `#e4573d` | 危险/错误态（含 hover 底 `#fdf0ee`） |
| `--atlas-info` | `#6b7280` | 中性信息 |

#### 阴影 token

| 变量 | 值 | 用途 |
|------|-----|------|
| `--atlas-shadow-card` | `0 1px 2px rgba(20,28,60,.04), 0 1px 3px rgba(20,28,60,.05)` | 卡片默认（纯白底上的轻浮层） |
| `--atlas-shadow-hover` | `0 2px 6px rgba(20,28,60,.06), 0 6px 16px rgba(20,28,60,.10)` | 卡片 hover / 上浮 |
| `--atlas-shadow-button` | `0 4px 12px rgba(79,110,247,.20)` | 主按钮品牌色阴影 |

### 2.2 字体

```css
/* 主字体栈（已定义，勿改） */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
             'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
/* 等宽（代码/ID/密钥） */
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
```

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| 页面标题 | — | — | 由面包屑承载（不再单独大标题，见 §7.1） |
| 区块标题 | 15px | 700 | `h2` 插件服务/最近应用，前配品牌蓝竖标 |
| 卡片标题 | 14px | 700 | 应用名、插件名、面板名 |
| 大数字（统计） | 32px | 800 | 统计卡数值，`font-variant-numeric: tabular-nums`，字距 `-1px` |
| 正文 | 13px | 400 | 描述、表格 |
| 辅助 | 11–12px | 400 | 表头、脚注、元信息、kicker |
| 等宽 | 12px | 400 | appId、token、pluginType |
| 图标字号（el-icon） | 18–20px | — | 卡片图标章、危险区警示图标（配 `--atlas-accent`/`--atlas-danger` 色） |

- 只允许使用上述字号档位，**不得**出现 14px/16px 等中间值（卡片标题 14px、图标字号 18/20px 已在表中登记，其余新增须同步本表）。

### 2.3 间距

| token 语义 | 值 | 用途 |
|-----------|-----|------|
| xs | 4px | 图标与文字最小间隔 |
| sm | 8px | 组内元素间隔 |
| md | 10–12px | 卡片内 gap、菜单项 |
| lg | 14px | 卡片栅格 gap、区块内 gap |
| xl | 16–20px | 卡片 padding、页头与内容间距 |
| xxl | 26–28px | 区块间距、主内容顶部 |

- 整页 `--atlas-bg:#ffffff`；主内容内边距 `26px 36px 40px`，响应式收窄见 §9。

### 2.4 圆角

| 值 | 用途 |
|----|------|
| 6px | 小勾选/迷你 bar 顶 |
| 8px | 小元素、图标底块、菜单选中项 |
| 10px | 卡片、表格、按钮、输入框（默认） |
| 14px | 强调面板（标准面板、登录卡） |
| 20px+（pill） | Tag、胶囊（已加载、状态标） |
| 50% | 圆形头像/勾选 |

### 2.5 阴影与描边

- **卡片默认**：`1px solid var(--atlas-stroke)` + `box-shadow: var(--atlas-shadow-card)`（纯白底上的轻浮层）。
- **卡片 hover**：`var(--atlas-shadow-hover)` + `translateY(-1px)`，hover 边框可加深 `--atlas-stroke-strong` 或品牌蓝（可点卡片）。
- **选中**：品牌浅底 `var(--atlas-accent-soft)` + 品牌蓝文字/边框（如菜单项、勾选卡）。
- **按钮**：实心品牌蓝 + `var(--atlas-shadow-button)`，hover 品牌蓝深。
- 阴影尽量用**中性灰系**（`rgba(20,28,60,…)`），品牌蓝阴影只用于主按钮/强调。

### 2.6 动效

| 场景 | 时长 | 缓动 | 效果 |
|------|------|------|------|
| 卡片 hover | 0.16s | ease | `translateY(-1px)` + 阴影加深（默认态已是轻浮层，不作大幅位移） |
| 卡片 active | — | — | `translateY(0)` 回落 |
| 菜单 hover | 0.14s | ease | 浅底 `--atlas-layer`，选中浅蓝底 |
| 图标/箭头 | 0.18s | ease | 颜色 + 位移（如 chevron `translateX(2px)`） |
| 侧栏折叠 | 0.2s | ease | 宽度 `232px ↔ 64px` 过渡 |
| 抽屉/对话框 | Element Plus 默认 | — | 不自定义 |

- 动效只做**位移 + 阴影 + 边框色 + 颜色**四类，禁止缩放（scale）和大幅位移动画。

---

## 3. 布局体系

### 3.1 页面骨架（所有视图遵循）

```html
<div class="page">
  <div class="ph">   <!-- 页头：面包屑 + 右侧操作按钮 -->
    <nav class="crumb">首页 › <span class="cur">当前页</span></nav>
    <el-button type="primary" :icon="Plus">操作</el-button>
  </div>
  <div class="surface">…内容…</div>
</div>
```

- **页头不使用大标题**：层级由面包屑承载（`首页 › 当前页`），页面标题 = 面包屑最后一项；说明文字可并入区块标题旁（`.ttl-row .hint`）。
- `.page`：`padding: 26px 36px 40px;`（整页纯白）。
- `.surface`：白底、10px 圆角、16px padding、`--atlas-shadow-card`。

### 3.2 栅格

- 卡片网格：`grid-template-columns: repeat(auto-fill, minmax(220px~320px, 1fr)); gap: 14px`。
- 应用卡片 `minmax(320px,1fr)`；控制台统计卡 `repeat(4,1fr)`（窄屏降 2/1 列）。
- 创建抽屉的插件选择器用两列网格 `repeat(2, minmax(0,1fr))`，超出滚动（`max-height` + `overflow-y:auto`）。

### 3.3 侧边栏

- 宽 232px，**与主内容同底色 `#ffffff`**（无内部分隔色），右边界用 `1px var(--atlas-stroke)` 细线分隔。
- **可折叠成图标模式**（详见 §7.2）：收起后宽 64px、仅图标居中，悬停出气泡 tooltip。
- `position: sticky; top:0; height:100vh`，保证「退出登录」始终钉在可视底部。
- 品牌区：展开显示 `atlas-banner.svg`，收起显示 `atlas.svg`；**收起时点击 Logo 图标可展开**（Logo 自身即折叠开关，右上另有图标按钮）。
- 系统级插件菜单项（`system-menu` slot）与内置菜单同视觉形态（icons 24 网格线性图标 + 文字）。

---

## 4. 组件规范

### 4.0 区块标题（ttl-row）

- 区块标题统一：左侧 `4px` 品牌蓝竖标 + 15px/700 标题 + 灰说明 `.hint`（见 §3.1）。
- `<h2>` 前用 `.ttl-row::before` 实现竖标（`width:4px;height:15px;background:var(--atlas-accent)`）。

### 4.1 卡片

| 类型 | 圆角 | 交互 |
|------|------|------|
| `.surface`（内容容器） | 10px | 无 hover，`--atlas-shadow-card` |
| `.app-card` / `.plugin-card` / `.stat-card`（可点击） | 10px | hover 阴影加深 + `translateY(-1px)` + 边框品牌蓝，`:focus-visible` 焦点环 |

- 可点击卡片必须有 `cursor:pointer`、hover 三态、键盘可达与 `:focus-visible` 焦点环。
- 卡片文字溢出统一 `overflow:hidden; text-overflow:ellipsis`（单行）或 `-webkit-line-clamp`（两行）。
- **插件图标**：放进 `40px`、`--atlas-accent-soft` 浅蓝圆角底块（`.card .ico`），`24px` SVG。

#### 统计卡（stat-card）

- `padding:18px`；顶部 `kicker`（11px、品牌蓝小点 + muted 文字）→ 大数字 `32px/800/tabular` → `fixeline`（说明或 delta 一行，固定 `min-height` 对齐）→ 底部迷你趋势条。
- 迷你趋势条：`height:24px`、6 根浅蓝小柱（`--atlas-accent-soft`）；异常卡用浅红柱 `#fde2dd` + 数字红 `var(--atlas-danger)`。
- delta 成长用 `var(--atlas-success)`，错误用 `var(--atlas-danger)`。

### 4.2 表格

- 统一 Element Plus `<el-table>`：`v-loading`、空态文案 `empty-text`、`--atlas-shadow-card`、10px 圆角。
- 表头浅底 `--atlas-layer` + 11px/600 muted + 字母间距；行 hover `--atlas-layer`。
- 首列（插件/应用名）用 `min-width` + 图标；类型/状态列用窄列（90–150px）；操作列 `fixed="right"`。
- App ID 等标识用 `.mono`（12px 等宽）；状态列按 §4.4 双通道。

### 4.3 按钮

- 主操作 `type="primary"`（品牌靛蓝 `#4f6ef7`，实心头非渐变、10px 圆角、`--atlas-shadow-button`，hover 深蓝）。
- 危险操作 `type="danger"` + `plain`；次要操作用文字按钮（`text`）或圆形图标按钮（`circle`）。
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

- **表单类操作一律 `<el-drawer>`（`direction="rtl"`），全系统统一**：创建/编辑实体（新增应用、新增/编辑供应商、新增/编辑提示词、数据集管理、启用插件、实例管理）都用右侧抽屉，**不得用 `el-dialog`**。抽屉宽度 `size="520~600px"`（含多字段表单者取上限），必须带 `role="dialog"` + `aria-label`；移动端由全局规则自动全屏覆盖（§7.3），无需单独处理。
- **所有抽屉必须保留原生 header（含右上角 X 关闭按钮）**：禁止 `with-header="false"` 移除关闭入口；自定义头部内容放 body 首块（参考 providers 详情抽屉）。关闭途径恒为：X 按钮、遮罩点击、Esc。
- **轻量确认/展示用 `el-dialog`**：渲染测试、版本历史、对外设置开关等**单屏只读或一两控件**的辅助视图可保留居中 `el-dialog`（width 520–640）。判据：需要填写的字段 > 2 个，或内容纵向流式增长（表格/长表单）→ 抽屉；否则 dialog。
- 破坏性确认用 `<el-message-box>`（删除/轮换/吊销），不得用 drawer/dialog 承载确认语义。
- **表单布局统一 `label-position="top"`（方案 A，全场景一致）**：标签在控件上方、控件通栏，PC 抽屉与手机全屏抽屉同一形态、零断点分支。全站所有 `el-form` 不得使用 `label-width` 左标签（真实案例：providers 110px 左标签在抽屉内压缩控件宽度）。表单内下拉/选择器不写死 `style="width: NNNpx"`，跟随通栏；相关短字段需要并排时用自适应双列（`display:grid; grid-template-columns: repeat(2, minmax(0,1fr))`，§7.3），标签仍在上方。参考：AppsView 创建应用抽屉（全站基准风格）。
- 凭证展示对话框：`title` 带「仅展示一次」警告 `el-alert`，输入框 `readonly` + 复制按钮。

### 4.6 空状态

- 空数据统一展示：图标（`el-icon`，`--atlas-accent` 色、`opacity:0.5`）+ 说明文案 + 可选次级提示。
- 用 `.empty-hint` / `.empty-state` 容器，居中、`--atlas-muted` 色。

### 4.7 分页

- 统一 `<el-pagination layout="total, sizes, prev, pager, next">`，右下对齐 `.pager`；`page-sizes` 用 `[10,20,50]`。

### 4.8 应用详情看板（Board Tab）

> 应用详情页（`AppSpaceView.vue`）以**看板 Tab 为默认落地页**，承载应用身份、凭证、资源指标与危险操作，把原本挤在页顶的信息条收纳进一个专门的看板里。参考 `docs/ui-demo-appdetail-board.html`。

- **看板是应用详情的默认落地 Tab 与操作入口**：进入应用详情首先落在看板，从这里把握应用全貌；具体实例/数据操作仍在各自 Tab。
- **看板 Tab 只显示图标，不显示文字**：`el-tab-pane` 的 label 只放一个 4 宫格图标（如 `Grid`），选中态品牌蓝；其余 Tab（插件实例/数据集/接口监控）保留文字的常规样式。tabs 容器用 `border-bottom:1px var(--atlas-stroke)`，选中项 `2px` 品牌蓝下划线。
- 看板按以下板块自上而下组织：

1. **英雄面板（身份）**：`border-radius:14px`；左侧 62px 渐变圆角图标块（`--atlas-accent-soft`→浅青蓝），中间应用名 22px/800 + 状态 tag，下方行内展示 App ID（`.mono` + 复制）与创建时间；右侧「刷新」次要 +「启用插件」主按钮。
2. **凭证贯通条**：面板底部横贯通栏（`--atlas-layer` 底 + 顶部 `--atlas-stroke` 分线），左侧 App Secret 遮罩（`.mono`）+「仅创建/轮换时展示完整」说明，右侧「轮换凭证」（主）/「复制」（次要）。
3. **指标卡×3**（`repeat(3,1fr)`，窄屏降 2/1 列）：每张卡左上有 28px `--atlas-accent-soft` 图标章，右上角晕染 `--atlas-accent-soft` 圆做层次；数字 30px/800/tabular；fixeline 用 `--atlas-good` 强调正向增量。
4. **危险操作区**：板块标题 `.ttl-row`（「危险操作」+ hint）后接独立危险卡片——顶部 `--atlas-danger-soft` 浅红 header（警示 icon + 标题），主体左右分区：左说明、右「吊销应用」（实心红）/「删除应用」（描边红）。

- 看板**不使用快捷入口卡**（不放置跨 Tab 跳转卡片），保持信息型总览的克制。

### 4.9 危险操作分区（Danger Zone）

- 凡页面同时存在常规操作与破坏性操作（吊销/删除/轮换），**破坏性操作必须与常规操作物理分层/分卡**，不得混排在同一工具条。
- 危险卡统一形态：红头（`--atlas-danger-soft` 底 + `--atlas-danger` 标题文字与警示 icon）+ 主体（说明 `--atlas-muted` + 右侧实心 `--atlas-danger` 与描边 `--atlas-danger` 双按钮）。
- 「吊销 / 删除」均属破坏性，必须 `ElMessageBox.confirm`（`type:'error'`）二次确认。

### 4.10 双层导航（页面级 Tab + 视图级分段控件）

> 页面内容存在两级切换时（如应用详情的插件 Tab 内再分「接口管理 / 流量分析」），两级**不得使用同一视觉语言**，否则用户无法判断所处层级。

**层级语言约定（红线）**：

| 层级 | 形态 | 选中态 | 使用位置 |
|------|------|--------|----------|
| 页面级 | 下划线 Tab（`el-tabs` 默认：图标 + 文字 + 2px 品牌蓝下划线 + 底边线） | 品牌蓝下划线 + 品牌蓝文字 | App 详情页插件 Tab、侧边菜单对应的页面切换 |
| 视图级 | 胶囊分段控件（`--atlas-layer` 底容器 + `--atlas-stroke` 描边 + `10px` 圆角，`3px` 内边距） | 白底浮层（`--atlas-surface` + `--atlas-shadow-card`）+ 品牌蓝文字，**无下划线** | 同一页面内的视图切换（如接口监控内的接口管理/流量分析） |

- **一句话记忆：下划线 = 页面级，胶囊 = 视图级。**
- 分段控件规格：高 `28px`、字号 `13px`（比页面级 Tab 的 14px 降一档）、去图标（页面级 Tab 已有图标语境）、激活项 `--atlas-accent` 文字 600 字重、非激活 `--atlas-muted`、hover `--atlas-text`。
- **实现要点（缺一不可，否则容器被拉满整行）**：结构上复用 `el-tabs`（保留键盘方向键/滚动手势），scoped 样式需同时做四件事——参考 `MonitorPanel.vue` 的 `.monitor-tabs`：
  1. 隐藏原生下划线与底边线：`.el-tabs__active-bar`、`.el-tabs__nav-wrap::after` 置 `display:none`；
  2. `.el-tabs__header` 改 `display:flex`（脱离块级拉伸）；
  3. `.el-tabs__nav-wrap` 必须加 **`flex: none`**（EP 原生 `flex:auto` 会让容器撑满整行，`width: fit-content` 单独加挡不住 flex-grow），再配 `width: fit-content` 收缩贴合内容；
  4. 相邻 `.el-tabs__item` 间补 `margin-left: 2px` 间距（对应容器 `gap`）。
- **可达性**：Tab label 保留 `role="tab"` + `:aria-selected`；选中态不只靠颜色（白底浮层 + 字重 + 文字色三通道）。
- 禁止在页面级 Tab 之下再套第三层下划线 Tab；需要更深层切换时继续降级（胶囊 → 文字链/下拉）。
- 参考视觉稿：`.dev/demos/monitor-nav-demo.html`（方案 A）。

---

## 5. 图标规范

| 场景 | 尺寸 | 圆角 | 来源 |
|------|------|------|------|
| 侧边菜单图标（内置） | 18px | — | `@element-plus/icons-vue` 或线性 SVG（`stroke` 2px、round） |
| 插件图标（表格行首/卡片头） | 24px | 7px | 插件 `icons/`（SVG，`pluginIconUrl`），置于 `--atlas-accent-soft` 底块 |
| 插件卡片头图标 | 24px | — | 同上 |
| 插件图标（菜单行首） | 16px | 4px | 同上 |
| 核心功能图标 | Element Plus 图标 | — | `@element-plus/icons-vue` |

- **侧边菜单**：用 18px 线性图标（`stroke` 2px、`stroke-linecap:round`），颜色随菜单态（默认灰、选中品牌蓝）。
- **插件图标 SVG 规范**：100×100 viewBox、白底圆角、单色系低多边形风格；`data:` 内嵌或 `icons/xxx.svg`，禁止外链位图。
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

### 7.1 面包屑（页头）

- 页头统一面包屑 `首页 › 当前页`；可回退项用链接（hover 品牌蓝），当前页 `.cur` 深色加粗。
- 页头无独立大标题；操作按钮（如「创建应用」）置右、`flex-shrink:0`。

### 7.2 侧栏折叠（Sidebar Collapse）

- **图标模式**：收起后侧栏 64px，菜单仅图标居中，悬停图标浮出气泡 tooltip；再点展开。
- **触发器**：侧栏顶部右上角 32×32 图标按钮 + 收起态点击品牌 Logo（`atlas.svg`）均可展开；按钮用箭头旋转表达状态。
- **Logo 切换**：展开 `atlas-banner.svg`、收起 `atlas.svg`。
- **持久化**：收起态存 `localStorage`（如 `atlas-sidebar-collapsed`），刷新保持。
- 退出登录始终 `position:sticky` 固定可视底部。

### 7.3 移动端适配（≤768px）

> 桌面优先设计，移动端为降级目标。参考实现：`App.vue`（全局骨架）、`MonitorPanel.vue`（面板内表格）、`AppSpaceView.vue`（看板堆叠）。

**全局骨架（App.vue 已实现，勿重复造）**：

- **断点**：`≤768px` 为移动端（`window.matchMedia('(max-width: 768px')` 响应式判定）。
- **侧栏 → 覆盖式抽屉**：侧栏 `position:fixed + translateX(-100%)` 隐藏，汉堡按钮（面包屑左侧 34×34）开合，遮罩（`rgba(20,28,60,.4)`，z-index 1990/2000）点击关闭；**点菜单项必须自动关闭抽屉**（`switchMenuMobile`）。
- **折叠语义在移动端失效**：抽屉没有「图标模式」——Logo 一律横幅版（与 localStorage 折叠态解耦），点 Logo 仅关闭抽屉；折叠箭头按钮不渲染。菜单图标固定 24px 图标+文字形态。
- **内容区 padding** 36px → 16px。
- **EP 弹层全局规则**（style.css 兜底，勿在各处手写）：`.el-dialog/.el-message-box` → `calc(100vw - 32px)` 限宽居中；`.el-drawer` → **100vw 完全覆盖视口**（移动端抽屉不留边缘缝隙，靠 X/遮罩关闭）。

**页面/面板自行降级（写自己的视图时必须做）**：

- **多列网格 → 单列**：`grid-template-columns: repeat(n, 1fr)` 或 `Npx 1fr Mpx` 类布局，≤768px 必须 `1fr`（概览卡、双列表格区、统计行）。
- **表格是最常见的溢出源**：`el-table` 固定列宽合计（每列 70–120px × 列数）很容易超过 375px 容器。两种解法：① 行式列表替代表格（接口行三行布局，见 MonitorPanel）；② 表格留在卡内横滚——**外层卡片必须 `min-width:0; overflow:hidden`**，否则子项最小宽度会撑破 grid 轨道（真实案例：machine-monitor 表格 460px 撑破单列 grid 到 494px）。
- **`1fr` 轨道含宽内容必须 `minmax(0, 1fr)`（桌面同样适用）**：`1fr` 默认 `min-width:auto`，轨道最小宽度跟随内容而非容器——卡内表格/代码块/长 URL 会把轨道撑破容器。写法：`repeat(2, minmax(0, 1fr))`；「固定侧列 + 自适应主列」的概览布局优先 `repeat(auto-fit, minmax(Npx, 1fr))` 自适应列数，不要写死 `Npx 1fr Mpx`（真实案例：OpsView 260px/300px 固定列在中窄屏把中间列挤成一字一行；machine-monitor 双列表格各 460px 撑出容器裁掉右卡）。
- **工具栏换行**：搜索框 `order:-1; width:100%` 占满首行，spacer 隐藏，按钮组换行。
- **Tab 栏横滚**：页面级 Tab 允许横向滑动（隐藏滚动条），隐藏 EP 滚动箭头；分段控件（§4.10）同理。
- **信息行拆行**：横向多元素的信息行（Tag+名称+类型+状态+操作）窄屏改为 `flex-wrap: wrap` + `order` 确定性分行，摘要文字允许 `white-space:normal` 自然换行，不得靠 `flex-shrink` 硬压（会叠字）。
- **深链就绪校准**：`core:`/`plugin:` 前缀的 Tab 深链在 slot 清单异步加载完成前会误判非法——必须在 slot 就绪后按 hash 补一次校准（AppSpaceView 的 `watch` 模式）；系统插件深链 key 是前缀关系（`plugin:{type}` vs `plugin:{type}:{title}`），匹配用 `startsWith` 而非全等。
- **媒体查询块放样式表末尾**：同优先级规则后者覆盖前者，移动端覆盖块必须在原始规则**之后**（真实案例：插在中部被同文件后面的 `.ep-main` 覆盖失效）。

**验证要求**：涉及布局的改动，需在 `≤375px` 视口下自测以下断言（浏览器 DevTools 或自动化）；涉及交互/可访问性的改动，走对应条目的自测项。全部通过才算完成：

#### 布局（≤375px 视口）

1. `document.documentElement.scrollWidth <= window.innerWidth`（无横向溢出）；
2. 双列/三列容器 `getComputedStyle().gridTemplateColumns` 只有一个轨道值；
3. 深链硬刷新后落在目标 Tab/面板，而非默认页；
4. 抽屉/对话框完整可见：dialog 宽度 ≤ 视口−32px；**移动端抽屉 100vw 完全覆盖、无边缘缝隙**；
5. 汉堡开抽屉 → 点菜单项 → 抽屉自动关闭且路由切换；遮罩点击关闭；
6. 信息行（Tag+名称+状态+操作混排）无文字叠压：逐行读 `getBoundingClientRect` 检查元素间无重叠；
7. 卡内表格不撑破容器：卡片 `getBoundingClientRect().width` 与其父容器一致（此前 el-table 460px 撑破 grid 的回归项）；
8. 面板内分段控件（§4.10）胶囊容器收缩贴合内容（`flex:none` 生效），未被拉满整行；
9. **桌面三档回归**：`1900 / 1280 / 1024px` 下概览/双列区域均无溢出、无单字竖排标题（`1fr` 轨道未被内容撑破——OpsView/机器监控回归项）；
10. 「固定侧列 + 1fr」概览布局在窗口变窄时列数自动减少（auto-fit 生效），而非中间列被挤压。

#### 交互与生命周期（桌面 + 移动各测一遍）

1. 定时器/事件监听卸载即清理（`onBeforeUnmount`）；轮询类开关关闭后不再发请求；
2. 列表/详情同步：列表刷新后已打开的详情/抽屉引用同步或关闭，不残留已删数据；
3. 上传类组件（el-upload）不使用内部 file-list 渲染（`show-file-list=false` + 自渲染已选列表），一次选择不产生重复/空名条目；
4. 删除/吊销/轮换/恢复版本等破坏性操作均有 `ElMessageBox.confirm` 二次确认，取消路径无副作用。
5. 创建/编辑实体入口打开的是右侧抽屉（el-drawer，非 el-dialog），带 `role="dialog"` + aria-label，**右上角有 X 关闭按钮**（未设 with-header=false），表单完整可见、footer 保存/取消可用（§4.5）；
5a. 抽屉/对话框内表单为 `label-position="top"` 顶部标签，无 `label-width` 左标签残留；表单内下拉无固定 px 宽度（§4.5）；
6. 抽屉内表单在 375px 视口不溢出（全局限宽生效），label 与控件排版正常。

#### 可访问性

1. 纯图标按钮均有 `el-tooltip`（或 aria-label）；开关类控件有 aria-label 或伴随状态文字（双通道）；
2. 图表/进度环等纯视觉元素带 `role="img"` + aria-label 文本替代，最新值有文字行；
3. 空表 `empty-text` 为具体语义（「暂无采样记录」而非「暂无」）；
4. 加载态：列表 v-loading、对话框异步取数有 loading、失败有空态/错误条。

#### 品牌与 token

1. 图标库统一（主应用导航 Lucide 线性系，stroke-width 全局一致）；菜单图标颜色 `currentColor` 随文字态，无单独透明度折扣；
2. 样式无硬编码颜色/字号/圆角（§2 token 档位）；业务默认值色（如供应商标识色）除外；
3. 抽屉/对话框有 `role="dialog"` + aria-label（`with-header=false` 的必须补）。

---

## 8. 可访问性（A11y）

- 可交互元素：原生语义（`<button>`/`<a>` 或加 `tabindex="0"` + 键盘事件）+ `:focus-visible` 焦点环（`outline: 2px solid var(--atlas-accent)`）。
- 状态不只靠颜色：Tag + 文字、错误 + 图标双通道。
- 图标按钮必须有 `el-tooltip` 文本说明。
- 对比度：正文 `--atlas-text`(#161a2b) on `--atlas-surface`(#fff) ≈ 14.5:1；`--atlas-muted`(#5f6a85) on white ≈ 6.5:1，均满足 WCAG AA。

---

## 9. UI 主题插件（Theme as Plugin）— 设计稿

> 目标：UI 主题按**插件**注册，可安装多套、运行时切换并持久化，与现有 slot 插件机制一致。

### 9.1 形态（选型：复用 slot / PluginMount 机制）

- 主题插件声明一个保留的插件类型（如 `type: 'theme'`），并为**主壳布局**（`App.vue` 的侧栏/页头/内容 chrome）提供可替换 UI。
- 类比现有 slot（`app-space`/`console`/`system-menu`）：新增一个 `shell` slot，主题插件在此挂载「整壳布局」入口，替换或增强默认 chrome，而非仅单一面板。

### 9.2 主题清单（manifest 扩展）

```jsonc
// plugins/<theme-dir>/manifest.json
{
  "pluginType": "theme-default",   // 保留字前缀 theme-
  "name": "白色现代",
  "icon": "icons/theme.svg",
  "default": true,                 // 平台默认主题，至少存在一个
  "theme": {
    "entry": "ui/shell.ts",        // 主壳布局加载入口（PluginMount 同类契约）
    "tokens": { "--atlas-bg": "#ffffff", "...": "..." }  // 覆盖 token 的 CSS 变量
  }
}
```

### 9.3 运行时加载与切换

- 启动：加载 `default:true` 主题作为兜底，应用其 token 与 shell。
- 切换：持久化当前主题名到 `localStorage`，重建 shell/重载 token；加载失败回落默认主题。
- 插件热加载/卸载：主题卸载时自动回落默认主题。
- 主题 token 以 `--atlas-*` CSS 变量注入 `:root`（或 `[data-theme]` 作用域），组件零改动即重皮肤。

### 9.4 约束（红线）

- 主题**不得**改变业务数据结构与路由，只换视觉层（token + chrome）。
- 必须提供 `default:true` 主题兜底，保证卸载/加载失败不白屏。
- 字体/圆角/间距的**档位**沿用 §2.2–2.4，主题在此档位内改 token 值。
- 插件面板复用 `--atlas-*` token，随主题自动换肤，不自造配色。

> 完整接口与加载流待实现（§9 为设计稿，落地前需评审）。

---

## 10. 反模式（Code Review 拦截项）

| ❌ 反模式 | ✅ 正确做法 |
|-----------|-------------|
| 组件内硬编码颜色（`#e4573d` 等） | 用 `--atlas-*` token（先补 token 再用） |
| 新增 14/16/18px 等中间字号 | 用规范档位（13/15/32px 等，见 §2.2） |
| 卡片 hover 用缩放（scale） | 位移 `translateY(-1px)` + 阴影加深 |
| 图标按钮无 tooltip | 配 `el-tooltip` |
| 状态只靠颜色（无文字/图标） | Tag + 文字双通道 |
| 插件面板自造配色/CSS 框架 | 复用 `--atlas-*` token + Element Plus |
| 删除/轮换无二次确认 | `ElMessageBox.confirm` |
| 手写图标 URL 拼接 | `pluginIconUrl` / `iconOf` |
| 整页大标题 + 副标题堆叠（已有面包屑） | 用面包屑承载层级（见 §7.1） |
| 主题插件未提供 `default:true` 兜底 | 必须有一默认主题兜底（见 §9） |
| 纯黑阴影 `rgba(0,0,0,…)` | 中性灰阴影 `rgba(20,28,60,…)`（主按钮才用品牌蓝阴影） |
| 双层导航用同一形态（页面内又套下划线 Tab） | 下划线=页面级、胶囊分段控件=视图级（见 §4.10） |
| 创建/编辑实体的表单用居中 el-dialog | 表单类操作一律右侧 el-drawer（§4.5），dialog 仅留给轻量确认/展示 |
| 抽屉 `with-header="false"` 移除 X 关闭按钮 | 所有抽屉保留原生 header 与 X（§4.5）；自定义标题放 body 首块 |
| 表单用 `label-width` 左标签（抽屉内挤压控件） | 全站 `label-position="top"` 顶部标签，控件通栏（§4.5） |
| 表单内下拉写死 `style="width: NNNpx"` | 控件通栏跟随容器；并排需求用自适应双列 grid |
| ≤768px 出现横向溢出（`scrollWidth > innerWidth`） | 多列网格降单列；表格卡内 `min-width:0 + overflow` 收敛（见 §7.3） |
| 弹层固定 px 宽度在手机上溢出 | 全局限宽已兜底（style.css），新增弹层不得再写死 `size="560px"` 类宽度不检查 |
| 移动端媒体查询块插在样式表中部 | 覆盖块放样式表**末尾**，否则被后面同优先级规则覆盖（见 §7.3） |
| 信息行窄屏靠 `flex-shrink` 硬压（文字叠压） | `flex-wrap + order` 确定性分行，摘要允许自然换行（见 §7.3） |
| Tab 深链用 key 全等匹配 `plugin:{type}` | slot key 带标题后缀，用 `startsWith` 前缀匹配 + slot 就绪后校准（见 §7.3） |
