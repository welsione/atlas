-- =====================================================================
-- Atlas 平台 Schema（SQLite，幂等执行）
-- 范式：以应用为核心的多租户插件化平台
-- =====================================================================

-- ---------- 应用空间（一级实体） ----------
CREATE TABLE IF NOT EXISTS apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL UNIQUE,              -- 对外凭证标识（app_xxx）
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    app_secret_hash TEXT NOT NULL DEFAULT '', -- 当前有效凭证的 SHA-256
    status TEXT NOT NULL DEFAULT 'ACTIVE',    -- ACTIVE / PAUSED / REVOKED
    token_ttl_seconds INTEGER NOT NULL DEFAULT 86400,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 应用凭证历史（轮换保留，支持吊销后回滚校验）
CREATE TABLE IF NOT EXISTS app_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    secret_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ---------- 插件注册表（平台级） ----------
CREATE TABLE IF NOT EXISTS plugins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plugin_type TEXT NOT NULL UNIQUE,         -- 插件专用 key（全局唯一）
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    default_data_scope TEXT NOT NULL DEFAULT 'APP_LOCAL',  -- APP_LOCAL / GLOBAL_SHARED
    scope_override_allowed INTEGER NOT NULL DEFAULT 1,     -- 单向：仅允许 SHARED->LOCAL
    artifact TEXT NOT NULL DEFAULT '',        -- 插件目录名（全部插件统一目录加载）
    artifact_hash TEXT NOT NULL DEFAULT '',   -- 目录内容哈希（识别同一插件不同拷贝/更新）
    version TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '',             -- 插件图标：data:/http(s)/icons/xxx.svg（相对路径经 /_pluginui/{type}/icons/ 服务）
    loaded INTEGER NOT NULL DEFAULT 1,        -- 软卸载：loaded=0 数据全保留
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ---------- 插件实例（挂靠应用空间） ----------
CREATE TABLE IF NOT EXISTS plugin_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    plugin_type TEXT NOT NULL,
    data_scope TEXT NOT NULL,                 -- 实际生效 scope（继承或单向覆盖）
    config_json TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,       -- enable/disable 独立于插件注册
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(app_id, plugin_type)
);

-- ---------- 数据集（插件自持内容，平台提供版本化发布能力） ----------
CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    plugin_type TEXT NOT NULL DEFAULT '',
    dataset_key TEXT NOT NULL DEFAULT '',     -- 插件内唯一标识
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sensitivity TEXT NOT NULL DEFAULT 'PUBLIC',  -- PUBLIC / INTERNAL / SECRET
    token TEXT NOT NULL UNIQUE,               -- 固定分发凭证（32 字节随机，防穷举）
    version INTEGER NOT NULL DEFAULT 1,       -- 内容哈希驱动：hash 变则 +1
    content_hash TEXT NOT NULL DEFAULT '',
    content_json TEXT NOT NULL DEFAULT '',    -- 结构化内容（SECRET 级不含明文）
    assets_json TEXT NOT NULL DEFAULT '[]',
    dek_wrapped TEXT NOT NULL DEFAULT '',     -- 信封加密：KEK 加密的 DEK（SECRET 级）
    refresh_mode TEXT NOT NULL DEFAULT 'MANUAL',  -- MANUAL / SCHEDULED
    refresh_interval_seconds INTEGER,
    last_refreshed_at TEXT,
    status TEXT NOT NULL DEFAULT 'PUBLISHED',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(app_id, plugin_type, dataset_key)
);

-- ---------- 敏感凭证（SECRET 数据集内容，DEK 加密） ----------
CREATE TABLE IF NOT EXISTS secrets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    key_name TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    secret_version INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ---------- 授权：应用 x 数据集（INTERNAL/SECRET 强制） ----------
CREATE TABLE IF NOT EXISTS dataset_app_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    app_id INTEGER NOT NULL,
    granted_at TEXT NOT NULL,
    revoked_at TEXT,
    UNIQUE(dataset_id, app_id)
);

-- ---------- 通用插件存储（简单插件零建表） ----------
CREATE TABLE IF NOT EXISTS plugin_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,          -- 0=全局共享 / appId=应用独立
    plugin_type TEXT NOT NULL DEFAULT '',  -- 隔离不同插件，防跨插件同 key 碰撞
    entity_id TEXT NOT NULL DEFAULT '',
    entity_key TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(instance_id, plugin_type, entity_id, entity_key)
);

-- ---------- 审计 ----------
CREATE TABLE IF NOT EXISTS dataset_download_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    app_id INTEGER NOT NULL DEFAULT 0,        -- 0 = 公开 token
    token TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    bytes INTEGER NOT NULL DEFAULT 0,
    downloaded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dataset_download_logs_ds ON dataset_download_logs(dataset_id, downloaded_at);
CREATE INDEX IF NOT EXISTS idx_dataset_download_logs_ip ON dataset_download_logs(ip, downloaded_at);

CREATE TABLE IF NOT EXISTS secret_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    secret_id INTEGER NOT NULL,
    dataset_id INTEGER NOT NULL,
    app_id INTEGER NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    accessed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_secret_access_logs_ds ON secret_access_logs(dataset_id, accessed_at);

CREATE TABLE IF NOT EXISTS auth_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    action TEXT NOT NULL DEFAULT '',          -- AUTH / AUTH_FAIL / REVOKE / ROTATE / UNLOAD / RELOAD
    ip TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_logs_app ON auth_logs(app_id, created_at);

-- ---------- 接口访问日志（对外发布接口监控：meta/data/secrets/assets/download + 插件 ep 端点全量记录） ----------
CREATE TABLE IF NOT EXISTS api_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_app_id INTEGER NOT NULL,            -- 发布方（资源属主）
    consumer_app_id INTEGER NOT NULL DEFAULT 0, -- 消费方（0=匿名 token）
    resource_type TEXT NOT NULL DEFAULT 'DATASET', -- DATASET / MODEL_FILE / PLUGIN_EP
    resource_id INTEGER NOT NULL DEFAULT 0,
    plugin_type TEXT NOT NULL DEFAULT '',     -- PLUGIN_EP 行记录来源插件
    token TEXT NOT NULL DEFAULT '',
    endpoint TEXT NOT NULL DEFAULT '',        -- meta/data/secrets/assets/download 或 {method} {path}（PLUGIN_EP）
    http_status INTEGER NOT NULL DEFAULT 0,   -- 200/304/400/429...
    bytes INTEGER NOT NULL DEFAULT 0,
    ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    accessed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_access_owner ON api_access_logs(owner_app_id, accessed_at);
CREATE INDEX IF NOT EXISTS idx_api_access_ip ON api_access_logs(ip, accessed_at);
-- idx_api_access_ep 依赖 plugin_type 列，由 migration v3 在加列后创建（兼容已有库）

-- ---------- 接口启停规则（接口监控管理面：按应用维度控制插件对外端点） ----------
CREATE TABLE IF NOT EXISTS endpoint_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,                  -- 应用维度；无规则行 = 默认启用
    plugin_type TEXT NOT NULL,
    method TEXT NOT NULL,
    endpoint_path TEXT NOT NULL,              -- 插件声明路径（ep/ 之后，如 status、history/{hours}）
    enabled INTEGER NOT NULL DEFAULT 0,       -- 0=停用 1=启用
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(app_id, plugin_type, method, endpoint_path)
);

-- ---------- 插件公开端点 token（对外接口统一寻址：防枚举 + 敏感度） ----------
CREATE TABLE IF NOT EXISTS plugin_ep_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    plugin_type TEXT NOT NULL,
    method TEXT NOT NULL,
    endpoint_path TEXT NOT NULL,              -- 插件声明路径（ep/ 之后）
    token TEXT NOT NULL UNIQUE,               -- 32 字节随机，防穷举
    sensitivity TEXT NOT NULL DEFAULT 'PUBLIC', -- PUBLIC / INTERNAL / SECRET
    enabled INTEGER NOT NULL DEFAULT 1,       -- 对外启用位（默认启用）
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(app_id, plugin_type, method, endpoint_path)
);

-- ---------- 对外接口统一启停（数据集 / 文件 + 插件公开 ep 共用治理位） ----------
CREATE TABLE IF NOT EXISTS external_interface_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    kind TEXT NOT NULL,                       -- DATASET / PLUGIN_EP / PUBLIC_FILE
    key TEXT NOT NULL,                        -- 数据集 id / 插件 ep "{method} {path}" / 文件 token
    enabled INTEGER NOT NULL DEFAULT 1,       -- 0=停用 1=启用；无规则行 = 默认启用
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(app_id, kind, key)
);

-- ---------- 运维台工作日志（平台级：插件通过 env.ops() 写入，运维台跨应用查看） ----------
CREATE TABLE IF NOT EXISTS ops_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL DEFAULT 0,          -- 0 = 无应用上下文（平台级）
    plugin_type TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL DEFAULT 'INFO',         -- INFO / WARN / ERROR
    message TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ops_logs_app ON ops_logs(app_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ops_logs_type ON ops_logs(plugin_type, created_at);

-- =====================================================================
-- 插件业务表（providers/prompts/prompt_versions/model_files/download_logs/upload_logs）
-- 已迁出至各插件 schemaDdl，由 SchemaBootstrapService 在 core schema 之后幂等创建。
-- =====================================================================

-- ---------- 安全：IP 规则 + 安全设置（管理端） ----------
CREATE TABLE IF NOT EXISTS ip_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'BLOCK',        -- BLOCK / AUTO_BLOCK
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS security_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);

-- ---------- 插件文件公开托管（模型文件等插件经 env.files().publish 注册） ----------
CREATE TABLE IF NOT EXISTS plugin_file_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    scope_key INTEGER NOT NULL DEFAULT 0,       -- 与 plugin_store 同语义（0=全局共享，否则 appId）
    plugin_type TEXT NOT NULL,
    rel_path TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    total_size INTEGER NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_file_tokens_token ON plugin_file_tokens(token);
