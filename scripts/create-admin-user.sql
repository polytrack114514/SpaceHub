-- ============================================================
-- 补充: 在 users 表中创建 admin 账户
-- 运行方式: Supabase Dashboard > SQL Editor
-- ============================================================

-- 检查是否已有 admin 用户
SELECT id, name, role, banned FROM users WHERE name = 'admin';

-- 如果上面返回空，执行以下 INSERT:
INSERT INTO users (name, password, role, banned, avatar)
VALUES ('admin', '1028', 'admin', false, '')
ON CONFLICT (name) DO UPDATE SET
  password = '1028',
  role = 'admin',
  banned = false;

-- 验证结果
SELECT id, name, role, SUBSTR(password, 1, 4) AS pwd_preview FROM users WHERE name = 'admin';
