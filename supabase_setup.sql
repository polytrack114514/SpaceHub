-- ============================================
-- SpaceHub Supabase 数据库初始化（安全版本 v3）
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    author TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    image TEXT DEFAULT '',
    source_url TEXT DEFAULT '',
    time BIGINT DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments JSONB DEFAULT '[]'::jsonb,
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    avatar TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    banned BOOLEAN DEFAULT FALSE,
    follows JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS launches (
    id SERIAL PRIMARY KEY,
    rocket TEXT DEFAULT '',
    agency TEXT DEFAULT '',
    date BIGINT DEFAULT 0,
    location TEXT DEFAULT '',
    mission TEXT DEFAULT '',
    image TEXT DEFAULT '',
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'tentative',
    result TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    target_user TEXT NOT NULL,
    from_user TEXT DEFAULT '',
    type TEXT DEFAULT '',
    post_id TEXT,
    content TEXT DEFAULT '',
    is_read BOOLEAN DEFAULT FALSE,
    created_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    content TEXT DEFAULT '',
    is_read BOOLEAN DEFAULT FALSE,
    created_at BIGINT DEFAULT 0
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE launches ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_profiles FROM anon;
REVOKE ALL ON TABLE user_profiles FROM public;
GRANT SELECT ON TABLE user_profiles TO anon, authenticated;
DROP POLICY IF EXISTS "profiles_public_read" ON user_profiles;
CREATE POLICY "profiles_public_read" ON user_profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON user_profiles;
CREATE POLICY "profiles_update_own" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid()::text = name) WITH CHECK (auth.uid()::text = name);
DROP POLICY IF EXISTS "profiles_insert_via_edge" ON user_profiles;
CREATE POLICY "profiles_insert_via_edge" ON user_profiles FOR INSERT TO authenticated WITH CHECK (false);

REVOKE ALL ON TABLE posts FROM anon;
GRANT SELECT ON TABLE posts TO anon, authenticated;
DROP POLICY IF EXISTS "posts_public_read" ON posts;
CREATE POLICY "posts_public_read" ON posts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "posts_insert" ON posts;
CREATE POLICY "posts_insert" ON posts FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "posts_update" ON posts;
CREATE POLICY "posts_update" ON posts FOR UPDATE TO authenticated USING (auth.uid()::text = author) WITH CHECK (auth.uid()::text = author);
DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_delete" ON posts FOR DELETE TO authenticated USING (auth.uid()::text = author);

REVOKE ALL ON TABLE launches FROM anon;
GRANT SELECT ON TABLE launches TO anon, authenticated;
DROP POLICY IF EXISTS "launches_public_read" ON launches;
CREATE POLICY "launches_public_read" ON launches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "launches_admin_write" ON launches;
CREATE POLICY "launches_admin_write" ON launches FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin') WITH CHECK (auth.jwt() ->> 'role' = 'admin');

REVOKE ALL ON TABLE notifications FROM anon;
GRANT SELECT, INSERT ON TABLE notifications TO authenticated;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (auth.uid()::text = target_user OR auth.uid()::text = from_user);
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = from_user);

REVOKE ALL ON TABLE messages FROM anon;
GRANT SELECT, INSERT ON TABLE messages TO authenticated;
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated USING (auth.uid()::text = from_user OR auth.uid()::text = to_user);
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = from_user);

-- 旧 users 表迁移请按实际部署情况手动执行。
