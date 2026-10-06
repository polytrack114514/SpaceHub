-- SpaceHub 数据库迁移 002：补齐列与 RLS 策略
-- 执行方式：在 Supabase SQL Editor 中运行

-- 1. user_profiles：确保存在 banned / role 列
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role   TEXT DEFAULT 'user';

-- 2. launches：确保存在 result 列（记录发射结果 success/failure/partial/pending）
ALTER TABLE launches ADD COLUMN IF NOT EXISTS result TEXT DEFAULT 'pending';

-- 3. site_settings：站点配置表（key/value）
CREATE TABLE IF NOT EXISTS site_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS：所有写入仅 service_role（Edge Function 代理），公开读取
--    posts 已在 001 中处理

-- launches
ALTER TABLE launches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "launches_service_write" ON launches;
CREATE POLICY "launches_service_write" ON launches
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "launches_public_read" ON launches;
CREATE POLICY "launches_public_read" ON launches
    FOR SELECT TO anon, authenticated USING (true);

-- user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_profiles_service_write" ON user_profiles;
CREATE POLICY "user_profiles_service_write" ON user_profiles
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "user_profiles_public_read" ON user_profiles;
CREATE POLICY "user_profiles_public_read" ON user_profiles
    FOR SELECT TO anon, authenticated USING (true);

-- site_settings
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_settings_service_write" ON site_settings;
CREATE POLICY "site_settings_service_write" ON site_settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "site_settings_public_read" ON site_settings;
CREATE POLICY "site_settings_public_read" ON site_settings
    FOR SELECT TO anon, authenticated USING (true);

-- sessions（token 校验由 Edge Function 使用 service_role，无需公开策略）
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_service_all" ON sessions;
CREATE POLICY "sessions_service_all" ON sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);