# 设计文档：SpaceHub 工程化重构

日期：2026-10-05
作者：polytrack114514
状态：已批准

## 背景

SpaceHub 星枢 是一个以太空探索为主题的社区平台，托管于 GitHub Pages，采用 Supabase 作为后端（PostgreSQL + Edge Functions）。

当前存在两个核心问题：
1. **单文件难以维护**：`index.html` 7904 行，CSS/HTML/JS 混杂，无法定位问题、无法并行开发。
2. **发帖失败（写操作被拒）**：前端用 anon key 调用 Supabase，但 `posts_insert` 策略要求 `authenticated` 角色，导致所有写操作均被 RLS 拒绝。

## 目标

- 将 `index.html` 拆分为独立的 CSS/JS 模块，降低维护成本。
- 修复所有写操作失败的问题，使发帖、编辑、删除、评论、点赞、通知、发射管理均可正常使用。
- 不引入额外的构建工具（维持 GitHub Pages 原生加载）。
- 新增的写操作通过 Supabase Edge Function 代理，服务端用 `service_role` 写入，前端匿名 token 承载用户身份。

## 范围

### 包含
- 拆分 `index.html` 为模块化结构。
- 新增 `functions/post-write/index.ts`、`functions/comment-write/index.ts`、`functions/delete-post/index.ts`、`functions/notification-write/index.ts`、`functions/launch-write/index.ts` 五个 Edge Function。
- 新增 `sessions` 表与 `/functions/auth-token/index.ts` 用于签发/验证匿名会话 token。
- 调整 `supabase_setup.sql` 中 `posts`/`notifications`/`launches` 表的 INSERT/UPDATE/DELETE 策略，改为仅允许 `service_role` 或 `admin`。
- 修复登录失败根因：登录流程从直接调用 `verify_user_login` 改为调用 Edge Function 并签发 token。
- 保留前端所有内联事件处理器（`onclick` 等）无需改动。

### 不包含
- 新增社区功能（收藏、关注、私信等）。
- 修改 `features_index.html` 或 `worker.js`（历史文件暂保留，不做清理）。
- 迁移 Supabase Auth（保持自定义用户体系不变）。

## 设计

### 一、项目新结构

```
SpaceHub/
├── index.html                  # 仅保留 <head> + 骨架 DOM + script 加载（约 300 行）
├── sign-up.html                # 保持不变
├── features_index.html         # 保持不变（历史遗留）
├── worker.js                   # 保持不变（历史遗留）
├── favicon.png
├── assets/                     # 保持不变
├── supabase/                   # 保持不变
├── supabase_setup.sql          # 更新：调整 RLS 策略
├── supabase_edge_register.sql  # 保持不变
├── supabase_fix_emergency.sql  # 保持不变
├── css/
│   └── main.css                # 全部样式（原 L8-4481）
├── js/
│   ├── config.js               # 全局状态、Supabase 初始化、常量、工具函数
│   ├── posts.js                # 帖子：加载/创建/编辑/删除/搜索/点赞/置顶/渲染
│   ├── comments.js             # 评论、@提及
│   ├── auth.js                 # 登录/登出/用户资料渲染
│   ├── notifications.js        # 通知系统 + 消息轮询
│   ├── launches.js             # 发射时间表/倒计时/管理/结果/提醒
│   ├── ai.js                   # 星际助手 + Agnes-AI 抽屉
│   ├── apod.js                 # NASA 每日天文一图
│   ├── spacedata.js            # 太空数据中心（ISS/月相/小行星/乘组/流星雨/日食/3D太阳系）
│   ├── admin.js                # 管理后台
│   ├── video.js                # 视频嵌入解析
│   └── effects.js              # 星空动画、鼠标高光、灯箱、初始化引导
└── supabase/functions/
    ├── register/index.ts       # 保持不变
    ├── ai-chat-proxy/index.ts  # 保持不变
    ├── admin-verify/index.ts   # 保持不变
    ├── post-write/index.ts     # [新增] 发帖/编辑/删除帖子的统一入口
    ├── comment-write/index.ts  # [新增] 发表评论的入口
    ├── notification-write/index.ts  # [新增] 写通知的入口
    ├── launch-write/index.ts   # [新增] 发射任务的增删改入口
    └── auth-token/index.ts     # [新增] 登录成功后签发匿名会话 token
```

### 二、token 机制（解决写操作权限问题）

#### 现状问题
- 前端用 anon key 访问 Supabase。
- 数据库策略要求 `authenticated` 角色才能 INSERT/UPDATE。
- 没有 Supabase Auth，`auth.uid()` 恒为 null，`auth.role()` 恒为 `anon`。
- 因此所有写操作均被 RLS 拒绝。

#### 方案：匿名会话 token
1. **登录时**：前端调用 `POST /functions/auth-token` 携带用户名和密码（由 `verify_user_login` RPC 校验）。
2. **服务端**：校验通过后，生成一个随机 session token（64 字符 hex），写入 `sessions` 表，返回给前端。
3. **写操作时**：前端在请求头 `Authorization: Bearer <token>` 中携带该 token，Edge Function 校验 token 有效性后，用 `service_role` 写入数据库。
4. **token 有效期**：7 天，自动过期。

#### sessions 表结构
```sql
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_name TEXT NOT NULL REFERENCES users(name),
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_token_idx ON sessions(token);
```

### 三、Edge Function 设计

#### 3.1 `post-write`
- **路径**：`POST https://tktfrrvaqwbtdhiqwnna.supabase.co/functions/v1/post-write`
- **请求头**：`Authorization: Bearer <session-token>`（登录成功后 localStorage 中的 token）
- **请求体**：
  ```json
  {
    "action": "create" | "update" | "delete",
    "post_id": "xxx",        // update/delete 时必填
    "title": "...",          // create/update 时必填
    "content": "...",        // create/update 时必填
    "image": "...",          // create/update 时可选
    "source_url": "..."      // create/update 时可选
  }
  ```
- **响应体（成功）**：
  ```json
  { "ok": true, "post_id": "xxx" }
  ```
- **响应体（失败）**：
  ```json
  { "ok": false, "error": "token已过期|无权操作|用户名无效" }
  ```
- **逻辑**：
  1. 从 `Authorization` 头提取 token，查询 `sessions` 表验证有效性。
  2. 获取 `user_name`。
  3. 根据 `action` 执行对应 DB 操作（`service_role` 写入）。
  4. `create` 时自动生成 id（`c_${Date.now()}_${random}`）。
  5. 返回结果。
- **CORS**：允许 `https://polytrack114514.github.io`。

#### 3.2 `comment-write`
- **路径**：`POST /functions/v1/comment-write`
- **请求体**：
  ```json
  {
    "action": "add" | "delete",
    "post_id": "xxx",
    "comment_id": "xxx",    // delete 时必填
    "content": "...",       // add 时必填
    "author": "..."         // 由 token 解析，不用前端传
  }
  ```
- **逻辑**：验证 token → 将评论追加到目标帖子的 `comments` JSONB 数组（或移除）。

#### 3.3 `notification-write`
- **路径**：`POST /functions/v1/notification-write`
- **请求体**：
  ```json
  {
    "action": "create",
    "target_user": "...",
    "from_user": "...",
    "type": "like" | "comment" | "mention",
    "post_id": "...",
    "content": "..."
  }
  ```

#### 3.4 `launch-write`
- **路径**：`POST /functions/v1/launch-write`
- **请求体**：
  ```json
  {
    "action": "create" | "update" | "delete" | "mark_result",
    "launch_id": 123,
    ...字段见 launches 表结构
  }
  ```
- **权限检查**：仅 `role = 'admin'` 的 session 可执行 delete/edit/mark_result。

#### 3.5 `auth-token`
- **路径**：`POST /functions/v1/auth-token`
- **请求体**：`{ "name": "xxx", "password": "xxx" }`
- **逻辑**：调用 `verify_user_login` RPC → 校验成功 → 生成 64 字符 hex token → 写入 `sessions` 表（`expires_at = NOW() + 7 days`）→ 返回 `{ "token": "...", "expires_at": "..." }`。
- **响应体（失败）**：`{ "ok": false, "error": "用户名或密码错误" }`

### 四、数据库策略调整

```sql
-- posts 表：仅 service_role 可写
DROP POLICY IF EXISTS "posts_insert" ON posts;
CREATE POLICY "posts_service_write" ON posts
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- notifications 表：同上
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_service_write" ON notifications
FOR INSERT TO service_role WITH CHECK (true);

-- launches 表：admin 可写
DROP POLICY IF EXISTS "launches_admin_write" ON launches;
CREATE POLICY "launches_service_write" ON launches
FOR ALL TO service_role USING (true) WITH CHECK (true);
```

同时保留现有 SELECT 策略：
- `posts_public_read`：`FOR SELECT TO anon, authenticated USING (true)`
- `notifications_select`：`FOR SELECT TO authenticated USING (...)`
- `launches_public_read`：`FOR SELECT TO anon, authenticated USING (true)`

### 五、加载顺序

```html
<script src="js/config.js"></script>
<script src="js/posts.js"></script>
<script src="js/comments.js"></script>
<script src="js/auth.js"></script>
<script src="js/notifications.js"></script>
<script src="js/launches.js"></script>
<script src="js/ai.js"></script>
<script src="js/video.js"></script>
<script src="js/apod.js"></script>
<script src="js/spacedata.js"></script>
<script src="js/admin.js"></script>
<script src="js/effects.js"></script>
```

所有模块均为普通 `<script>` 标签，函数保持全局作用域，内联 `onclick` 无需改动。

### 六、错误处理改进

- 所有写操作失败时，返回更具体的错误信息（如 `"登录已过期，请重新登录"`、`"无权操作此帖子"`）。
- 前端不再用 `alert()` 报错，改为在相应位置显示 toast 提示。

### 八、前端调用契约（写操作迁移指南）

所有写操作从直接调用 `sb.from('表').insert(...)` 改为调用 Edge Function：

| 原代码 | 新代码（示例） |
|---|---|
| `sb.from('posts').insert({...})` | `fetch(POST_WRITE_URL, { method:'POST', headers:{'Authorization':'Bearer '+sessionToken,'Content-Type':'application/json'}, body: JSON.stringify({action:'create', title, content, image, source_url}) })` |
| `sb.from('posts').update({...}).eq('id', id)` | `fetch(POST_WRITE_URL, {..., body: JSON.stringify({action:'update', post_id:id, title, content, image, source_url}) })` |
| `sb.from('posts').delete().eq('id', id)` | `fetch(POST_WRITE_URL, {..., body: JSON.stringify({action:'delete', post_id:id}) })` |
| `sb.rpc('verify_user_login', {...})` | `fetch(AUTH_TOKEN_URL, { method:'POST', body: JSON.stringify({name, password}) })` → 成功后存 `token` 到 localStorage |
| `sb.from('notifications').insert(...)` | `fetch(NOTIFY_WRITE_URL, {..., body: JSON.stringify({action:'create', target_user, from_user, type, post_id, content}) })` |
| `sb.from('launches').insert(...)` | `fetch(LAUNCH_WRITE_URL, {..., body: JSON.stringify({action:'create', ...launchFields}) })` |

**常量定义**（放入 `config.js`）：
```js
const SUPABASE_URL = 'https://tktfrrvaqwbtdhiqwnna.supabase.co';
const POST_WRITE_URL = `${SUPABASE_URL}/functions/v1/post-write`;
const COMMENT_WRITE_URL = `${SUPABASE_URL}/functions/v1/comment-write`;
const NOTIFICATION_WRITE_URL = `${SUPABASE_URL}/functions/v1/notification-write`;
const LAUNCH_WRITE_URL = `${SUPABASE_URL}/functions/v1/launch-write`;
const AUTH_TOKEN_URL = `${SUPABASE_URL}/functions/v1/auth-token`;
```

**Session Token 管理**（放入 `config.js`）：
```js
let sessionToken = localStorage.getItem('space_token') || null;
let tokenExpiresAt = parseInt(localStorage.getItem('space_token_expires') || '0');

function isTokenValid() {
    return !!sessionToken && Date.now() < tokenExpiresAt;
}

function clearSession() {
    sessionToken = null;
    localStorage.removeItem('space_token');
    localStorage.removeItem('space_token_expires');
}
```

### 七、验收标准

| 功能 | 验收方式 |
|---|---|
| 发帖 | 登录后点击「发布帖子」，帖子出现在 feed 顶部 |
| 编辑帖子 | 登录自己发布的帖子，可编辑并保存 |
| 删除帖子 | 登录自己发布的帖子，可删除 |
| 点赞 | 登录后可点赞，作者收到通知 |
| 评论 | 登录后可发表评论，@提及触发通知 |
| 通知 | 收到通知后标红角标，可标记已读/删除 |
| 发射管理 | admin 账号可添加/编辑/删除发射任务 |
| AI 助手 | 可正常对话 |
| APOD | 正常加载 NASA 每日天文图 |
| 太空数据中心 | ISS/月相/小行星等数据正常加载 |
| 管理后台 | admin 可管理用户、切换注册开关 |
| 全站无 JS 报错 | 控制台无报错，所有内联事件正常触发 |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| `sessions` 表 token 泄露 | token 仅存 localStorage，7 天过期，不暴露给第三方 |
| 写操作仍被拒绝 | 先部署 Edge Function 再调整 RLS 策略，灰度验证 |
| 原有功能回退 | 拆分前提交当前版本作为分支，逐步替换 |

## 实施顺序

1. 新建目录结构（`css/`、`js/`、`supabase/functions/`）
2. 抽取 CSS 到 `css/main.css`
3. 抽取 JS 到各模块文件，按依赖顺序组织
4. 实现 `auth-token` Edge Function
5. 实现 `post-write` Edge Function
6. 实现其余写操作 Edge Function
7. 更新 SQL 策略（DDL）
8. 更新 `index.html` 引入模块化脚本
9. 本地测试所有写操作
10. 部署并验证线上行为
