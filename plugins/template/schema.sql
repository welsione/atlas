-- 插件模板 schema.sql：插件自有表建表 SQL（可选）。
-- 框架在插件加载完成后自动执行，须幂等（CREATE TABLE IF NOT EXISTS）。
-- 不建表可删除本文件。
CREATE TABLE IF NOT EXISTS your_plugin_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_your_plugin_item_scope ON your_plugin_item(app_id);
