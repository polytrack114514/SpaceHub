# SpaceHub 项目记忆

## 当前状态

- 项目仓库：`https://github.com/polytrack114514/SpaceHub`
- 在线地址：`https://polytrack114514.github.io/SpaceHub/`
- 部署方式：GitHub Pages 静态部署
- 前端入口：`index.html`
- 注册页面：`sign-up.html`
- 后端能力：Supabase 数据库与 Edge Functions

## 最近完成的改动

- 注册服务已从不可稳定访问的 `workers.dev` 迁移到 Supabase Edge Function。
- 注册 Edge Function 位于 `supabase/functions/register/index.ts`。
- 注册服务使用 Cloudflare Turnstile 服务端校验，Supabase 中配置了 `TURNSTILE_SECRET`。
- 注册页增加了桌面端鼠标跟随高光，触摸设备不会启用该效果。
- 首页已完整移除收藏和关注功能：收藏页签、帖子收藏按钮、个人资料中的“我的收藏”、收藏面板、关注入口、关注/粉丝统计及相关页面逻辑均不再提供。
- 当前保留点赞、评论、消息通知、发帖、火箭发射、发射提醒、太空数据中心、NASA APOD、在线用户、图片灯箱和 AI 助手功能。
- 太空数据中心当前包含 ISS 追踪、月相、近地小行星、ISS 乘组、流星雨、日食月食、发射任务和 NASA Eyes 3D 太阳系共 8 个面板。
- 发射任务支持普通用户查看、官方账号维护、发射日期待定、结果标记、Agnes-AI 任务助手和发射提醒。
- 注册页使用 Cloudflare Turnstile + Supabase Edge Function，并加入桌面端鼠标跟随高光。

## 最近提交

- `402097f feat: enhance signup glow and remove bookmarks`
- 本地 `main` 与远程 `origin/main` 已同步。

## 修改注意事项

- 不要把 Supabase 登录密码、服务密钥、Turnstile Secret 或其他敏感信息写入仓库。
- 修改静态页面后，检查页面引用、JavaScript 语法和 `git diff --check`。
- 修改功能说明时同步更新 `README.md` 和本文件。
