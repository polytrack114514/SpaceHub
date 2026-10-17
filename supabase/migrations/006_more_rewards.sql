-- ============================================================
-- SpaceHub 数据库迁移 006：扩充装饰物（静态 + 动态）
-- 执行方式：Supabase Dashboard > SQL Editor 中运行（幂等，可重复执行）
--
-- 本次把 reward_items.css 的语义统一为「完整声明列表」：
--   静态 = 直接写属性，如  background:linear-gradient(...)
--   动态 = 只写 animation:ck-xxx ...，真正的视觉状态由
--          index.html 内联样式里的 @keyframes 提供
--          （内联 style 无法定义 @keyframes，动画必须放在样式表里）
-- 因此本次同时把已有的 5 个帖子背景补上 background: 前缀，
-- 否则前端按属性名解析时会失败。
-- ============================================================

INSERT INTO reward_items (id, name, type, cost, css, preview, sort_order) VALUES
    -- ---------- 静态头像框（原有 5 款，价格不变） ----------
    ('frame_gold',      '鎏金环',     'avatar_frame',   60, 'box-shadow:0 0 0 2px #ffd24a, 0 0 12px rgba(255,210,74,0.75)',                    '金', 10),
    ('frame_cyan',      '星环蓝',     'avatar_frame',  100, 'box-shadow:0 0 0 2px #00e8ff, 0 0 12px rgba(0,232,255,0.75)',                    '蓝', 20),
    ('frame_purple',    '跃迁紫',     'avatar_frame',  160, 'box-shadow:0 0 0 2px #b558ff, 0 0 14px rgba(181,88,255,0.8)',                     '紫', 30),
    ('frame_emerald',   '翡翠绿',     'avatar_frame',  240, 'box-shadow:0 0 0 2px #2fe08a, 0 0 14px rgba(47,224,138,0.8)',                     '绿', 40),
    ('frame_supernova', '超新星',     'avatar_frame',  320, 'box-shadow:0 0 0 2px #ff5ea8, 0 0 18px rgba(120,120,255,0.9)',                    '星', 50),
    -- ---------- 静态头像框（新增 3 款） ----------
    ('frame_ember',     '余烬橙',     'avatar_frame',  180, 'box-shadow:0 0 0 2px #ff7a3c, 0 0 12px rgba(255,122,60,0.75)',                    '橙', 60),
    ('frame_ice',       '寒冰白',     'avatar_frame',  260, 'box-shadow:0 0 0 2px #d8f4ff, 0 0 14px rgba(140,220,255,0.85)',                   '冰', 70),
    ('frame_void',      '虚空紫焰',   'avatar_frame',  360, 'box-shadow:0 0 0 2px #6a5cff, 0 0 16px rgba(30,20,80,0.95)',                     '虚', 80),
    -- ---------- 静态帖子背景（原有 5 款，补 background: 前缀） ----------
    ('bg_deepspace',    '深空蓝',     'post_bg',         80, 'background:linear-gradient(135deg, rgba(22,32,64,0.92), rgba(10,15,35,0.96))',  '深', 10),
    ('bg_nebula',       '星云紫',     'post_bg',        140, 'background:linear-gradient(135deg, rgba(62,26,92,0.88), rgba(22,10,45,0.96))',  '云', 20),
    ('bg_aurora',       '极光',       'post_bg',        200, 'background:linear-gradient(135deg, rgba(12,58,80,0.85), rgba(50,20,80,0.92))',  '光', 30),
    ('bg_forest',       '深林',       'post_bg',        260, 'background:linear-gradient(135deg, rgba(16,60,46,0.85), rgba(6,22,18,0.96))',   '林', 40),
    ('bg_crimson',      '暗红',       'post_bg',        340, 'background:linear-gradient(135deg, rgba(84,22,42,0.88), rgba(30,8,20,0.96))',   '红', 50),
    -- ---------- 静态帖子背景（新增 3 款） ----------
    ('bg_ember',        '熔岩',       'post_bg',        200, 'background:linear-gradient(135deg, rgba(92,34,16,0.9), rgba(34,10,6,0.96))',    '熔', 60),
    ('bg_ice',          '冰原',       'post_bg',        300, 'background:linear-gradient(135deg, rgba(20,52,78,0.88), rgba(8,18,34,0.96))',   '原', 70),
    ('bg_cosmos',       '星尘',       'post_bg',        400, 'background:linear-gradient(135deg, rgba(30,24,74,0.9), rgba(12,8,32,0.97))',    '尘', 80),
    -- ---------- 动态头像框（新增 3 款，视觉状态见 @keyframes） ----------
    ('frame_pulse',     '脉冲星环',   'avatar_frame',  600, 'animation:ck-pulse 2.4s ease-in-out infinite',                                  '脉', 110),
    ('frame_heartbeat', '心跳金环',   'avatar_frame',  700, 'animation:ck-heartbeat 1.6s ease-in-out infinite',                              '跳', 120),
    ('frame_liquid',    '液态玻璃环', 'avatar_frame',  900, 'animation:ck-liquid-ring 5s ease-in-out infinite',                              '璃', 130),
    -- ---------- 动态帖子背景（新增 3 款） ----------
    ('bg_flow_nebula',  '流动星云',   'post_bg',        800, 'animation:ck-flow-nebula 8s ease-in-out infinite',                               '流', 110),
    ('bg_flow_aurora',  '流动极光',   'post_bg',       1000, 'animation:ck-flow-aurora 9s ease-in-out infinite',                              '动', 120),
    ('bg_liquid',       '液态玻璃',   'post_bg',       1200, 'backdrop-filter:blur(14px) saturate(1.35);animation:ck-liquid-panel 6s ease-in-out infinite', '玻', 130)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    cost = EXCLUDED.cost,
    css = EXCLUDED.css,
    preview = EXCLUDED.preview,
    sort_order = EXCLUDED.sort_order;

-- ---------- 校验 ----------
SELECT 'ok' AS status,
       (SELECT COUNT(*) FROM reward_items) AS item_count,
       (SELECT COUNT(*) FROM reward_items WHERE css LIKE '%animation:%') AS animated_count;
