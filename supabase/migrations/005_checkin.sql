-- ============================================================
-- SpaceHub 数据库迁移 005：每日签到 + 探索点数 + 装饰物商店
-- 执行方式：Supabase Dashboard > SQL Editor 中运行（幂等，可重复执行）
-- 设计：所有签到逻辑写在 SECURITY DEFINER 的 RPC 函数里，
--       通过 sessions 表校验身份，前端用 sb.rpc() 调用，无需 Edge Function。
-- ============================================================

-- ---------- 1. 装饰物目录（公开可读） ----------
CREATE TABLE IF NOT EXISTS reward_items (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('avatar_frame', 'post_bg')),
    cost        INTEGER NOT NULL CHECK (cost >= 0),
    css         TEXT NOT NULL,
    preview     TEXT,
    sort_order  INTEGER DEFAULT 0
);

-- ---------- 2. 用户签到 / 积分状态 ----------
CREATE TABLE IF NOT EXISTS user_rewards (
    user_name          TEXT PRIMARY KEY,
    points             INTEGER NOT NULL DEFAULT 0,
    streak             INTEGER NOT NULL DEFAULT 0,
    best_streak        INTEGER NOT NULL DEFAULT 0,
    last_checkin_date  DATE,
    total_checkins     INTEGER NOT NULL DEFAULT 0,
    owned_items        JSONB   NOT NULL DEFAULT '[]'::jsonb,
    equipped           JSONB   NOT NULL DEFAULT '{}'::jsonb,
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 3. 签到流水 ----------
CREATE TABLE IF NOT EXISTS checkins (
    id             SERIAL PRIMARY KEY,
    user_name      TEXT NOT NULL,
    checkin_date   DATE NOT NULL,
    points_awarded INTEGER NOT NULL,
    streak_at_time INTEGER NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_name, checkin_date)
);
CREATE INDEX IF NOT EXISTS checkins_user_idx ON checkins(user_name);

-- ---------- 4. RLS ----------
ALTER TABLE reward_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reward_items_public_read ON reward_items;
CREATE POLICY reward_items_public_read ON reward_items
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS reward_items_service_write ON reward_items;
CREATE POLICY reward_items_service_write ON reward_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;
-- 公开可读：他人需要看到你的头像框 / 帖子背景
DROP POLICY IF EXISTS user_rewards_public_read ON user_rewards;
CREATE POLICY user_rewards_public_read ON user_rewards
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS user_rewards_service_write ON user_rewards;
CREATE POLICY user_rewards_service_write ON user_rewards
    FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checkins_service_all ON checkins;
CREATE POLICY checkins_service_all ON checkins
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------- 5. 装饰物种子数据 ----------
-- 积分规则：基础 10 分 + 连签每日递增 2 分，上限 30
INSERT INTO reward_items (id, name, type, cost, css, preview, sort_order) VALUES
    ('frame_gold',      '鎏金环',   'avatar_frame',  60, 'box-shadow:0 0 0 2px #ffd24a, 0 0 12px rgba(255,210,74,0.75)',        '金', 10),
    ('frame_cyan',      '星环蓝',   'avatar_frame', 100, 'box-shadow:0 0 0 2px #00e8ff, 0 0 12px rgba(0,232,255,0.75)',        '蓝', 20),
    ('frame_purple',    '跃迁紫',   'avatar_frame', 160, 'box-shadow:0 0 0 2px #b558ff, 0 0 14px rgba(181,88,255,0.8)',        '紫', 30),
    ('frame_emerald',   '翡翠绿',   'avatar_frame', 240, 'box-shadow:0 0 0 2px #2fe08a, 0 0 14px rgba(47,224,138,0.8)',        '绿', 40),
    ('frame_supernova', '超新星',   'avatar_frame', 320, 'box-shadow:0 0 0 2px #ff5ea8, 0 0 18px rgba(120,120,255,0.9)',       '星', 50),
    ('bg_deepspace',    '深空蓝',   'post_bg',        80, 'linear-gradient(135deg, rgba(22,32,64,0.92), rgba(10,15,35,0.96))',  '深', 10),
    ('bg_nebula',       '星云紫',   'post_bg',       140, 'linear-gradient(135deg, rgba(62,26,92,0.88), rgba(22,10,45,0.96))',  '云', 20),
    ('bg_aurora',       '极光',     'post_bg',       200, 'linear-gradient(135deg, rgba(12,58,80,0.85), rgba(50,20,80,0.92))',  '光', 30),
    ('bg_forest',       '深林',     'post_bg',       260, 'linear-gradient(135deg, rgba(16,60,46,0.85), rgba(6,22,18,0.96))',   '林', 40),
    ('bg_crimson',      '暗红',     'post_bg',       340, 'linear-gradient(135deg, rgba(84,22,42,0.88), rgba(30,8,20,0.96))',   '红', 50)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    cost = EXCLUDED.cost,
    css = EXCLUDED.css,
    preview = EXCLUDED.preview,
    sort_order = EXCLUDED.sort_order;

-- ---------- 6. RPC：查询签到状态 ----------
CREATE OR REPLACE FUNCTION public.checkin_status(p_token TEXT)
RETURNS JSONB AS $fn$
DECLARE
    v_user        TEXT;
    v_today       DATE;
    v_r           user_rewards%ROWTYPE;
    v_streak_now  INTEGER;
    v_next        INTEGER;
BEGIN
    SELECT user_name INTO v_user FROM sessions
        WHERE token = p_token AND expires_at > NOW() LIMIT 1;
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', '未授权或token已过期');
    END IF;

    -- 以北京时间（UTC+8）作为「今天」的分界
    v_today := (NOW() AT TIME ZONE 'Asia/Shanghai')::date;

    SELECT * INTO v_r FROM user_rewards WHERE user_name = v_user;
    IF NOT FOUND THEN
        v_r.points := 0; v_r.streak := 0; v_r.best_streak := 0;
        v_r.total_checkins := 0;
        v_r.owned_items := '[]'::jsonb; v_r.equipped := '{}'::jsonb;
        v_r.last_checkin_date := NULL;
    END IF;

    IF v_r.last_checkin_date IS NULL OR v_r.last_checkin_date < v_today THEN
        IF v_r.last_checkin_date = (v_today - 1) THEN
            v_streak_now := COALESCE(v_r.streak, 0) + 1;
        ELSE
            v_streak_now := 1;
        END IF;
        v_next := LEAST(10 + (v_streak_now - 1) * 2, 30);
    ELSE
        v_streak_now := COALESCE(v_r.streak, 0);
        v_next := LEAST(10 + v_streak_now * 2, 30);
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'points', COALESCE(v_r.points, 0),
        'streak', COALESCE(v_r.streak, 0),
        'best_streak', COALESCE(v_r.best_streak, 0),
        'total_checkins', COALESCE(v_r.total_checkins, 0),
        'last_checkin_date', v_r.last_checkin_date,
        'can_checkin', (v_r.last_checkin_date IS NULL OR v_r.last_checkin_date < v_today),
        'next_award', v_next,
        'owned_items', COALESCE(v_r.owned_items, '[]'::jsonb),
        'equipped', COALESCE(v_r.equipped, '{}'::jsonb)
    );
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 7. RPC：执行每日签到 ----------
CREATE OR REPLACE FUNCTION public.checkin_daily(p_token TEXT)
RETURNS JSONB AS $fn$
DECLARE
    v_user   TEXT;
    v_today  DATE;
    v_r      user_rewards%ROWTYPE;
    v_streak INTEGER;
    v_best   INTEGER;
    v_award  INTEGER;
    v_points INTEGER;
    v_total  INTEGER;
    v_owned  JSONB;
    v_equip  JSONB;
BEGIN
    SELECT user_name INTO v_user FROM sessions
        WHERE token = p_token AND expires_at > NOW() LIMIT 1;
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', '未授权或token已过期');
    END IF;

    v_today := (NOW() AT TIME ZONE 'Asia/Shanghai')::date;

    SELECT * INTO v_r FROM user_rewards WHERE user_name = v_user FOR UPDATE;
    IF NOT FOUND THEN
        v_r.points := 0; v_r.streak := 0; v_r.best_streak := 0;
        v_r.total_checkins := 0;
        v_r.owned_items := '[]'::jsonb; v_r.equipped := '{}'::jsonb;
        v_r.last_checkin_date := NULL;
    END IF;

    IF v_r.last_checkin_date = v_today THEN
        RETURN jsonb_build_object('ok', false, 'error', '今天已经签到过了',
            'points', COALESCE(v_r.points, 0), 'streak', COALESCE(v_r.streak, 0));
    END IF;

    IF v_r.last_checkin_date = (v_today - 1) THEN
        v_streak := COALESCE(v_r.streak, 0) + 1;
    ELSE
        v_streak := 1;                      -- 断签 → 连签清零，从 1 重新开始
    END IF;

    v_best   := GREATEST(COALESCE(v_r.best_streak, 0), v_streak);
    v_award  := LEAST(10 + (v_streak - 1) * 2, 30);
    v_points := COALESCE(v_r.points, 0) + v_award;
    v_total  := COALESCE(v_r.total_checkins, 0) + 1;
    v_owned  := COALESCE(v_r.owned_items, '[]'::jsonb);
    v_equip  := COALESCE(v_r.equipped, '{}'::jsonb);

    INSERT INTO user_rewards (user_name, points, streak, best_streak, last_checkin_date,
                              total_checkins, owned_items, equipped, updated_at)
    VALUES (v_user, v_points, v_streak, v_best, v_today,
            v_total, v_owned, v_equip, NOW())
    ON CONFLICT (user_name) DO UPDATE SET
        points = EXCLUDED.points,
        streak = EXCLUDED.streak,
        best_streak = EXCLUDED.best_streak,
        last_checkin_date = EXCLUDED.last_checkin_date,
        total_checkins = EXCLUDED.total_checkins,
        updated_at = NOW();

    INSERT INTO checkins (user_name, checkin_date, points_awarded, streak_at_time)
    VALUES (v_user, v_today, v_award, v_streak)
    ON CONFLICT (user_name, checkin_date) DO NOTHING;

    RETURN jsonb_build_object(
        'ok', true,
        'awarded', v_award,
        'points', v_points,
        'streak', v_streak,
        'best_streak', v_best,
        'total_checkins', v_total
    );
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 8. RPC：兑换装饰物 ----------
CREATE OR REPLACE FUNCTION public.checkin_buy(p_token TEXT, p_item TEXT)
RETURNS JSONB AS $fn$
DECLARE
    v_user  TEXT;
    v_r     user_rewards%ROWTYPE;
    v_cost  INTEGER;
    v_owned JSONB;
    v_left  INTEGER;
BEGIN
    SELECT user_name INTO v_user FROM sessions
        WHERE token = p_token AND expires_at > NOW() LIMIT 1;
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', '未授权或token已过期');
    END IF;

    SELECT cost INTO v_cost FROM reward_items WHERE id = p_item;
    IF v_cost IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', '装饰物不存在');
    END IF;

    SELECT * INTO v_r FROM user_rewards WHERE user_name = v_user FOR UPDATE;
    IF NOT FOUND THEN
        v_r.points := 0; v_r.streak := 0; v_r.best_streak := 0;
        v_r.total_checkins := 0;
        v_r.owned_items := '[]'::jsonb; v_r.equipped := '{}'::jsonb;
    END IF;

    v_owned := COALESCE(v_r.owned_items, '[]'::jsonb);
    IF jsonb_exists(v_owned, p_item) THEN
        RETURN jsonb_build_object('ok', false, 'error', '你已拥有该装饰物');
    END IF;
    IF COALESCE(v_r.points, 0) < v_cost THEN
        RETURN jsonb_build_object('ok', false, 'error', '探索点数不足');
    END IF;

    v_owned := v_owned || to_jsonb(p_item);
    v_left  := COALESCE(v_r.points, 0) - v_cost;

    INSERT INTO user_rewards (user_name, points, streak, best_streak, last_checkin_date,
                              total_checkins, owned_items, equipped, updated_at)
    VALUES (v_user, v_left, COALESCE(v_r.streak, 0), COALESCE(v_r.best_streak, 0),
            v_r.last_checkin_date, COALESCE(v_r.total_checkins, 0),
            v_owned, COALESCE(v_r.equipped, '{}'::jsonb), NOW())
    ON CONFLICT (user_name) DO UPDATE SET
        points = EXCLUDED.points,
        owned_items = EXCLUDED.owned_items,
        updated_at = NOW();

    RETURN jsonb_build_object('ok', true, 'points', v_left, 'owned_items', v_owned);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 9. RPC：佩戴 / 卸下装饰物 ----------
CREATE OR REPLACE FUNCTION public.checkin_equip(p_token TEXT, p_type TEXT, p_item TEXT)
RETURNS JSONB AS $fn$
DECLARE
    v_user      TEXT;
    v_r         user_rewards%ROWTYPE;
    v_item_type TEXT;
    v_equipped  JSONB;
BEGIN
    SELECT user_name INTO v_user FROM sessions
        WHERE token = p_token AND expires_at > NOW() LIMIT 1;
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', '未授权或token已过期');
    END IF;

    IF p_type NOT IN ('avatar_frame', 'post_bg') THEN
        RETURN jsonb_build_object('ok', false, 'error', '未知装饰类型');
    END IF;

    SELECT * INTO v_r FROM user_rewards WHERE user_name = v_user;
    IF NOT FOUND THEN
        v_r.points := 0; v_r.streak := 0; v_r.best_streak := 0;
        v_r.total_checkins := 0;
        v_r.owned_items := '[]'::jsonb; v_r.equipped := '{}'::jsonb;
    END IF;
    v_equipped := COALESCE(v_r.equipped, '{}'::jsonb);

    IF p_item IS NULL THEN
        v_equipped := v_equipped - p_type;          -- 卸下
    ELSE
        SELECT type INTO v_item_type FROM reward_items WHERE id = p_item;
        IF v_item_type IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'error', '装饰物不存在');
        END IF;
        IF v_item_type <> p_type THEN
            RETURN jsonb_build_object('ok', false, 'error', '装饰类型不匹配');
        END IF;
        IF NOT jsonb_exists(COALESCE(v_r.owned_items, '[]'::jsonb), p_item) THEN
            RETURN jsonb_build_object('ok', false, 'error', '尚未拥有该装饰物');
        END IF;
        v_equipped := jsonb_set(v_equipped, ARRAY[p_type], to_jsonb(p_item), true);
    END IF;

    INSERT INTO user_rewards (user_name, points, streak, best_streak, last_checkin_date,
                              total_checkins, owned_items, equipped, updated_at)
    VALUES (v_user, COALESCE(v_r.points, 0), COALESCE(v_r.streak, 0), COALESCE(v_r.best_streak, 0),
            v_r.last_checkin_date, COALESCE(v_r.total_checkins, 0),
            COALESCE(v_r.owned_items, '[]'::jsonb), v_equipped, NOW())
    ON CONFLICT (user_name) DO UPDATE SET
        equipped = EXCLUDED.equipped,
        updated_at = NOW();

    RETURN jsonb_build_object('ok', true, 'equipped', v_equipped);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 10. 授权（anon 可调用，内部靠 token 校验身份） ----------
GRANT EXECUTE ON FUNCTION public.checkin_status(TEXT)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_daily(TEXT)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_buy(TEXT, TEXT)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_equip(TEXT, TEXT, TEXT)  TO anon, authenticated;

-- ---------- 校验 ----------
SELECT 'ok' AS status,
       (SELECT COUNT(*) FROM reward_items) AS item_count;
