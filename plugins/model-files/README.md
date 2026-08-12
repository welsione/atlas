# model-files 插件

Atlas 官方插件。

## 目录结构
- `manifest.json`：插件声明（type/name/description/version/defaultDataScope/entry）
- `src/index.ts`：插件实现（AtlasPlugin）
- `ui/`：前端面板（构建产物）
- `ui-src/`：前端面板源码（`npm run ui:build` 输出到 ui/）

## 数据范围
- model-files：APP_LOCAL —— 每个应用独立数据

## 提交插件
1. 复制 `plugins/template/` 到 `plugins/my-plugin/`
2. 实现 `src/index.ts`（类型来自 `@atlas/types`）
3. 声明端点/数据集/UI（可选）
4. 提交 PR 到 Atlas 仓库（或独立发布后放入 `ATLAS_DATA_DIR/plugins/`）
