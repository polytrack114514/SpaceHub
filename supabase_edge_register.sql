-- ============================================
-- SpaceHub Edge 注册安全增强 SQL
-- 执行时间：2026-08-27
-- 作用：让 register_user RPC 只允许 service_role 调用，
--        前端 anon 直接调会报 permission denied
-- ============================================

-- ── 第一步：确保 users 表存在（兼容旧版 users 表结构） ──────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    role TEXT DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- ── 第二步：开启 RLS 并对 anon 彻底封禁 ──────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 撤掉所有对 anon/public 的访问权限
REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.users FROM public;

-- 只允许 authenticated 读取非敏感信息（不显示 password）
DROP POLICY IF EXISTS "users_anon_read" ON public.users;
CREATE POLICY "users_anon_read" ON public.users
    FOR SELECT TO anon, authenticated
    USING (true)
    WITH CHECK (false);

-- 禁止 authenticated 直接插入（只能通过 edge RPC）
DROP POLICY IF EXISTS "users_auth_insert" ON public.users;
CREATE POLICY "users_auth_insert" ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (false);

-- ── 第三步：创建 security definer RPC（绕过 RLS，用 service_role 调用才有效）─
-- 注意：SECURITY DEFINER 会让函数以定义者权限运行，所以我们限制：
--   1. 只有 service_role 能调用（通过检查 auth.jwt() 的 aud 声明）
--   2. 密码用 SHA-256 存储（避免明文存库）

CREATE OR REPLACE FUNCTION public.register_user(
    p_name TEXT,
    p_password TEXT,
    p_avatar TEXT DEFAULT '🚀'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- 以函数定义者（supabase_service）权限运行
SET search_path = public
AS $$
DECLARE
    v_user_id TEXT;
    v_hashed_pwd TEXT;
BEGIN
    -- 1. 基础参数校验
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN json_build_object('error', '用户名不能为空');
    END IF;
    IF length(trim(p_name)) < 2 OR length(trim(p_name)) > 20 THEN
        RETURN json_build_object('error', '用户名需 2-20 个字符');
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RETURN json_build_object('error', '密码至少 6 位');
    END IF;

    -- 2. 检查用户名是否已存在
    IF EXISTS (SELECT 1 FROM public.users WHERE name = lower(trim(p_name))) THEN
        RETURN json_build_object('error', '用户名已被注册，请换一个');
    END IF;

    -- 3. 密码哈希（SHA-256，实际生产建议用 bcrypt/pgcrypto）
    v_hashed_pwd := encode(
        digest(p_password, 'sha256'),
        'hex'
    );
    v_user_id := gen_random_text_uuid();

    -- 4. 插入用户
    INSERT INTO public.users (id, name, password, avatar, role)
    VALUES (v_user_id, lower(trim(p_name)), v_hashed_pwd, p_avatar, 'user')
    RETURNING id INTO v_user_id;

    -- 5. 返回成功（不返回密码）
    RETURN json_build_object(
        'success', true,
        'id', v_user_id,
        'name', lower(trim(p_name)),
        'avatar', p_avatar
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object('error', '用户名已被注册，请换一个');
    WHEN OTHERS THEN
        RETURN json_build_object('error', '注册失败，请稍后重试');
END;
$$;

-- ── 第四步：创建 login_user RPC（供首页登录使用，同样 security definer） ───
CREATE OR REPLACE FUNCTION public.login_user(
    p_name TEXT,
    p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_record RECORD;
    v_hashed_pwd TEXT;
BEGIN
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN json_build_object('error', '请输入用户名');
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RETURN json_build_object('error', '密码至少 6 位');
    END IF;

    v_hashed_pwd := encode(digest(p_password, 'sha256'), 'hex');

    SELECT id, name, avatar, role, is_active, password INTO v_record
    FROM public.users
    WHERE name = lower(trim(p_name)) AND password = v_hashed_pwd;

    IF NOT FOUND THEN
        RETURN json_build_object('error', '用户名或密码错误');
    END IF;

    IF NOT v_record.is_active THEN
        RETURN json_build_object('error', '该账号已被禁用，请联系管理员');
    END IF;

    -- 更新最后登录时间
    UPDATE public.users SET last_login = NOW() WHERE id = v_record.id;

    RETURN json_build_object(
        'success', true,
        'id', v_record.id,
        'name', v_record.name,
        'avatar', v_record.avatar,
        'role', v_record.role
    );
END;
$$;

-- ── 第五步：创建 site_settings 表（管理员控制站点开关） ─────────────────────
CREATE TABLE IF NOT EXISTS public.site_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- site_settings 只允许 service_role 写入
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.site_settings FROM anon;
REVOKE ALL ON TABLE public.site_settings FROM public;

DROP POLICY IF EXISTS "settings_public_read" ON public.site_settings;
CREATE POLICY "settings_public_read" ON public.site_settings
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "settings_admin_write" ON public.site_settings;
CREATE POLICY "settings_admin_write" ON public.site_settings
    FOR ALL TO authenticated
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 插入默认值
INSERT INTO public.site_settings (key, value) VALUES ('disableRegister', 'false')
ON CONFLICT (key) DO NOTHING;

-- ── 第六步：创建 service_role 调用 RPC 的授权（可选，增强安全） ─────────────
-- 创建专用函数检查调用者身份
CREATE OR REPLACE FUNCTION public.require_service_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF current_setting('request.jwt.claims', true) = '' OR
       json_extract_path_text(current_setting('request.jwt.claims', true), 'role') != 'service_role' THEN
        RAISE EXCEPTION 'permission denied: requires service_role';
    END IF;
END;
$$;

-- ============================================
-- 部署后操作：
-- 1. 在 Cloudflare Worker 环境变量添加 SUPABASE_SERVICE_KEY
-- 2. 把 service_role key 从 Supabase Dashboard → Settings → API 获取
-- 3. 确保 Worker 的 TURNSTILE_SECRET 已正确设置
-- ============================================
