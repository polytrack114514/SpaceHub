-- SpaceHub 数据库迁移：sessions 表 + RLS 策略调整
-- 执行方式：在 Supabase SQL Editor 中运行，或部署到 supabase/migrations/

-- 1. 创建 sessions 表（匿名会话）
CREATE TABLE IF NOT EXISTS sessions (
    id          SERIAL PRIMARY KEY,
    user_name   TEXT NOT NULL REFERENCES user_profiles(name),
    token       TEXT UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_name);

-- 2. posts 表：仅 service_role 可写（Edge Function 代理）
DROP POLICY IF EXISTS "posts_insert" ON posts;
DROP POLICY IF EXISTS "posts_update" ON posts;
DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_service_write" ON posts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
-- 保留公开读取
DROP POLICY IF EXISTS "posts_public_read" ON posts;
CREATE POLICY "posts_public_read" ON posts
    FOR SELECT TO anon, authenticated USING (true);

-- 3. notifications 表：仅 service_role 可写
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_service_write" ON notifications
    FOR ALL TO service_role USING (true) WITH CHECK (true);
-- 保留用户读取自己的通知
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
    FOR SELECT TO anon, authenticated
    USING (target_user = auth.uid()::text OR from_user = auth.uid()::text);
-- 注：上面 auth.uid() 对 anon 用户恒为 null，
-- 实际通知读取通过 Edge Function 按 userName 过滤，此处放宽为 anon 可读
DROP POLICY IF EXISTS "notifications_select_all" ON notifications;
CREATE POLICY "notifications_select_all" ON notifications
    FOR SELECT TO anon USING (true);

-- 4. launches 表：仅 service_role 可写
DROP POLICY IF EXISTS "launches_admin_write" ON launches;
DROP POLICY IF EXISTS "launches_insert" ON launches;
DROP POLICY IF EXISTS "launches_update" ON launches;
DROP POLICY IF EXISTS "launches_delete" ON launches;
CREATE POLICY "launches_service_write" ON launches
    FOR ALL TO service_role USING (true) WITH CHECK (true);
-- 保留公开读取
DROP POLICY IF EXISTS "launches_public_read" ON launches;
CREATE POLICY "launches_public_read" ON launches
    FOR SELECT TO anon, authenticated USING (true);

-- 5. comments / user_profiles / messages 表保持原策略不变
-- （这些表通过 posts 的 comments JSONB 字段间接读写，无需单独策略）
