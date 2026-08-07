-- 供应商配置表：AI 服务商连接配置（API Key 加密存储，模型列表存 JSON）
CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
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

CREATE INDEX IF NOT EXISTS idx_providers_enabled ON providers(enabled);

-- 提示词表：分类 + 变量（JSON）+ 内容
CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'default',
    description TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    variables_json TEXT NOT NULL DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);

-- 提示词版本历史：编辑时保留旧版本
CREATE TABLE IF NOT EXISTS prompt_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON prompt_versions(prompt_id);

-- 插件注册表：记录已加载的外部插件（插件自描述信息）
CREATE TABLE IF NOT EXISTS plugins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    version TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    artifact TEXT NOT NULL DEFAULT '',
    provider_types TEXT NOT NULL DEFAULT '[]',
    loaded INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 文件条目：上传到平台的文件/目录（如 ASR 模型），文件落盘于 {dataDir}/model-files/{id}/
-- token：固定公开下载链接的随机凭证（防穷举），创建后不变
-- version：版本号（更新上传时自增）；content_hash：当前版本内容哈希（单文件=SHA-256，目录=清单哈希），业务侧校验"是否更新"
CREATE TABLE IF NOT EXISTS model_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE INDEX IF NOT EXISTS idx_model_files_category ON model_files(category);
-- 注意：token 唯一索引由 SchemaInitializer 迁移逻辑按"先补列再建索引"顺序执行，
-- 以保证旧库（无 token 列）也能正常升级；新建库同样覆盖。

-- 下载日志：审计每次公开下载（IP、UA、时间、字节数），用于防攻击分析与流量统计
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

-- 上传日志：审计每次上传/更新（IP、字节数），用于流量统计
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
