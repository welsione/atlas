# Atlas 插件模板

复制本目录即可开发新插件：`cp -R plugins/template plugins/my-plugin`。

## 目录结构

```
plugins/my-plugin/
├── manifest.json   # 插件声明（pluginType/name/description/version/defaultDataScope/icon/entry）
├── icons/          # 插件图标目录（可选；manifest.icon 相对路径指向这里）
├── src/
│   └── index.ts    # AibasePlugin 实现（Node 22 原生运行 TS，无需编译）
├── ui/             # 前端面板构建产物（可选，npm run ui:build 自动生成）
└── ui-src/         # 前端面板源码（可选；从 plugins/providers/ui-src 复制改造）
```

## 快速开始

1. **声明**：改 `manifest.json` —— `pluginType` 全局唯一，`entry` 固定 `src/index.ts`
2. **图标**（可选）：`icons/` 目录放 SVG/PNG，`manifest.json` 的 `icon` 写 `icons/xxx.svg`（或 data URI / http URL）；应用空间 Tab、插件实例表格、插件注册表、控制台卡片统一展示
3. **实现**：改 `src/index.ts` —— `AibasePlugin.type` 必须与 `manifest.pluginType` 一致（不一致加载跳过）
4. **验证**：保存后约 10s 自动热加载（日志可见注册信息），端点即生效

## 核心契约速查

| 能力 | 用法 |
|------|------|
| 通用存储 | `env.store().get/put/remove/list(key, entityId?)` |
| 文件存储 | `env.files().write/read/remove/list`；公开托管 `publish(relPath, name)` → `/api/files/{token}/download` |
| 敏感加密 | `env.crypto().encrypt/decrypt`（API Key 等必须加密落库） |
| 数据集发布 | `env.datasets().publish(key, name, sensitivity, json)` / `upsertSecret`；声明 `datasetSource().render(env)` 供调度刷新 |
| 操作审计 | `env.ops().info/warn/error/log(level, msg, detail?)` |
| 配置 | `env.config()` / `await env.updateConfig(cfg)` |
| 端点 | `endpoints()` 声明 `{method, path, summary, handle}`，地址 `/api/apps/{appId}/plugins/{type}/ep/{path}`，返回即 data，抛错即失败响应 |
| 初始化 | `init(env)` 实例启用时执行（种子数据）；`destroy()` 清理 |

## 数据作用域

- `APP_LOCAL`：每应用一份（默认）
- `GLOBAL_SHARED`：全局共享一份（如供应商配置）

## 前端面板（可选）

- 复制 `plugins/providers/ui-src` 改造：`src/main.js` 导出 `{ mount(el, ctx) }`（ctx 含 `appId/pluginType/refresh`），`App.vue` 接收 `props.appId`
- 运行时依赖（vue / element-plus / @element-plus/icons-vue / @atlas/runtime）由平台提供，**不要打包**
- 接口调用：`import { get, post, put, del } from '@atlas/runtime'`
- 构建：`cd ui-src && npm install && npm run ui:build` → 产物进 `ui/`（entry 内容哈希）

## 提交规范

- 后端 `src/` 与前端 `ui-src/` 源码 + `ui/` 构建产物一并提交（仓库内插件目录即分发源）
- 参考官方插件：`plugins/{providers,prompts,model-files}`；完整规范见 `docs/plugin-development.md`
