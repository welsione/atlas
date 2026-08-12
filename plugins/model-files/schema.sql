-- model-files 插件自有表（框架级 schema.sql 约束，平台加载后自动建表）。
-- 历史遗留关系表：当前数据走 plugin_store + files()，保留表以兼容旧库。
CREATE TABLE IF NOT EXISTS model_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'default',
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'FILE',
  storage_root TEXT NOT NULL,
  token TEXT NOT NULL DEFAULT '',
  files_json TEXT NOT NULL DEFAULT '[]',
  total_size INTEGER NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL DEFAULT '',
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_files_scope ON model_files(app_id, category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_files_token ON model_files(token);
CREATE TABLE IF NOT EXISTS download_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  bytes INTEGER NOT NULL DEFAULT 0,
  downloaded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_download_logs_file ON download_logs(file_id, downloaded_at);
CREATE INDEX IF NOT EXISTS idx_download_logs_ip ON download_logs(ip, downloaded_at);
CREATE TABLE IF NOT EXISTS upload_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_upload_logs_file ON upload_logs(file_id, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_upload_logs_ip ON upload_logs(ip, uploaded_at);
