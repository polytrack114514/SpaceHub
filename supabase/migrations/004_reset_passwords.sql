-- ============================================================
-- 004: 密码改为明文存储 + 创建 admin 用户
-- ============================================================

-- 1. 将所有用户密码设为 NULL（清除旧哈希）
UPDATE users SET password = NULL WHERE password IS NOT NULL;

-- 2. 为 admin 角色设置明文密码
-- 如果 admin 用户不存在，则创建
INSERT INTO users (name, password, role, banned, avatar)
VALUES ('admin', '1028', 'admin', false, '')
ON CONFLICT (name) DO UPDATE SET
  password = '1028',
  role = 'admin',
  banned = false;

-- 3. 确保 SpaceHub官方 用户有正确的明文密码
UPDATE users SET password = 'SXsx114514?' WHERE name = 'polytrack1@outlook.com';

-- 4. 清理测试账号（可选，保留以防需要）
-- DELETE FROM users WHERE name = '100';
