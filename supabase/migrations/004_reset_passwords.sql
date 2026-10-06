-- 004: 密码改为明文存储
-- 1. 清空所有旧 SHA-256 哈希密码
UPDATE users SET password = NULL WHERE password IS NOT NULL;

-- 2. 给 admin 用户设置明文密码 1028
UPDATE users SET password = '1028' WHERE role = 'admin';

-- 3. 给 polytrack1@outlook.com 恢复原始密码
UPDATE users SET password = 'SXsx114514?' WHERE name = 'polytrack1@outlook.com';
