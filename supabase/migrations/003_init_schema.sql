-- SpaceHub 初始化/修复迁移（幂等，最小改动）
-- 现状：user_profiles 是 users 上的视图；sessions 表缺失；users 缺 role 列
-- 目标：补齐 role 列、刷新 user_profiles 视图、创建 sessions、创建 RPC 函数

-- 1. users 表补 role 列
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 2. 刷新 user_profiles 视图（新增 role；保持不暴露 password）
DROP VIEW IF EXISTS user_profiles;
CREATE VIEW user_profiles AS
SELECT id, name, avatar, role, created_at, follows, last_active, banned
FROM users;

-- 3. 创建 sessions 表
CREATE TABLE IF NOT EXISTS sessions (
    id          SERIAL PRIMARY KEY,
    user_name   TEXT NOT NULL,
    token       TEXT UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_name);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sessions_service_all ON sessions;
CREATE POLICY sessions_service_all ON sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. site_settings 补 updated_at 列
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. verify_user_login RPC（校验 users 表）
-- 注意：users.password 存储的是明文密码的 SHA-256 十六进制摘要，
--       前端提交的是明文，故此处对输入做 sha256 后再比对。
CREATE OR REPLACE FUNCTION public.verify_user_login(p_name TEXT, p_password TEXT)
RETURNS JSON AS $fn$
DECLARE
    r JSON;
BEGIN
    SELECT json_build_object(
        'name',   name,
        'avatar', COALESCE(avatar, ''),
        'banned', COALESCE(banned, FALSE),
        'role',   COALESCE(role, 'user')
    ) INTO r
    FROM users
    WHERE name = p_name
      AND password = encode(sha256(p_password::bytea), 'hex')
    LIMIT 1;
    RETURN r;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. update_last_active RPC（更新 users 表）
CREATE OR REPLACE FUNCTION public.update_last_active(p_name TEXT)
RETURNS void AS $fn$
BEGIN
    UPDATE users SET last_active = NOW() WHERE name = p_name;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 校验
SELECT 'ok' AS status,
       (SELECT COUNT(*) FROM users) AS users_count,
       (SELECT COUNT(*) FROM user_profiles) AS view_count,
       (SELECT COUNT(*) FROM sessions) AS sessions_count,
       (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins;