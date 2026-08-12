-- providers 插件自有表（框架级 schema.sql 约束，平台加载后自动建表）。
-- 历史遗留关系表：当前数据走 plugin_store，保留表以兼容旧库。
CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
  api_key TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  icon_color TEXT NOT NULL DEFAULT '',
  models_json TEXT NOT NULL DEFAULT '[]',
  default_model TEXT NOT NULL DEFAULT '',
  max_tokens INTEGER,
  timeout_seconds INTEGER NOT NULL DEFAULT 240,
  extra_config TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_providers_scope ON providers(app_id, enabled);
