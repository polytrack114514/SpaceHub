-- ============================================
-- SpaceHub 注册安全加固 SQL（对齐线上真实结构）
-- 作用：
--   1. register_user 只允许 service_role 调用，anon 直连调不动
--   2. 密码改为 SHA-256 存储，存量明文密码一并迁移
--   3. verify_user_login 同步改为哈希比对（仍允许 anon 调用，供首页登录）
--
-- 线上 users 表结构：
--   id serial / name text unique / password text / avatar text
--   created_at timestamptz / follows text / last_active timestamp / banned boolean
-- pgcrypto 位于 extensions schema，故 search_path 必须带上 extensions
-- ============================================

-- ── 第一步：锁定 register_user，禁止 anon / authenticated 直接执行 ──────────
REVOKE ALL ON FUNCTION public.register_user(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_user(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.register_user(text, text, text) FROM authenticated;

-- ── 第二步：重写 register_user（签名不变，供 Worker 用 service_role 调用） ──
CREATE OR REPLACE FUNCTION public.register_user(
    p_name TEXT,
    p_password TEXT,
    p_avatar TEXT DEFAULT '🚀'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_name   TEXT;
    v_hash   TEXT;
    v_result JSON;
BEGIN
    v_name := trim(p_name);

    IF v_name IS NULL OR v_name = '' THEN
        RETURN json_build_object('error', '用户名不能为空');
    END IF;
    IF length(v_name) < 2 OR length(v_name) > 20 THEN
        RETURN json_build_object('error', '用户名需 2-20 个字符');
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RETURN json_build_object('error', '密码至少 6 位');
    END IF;
    IF EXISTS (SELECT 1 FROM users WHERE name = v_name) THEN
        RETURN json_build_object('error', '用户名已被注册，请换一个');
    END IF;

    v_hash := encode(digest(p_password, 'sha256'), 'hex');

    INSERT INTO users (name, password, avatar)
    VALUES (v_name, v_hash, COALESCE(NULLIF(p_avatar, ''), '🚀'))
    RETURNING json_build_object('name', name, 'avatar', avatar) INTO v_result;

    RETURN v_result;
EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object('error', '用户名已被注册，请换一个');
    WHEN OTHERS THEN
        RETURN json_build_object('error', SQLERRM);
END;
$$;

-- CREATE OR REPLACE 会保留原 ACL，这里再显式收口一次
REVOKE ALL ON FUNCTION public.register_user(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_user(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.register_user(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO service_role;

-- ── 第三步：存量明文密码迁移为 SHA-256（64 位 hex 视为已迁移） ──────────────
UPDATE users
SET password = encode(digest(password, 'sha256'), 'hex')
WHERE password !~ '^[0-9a-f]{64}$';

-- ── 第四步：verify_user_login 改为哈希比对 ─────────────────────────────────
-- 首页用 anon key 直接调用，所以仍要授权给 anon（函数只返回 name/avatar/banned）
CREATE OR REPLACE FUNCTION public.verify_user_login(
    p_name TEXT,
    p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'name', u.name,
        'avatar', u.avatar,
        'banned', COALESCE(u.banned, false)
    )
    INTO result
    FROM users u
    WHERE u.name = trim(p_name)
      AND u.password = encode(digest(p_password, 'sha256'), 'hex');
    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_user_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_user_login(text, text) TO anon, authenticated, service_role;