# machine-monitor（机器监控）

系统级性能监控插件：采集**部署机器**（Atlas 所在主机）的实时性能指标，在控制台以卡片展示概要，在应用空间以完整面板查看详情与历史趋势。

- `type`: `machine-monitor`
- 数据作用域: `GLOBAL_SHARED`（整机指标，全局一份，所有应用共享同一实例）
- 依赖: 无（仅 Node 内置模块，跨平台尽力而为）

## 指标

| 指标 | 来源 | 说明 |
|------|------|------|
| CPU 使用率 | `os.cpus()` 双采样差值（120ms） | 跨平台 |
| 内存 | `os.totalmem/freemem` + `process.memoryUsage` | 含 RSS/堆 |
| 磁盘（根分区） | `fs.statfs('/')` | Linux/macOS；Windows 返回 null |
| 负载 | `os.loadavg()` | 1/5/15 分钟 |
| 网络收发累计 | `/proc/net/dev` | 仅 Linux |
| Top 进程 | `ps -A -o pid,comm,%cpu,%mem` | 按 CPU 排序取前 15 |
| 主机信息 | `os.hostname/platform/release/arch/cpus` | 核数、CPU 型号 |

## 数据采集与历史

- **实时**：`GET status` 每次调用即采样一次并入库（控制台卡片每 5s 轮询）。
- **历史**：通用存储 `history`，按分钟去重，默认保留 24 小时
  （实例配置 `historyHours` 可调，1–168）。
- **定时采样**：本插件声明了 `datasetSource()`；在「应用空间 → 数据集」为该插件
  创建 `SCHEDULED` 数据集并设刷新间隔（如 60s），平台调度器即定时采样，
  历史更连续，且可对外发布机器指标。

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `ep/status` | 实时快照（`{ host, sample }`） |
| GET | `ep/history/{hours}` | 历史采样（分钟粒度，默认 24h，上限 168h） |
| GET | `ep/processes` | Top 进程（按 CPU 排序） |

外部调用地址：`/api/apps/{appId}/plugins/machine-monitor/ep/status`

## UI slot

- `console`：控制台卡片 —— 主机名 + CPU/内存/磁盘仪表盘 + 负载/运行时长。
- `system-menu`：系统级侧边栏菜单「机器监控」—— 主机信息、五张指标卡、
  近 24h 趋势（CPU/内存/磁盘）、最近采样表、Top 进程表，支持 5s 自动刷新。

> 机器监控为全局（系统级）插件，面板挂载在系统侧边菜单而非应用空间 Tab；
> 因端点路由需要应用 ID，系统菜单场景下 UI 自动取第一个应用作为数据通道
> （GLOBAL_SHARED 实例全局共享同一份数据）。

## 开发

```bash
# 前端面板改动后重建
cd ui-src && npm install && npm run ui:build   # → ../ui/（构建产物随仓库提交）
```

后端改动无需编译，Node 22 type-stripping 直接运行；等待约 10s 热重载。
