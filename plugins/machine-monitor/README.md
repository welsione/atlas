# 机器监控（`machine-monitor`）

系统级性能监控插件：采集部署机器（Atlas 所在主机）的实时性能指标，在控制台以卡片展示概要，在系统侧边菜单以完整面板查看详情与历史趋势。

## 元信息

| 字段 | 值 |
|------|-----|
| type | `machine-monitor`（全局唯一，与 `manifest.json.pluginType` 一致） |
| 版本 | `1.0.0`（与 `manifest.json.version` 一致） |
| 数据作用域 | `GLOBAL_SHARED`（与 `manifest.json.defaultDataScope` 一致） |
| 作用域覆盖 | 否（`scopeOverrideAllowed: false`，整机指标全局一份） |
| 插件目录 | `plugins/machine-monitor/` |

## 插件作用

- **实时指标采集**：CPU 使用率（`os.cpus()` 双采样差值，120ms）、内存、磁盘（根分区 `fs.statfs`）、负载、运行时长、Top 进程；跨平台尽力而为（非 Linux 平台网络计数为 null，无法读取的指标返回 null 不报错）。
- **历史趋势**：通用存储 `history`，按分钟去重，默认保留 24 小时（实例配置 `historyHours` 可调，1–168）。
- **定时采样**：声明 `datasetSource()`，可在「应用空间 → 数据集」创建 `SCHEDULED` 数据集并设刷新间隔，由平台调度器定时采样，历史更连续且可对外发布机器指标。
- **典型场景**：部署机器健康度概览、资源水位告警依据、跨应用共享同一份整机数据。

## 版本信息

| 版本 | 说明 |
|------|------|
| 1.0.0 | 首个版本：CPU/内存/磁盘/负载/进程采集、历史趋势、`datasetSource` 定时采样、控制台卡片 + 系统菜单面板 |

> 版本演进维护约定：新增能力 / 破坏性变更 bump `manifest.json.version` 并在本表追加一行。

## 系统 SPI（平台能力使用情况）

- **通用能力**：
  - `env.store()` —— 历史采样（entity_key=`history`，按分钟去重，裁剪到 `historyHours`）。
  - `env.config()` —— 读取 `historyHours`（默认 24，上限 168）。
  - `env.info()` —— 实例启用审计（主机名/平台/架构/核数）。
- **能力门面**：无（本插件提供指标数据，不消费 `env.monitor()`）。
- **事件订阅**：无。
- **声明式接入**：
  - `schema.sql` —— 无（指标存 plugin_store，无需建表）。
  - `datasetSource()` —— 声明定时采样数据源，配合平台 `SCHEDULED` 数据集调度。

## 提供的 SPI（双向 SPI）

本插件未通过 `provides()` 暴露能力。

## 端点（endpoints）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `status` | 实时性能快照（`{ host, sample }`，采集并入库） |
| GET | `history/{hours}` | 历史采样（分钟粒度，默认 24h，上限 168h） |
| GET | `processes` | Top 进程（按 CPU 排序，前 100，前端分页） |

外部调用地址：`/api/apps/{appId}/plugins/machine-monitor/ep/status`

## 前端 UI（可选）

- `console`（控制台卡片）—— 主机名 + CPU/内存/磁盘仪表盘 + 负载/运行时长，每 5s 轮询。
- `system-menu`（系统侧边菜单「机器监控」）—— 主机信息、五张指标卡、近 24h 趋势（CPU/内存/磁盘）、最近采样表、Top 进程表，支持 5s 自动刷新。

> 机器监控为全局（系统级）插件，面板挂载在系统侧边菜单而非应用空间 Tab；因端点路由需要应用 ID，系统菜单场景下 UI 自动取第一个应用作为数据通道（GLOBAL_SHARED 实例全局共享同一份数据）。

## 开发与构建

```bash
# 前端面板改动后重建
cd ui-src && npm install && npm run ui:build   # → ../ui/（构建产物随仓库提交）

# 后端改动无需编译，Node 22 type-stripping 直接运行；等待约 10s 热重载
```

> 完整插件开发规范见 [`docs/plugin-development.md`](../../docs/plugin-development.md)。
