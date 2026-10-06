-- 重置所有用户密码为 NULL，强制用户重新注册（密码改为明文存储）
UPDATE users SET password = NULL;
