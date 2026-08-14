<p align="center">
  <img src="packages/web/public/icons/atlas-banner.svg" width="360" height="112" alt="Atlas" />
</p>

<h3 align="center">全 TypeScript 插件化 AI 服务基础平台</h3>

<p align="center">
  <a href="https://github.com/welsione/atlas/actions/workflows/ci.yml"><img src="https://github.com/welsione/atlas/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/Node-%3E%3D22-brightgreen.svg" alt="Node >= 22" />
  <a href="https://github.com/welsione/atlas/releases"><img src="https://img.shields.io/github/v/release/welsione/atlas?sort=semver&label=version&color=blue" alt="Version" /></a>
</p>

<p align="center">
  <strong>以应用为核心的多租户 AI 基础平台</strong> —— 把 AI 服务的「数据分发、插件扩展、接口监控、运维治理」一体化，让你专注于业务能力本身。
</p>

---

## 亮点

- 🧩 **插件即能力**：前后端一体的目录插件，拖进 `plugins/` 即生效——声明式端点、自动热加载/热卸载、双向 SPI 编排（拓扑排序 + 环检测 + semver 约束），复制 `template/` 十分钟起步。
- 🔐 **安全的数据分发**：数据集三级密级（PUBLIC / INTERNAL / SECRET）+ 信封加密（AES-256-GCM + 逐次访问审计 + 白名单授权），内容哈希驱动版本，消费方变化才下载（ETag → 304 免流量）。
- 📦 **开箱即用的多租户**：创建应用自动实例化插件，`app_id + app_secret` 换短时效令牌即时吊销；应用空间统一管理数据集、凭证、审计。
- 🖥️ **可视级运维**：控制台 + 接口监控（端点启停规则、访问统计）+ 跨应用运维台工作日志，部署即获全貌。

## 内置插件

| 插件 | 能力 |
|---|---|
| `providers` | 供应商配置：OpenAI/Anthropic 兼容接口、API Key 加密、模型快速选择、图标 |
| `prompts` | 提示词模板管理 + 版本历史 + 变量渲染 |
| `model-files` | 模型文件目录/zip 上传、流式下载、公开托管 |
| `machine-monitor` | 部署机器性能监控（CPU/内存/磁盘/负载/进程，系统级全局共享） |

## 快速上手

```bash
git clone https://github.com/welsione/atlas.git && cd atlas
npm install
npm run build:web
npm run sync:static
npm run dev        # http://127.0.0.1:18081
```

> 首次体验建议先创建一个个应用，进入其「应用空间」，依葫芦画瓢试试 `providers` 插件与一个数据集。

---

## 文档

- 📖 **[Atlas 使用手册](docs/guide.md)** —— 安装、Docker 部署、配置、核心概念、API 与 curl 示例
- 🧩 **[插件开发规范](docs/plugin-development.md)** —— 插件 SPI 契约、env API、UI slot、安全规范、FAQ
- 🔌 **[核心功能 SPI 开发](docs/spi-development.md)** —— 事件 / 门面 / 建表等内核对插件开放的能力
- 🛠️ **[仓库运维指南](docs/repository-ops.md)** —— 分支模型、发布、AI 审查、依赖/门禁机制
- 🤝 **[参与贡献](CONTRIBUTING.md)** · [行为准则](CODE_OF_CONDUCT.md) · [安全策略](SECURITY.md) · [变更日志](CHANGELOG.md)

## 许可证

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) —— [MIT License](LICENSE)
