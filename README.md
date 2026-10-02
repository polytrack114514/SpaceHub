<div align="center">

# 🌌 SpaceHub 星枢

### SpaceHub 星枢 · Explore the Universe Together

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Online-brightgreen?style=flat-square&logo=githubpages)](https://polytrack114514.github.io/SpaceHub/)
[![Language](https://img.shields.io/badge/Language-HTML%20%7C%20CSS%20%7C%20JS-orange?style=flat-square&logo=html5)](https://github.com/polytrack114514/SpaceHub)
[![Supabase](https://img.shields.io/badge/Database-Supabase-green?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square&logo=opensourceinitiative)](https://opensource.org/licenses/MIT)

**[🌐 在线预览 / Live Demo](https://polytrack114514.github.io/SpaceHub/)** ·
**[📦 仓库 / Repository](https://github.com/polytrack114514/SpaceHub)**

🌐 **语言 / Language:** [简体中文](#-简体中文) · [English](#-english)

</div>

---

## 🇨🇳 简体中文

### 📖 项目简介

**SpaceHub 星枢** 是一个以太空探索为主题的社区平台，提供帖子发布、评论、点赞、消息通知、火箭发射追踪、太空数据中心、NASA 每日天文一图和 AI 助手。项目采用深空配色、玻璃态卡片和霓虹动效，适配手机、平板与桌面浏览器。

### 📁 项目结构

```
SpaceHub/
├── index.html                         # 首页：社区、发射追踪、数据中心与 AI 功能
├── sign-up.html                       # 注册页：Turnstile 验证、注册服务与鼠标跟随高光
├── features_index.html                # 功能展示页
├── supabase_setup.sql                 # Supabase 数据库初始化脚本
├── supabase_edge_register.sql         # 注册 RPC 与权限设置
├── supabase_fix_emergency.sql         # 数据库修复脚本
├── supabase/functions/register/       # 注册 Edge Function
├── worker.js                          # 历史 Worker 代码，当前注册页不再调用
├── favicon.png                        # 网站图标
└── README.md                          # 项目说明文档
```

### ✨ 当前功能

| 功能 | 说明 |
|------|------|
| 📝 帖子系统 | 发布、编辑、删除和置顶图文帖子；支持标题、正文、图片链接和来源链接 |
| 🔥 帖子筛选 | 支持热门、最新、AI 助手和火箭发射四个主标签 |
| 🔍 搜索帖子 | 按标题、内容和作者实时搜索 |
| 💬 评论互动 | 登录后发表评论；支持 @提及并触发通知 |
| ❤️ 点赞 | 登录后点赞，向帖子作者发送通知 |
| 👤 个人主页 | 查看头像、帖子和获赞数据；可从帖子进入用户主页 |
| 🔔 消息通知 | 接收点赞、评论和 @提及通知，可标记已读或删除通知 |
| 🎬 视频嵌入 | 自动识别 YouTube 和 Bilibili 链接并嵌入播放器；默认不自动播放 |
| 🚀 发射时间表 | 查看近期发射、倒计时和已发射归档；归档最多保留最近 15 条 |
| 📊 发射管理 | 官方账号可添加、编辑、删除发射任务并标记成功、部分成功或失败 |
| 🔔 发射提醒 | 用户可为发射任务开启或关闭提醒 |
| 🤖 AI 助手 | 通过 Supabase Edge Function 调用 Agnes AI，回答太空与航天问题 |
| 🧠 Agnes-AI | 针对具体火箭任务的智能抽屉，可询问任务状态、火箭和科学意义 |
| 🛰️ 太空数据中心 | ISS 追踪、月相、近地小行星、ISS 乘组、流星雨、日食月食、发射任务和 3D 太阳系 |
| 🌌 NASA APOD | 展示 NASA 每日天文一图，支持缓存回退与图片放大 |
| 🟢 在线用户 | 显示当前在线探索者数量和在线头像 |
| 🖼️ 图片灯箱 | 点击帖子图片查看大图 |
| 🛡️ 管理后台 | 管理用户、禁言用户、管理站点注册开关 |
| 📝 注册页 | Cloudflare Turnstile 人机验证、Supabase Edge Function 注册、注册开关检查 |
| ✨ 注册页高光 | 桌面端鼠标跟随背景高光；触摸设备不启用该效果 |
| 📱 响应式界面 | 适配手机、平板和桌面屏幕 |
| 🌠 视觉动效 | 星空背景、超光速加载动画、玻璃态卡片、霓虹效果、进场动画和骨架屏 |

首页当前**不包含收藏和关注功能**：收藏页签、收藏按钮、个人收藏列表、关注入口、关注/粉丝统计及相关逻辑均不在当前页面中；点赞、评论和消息通知功能仍然保留。

### 🛰️ 太空数据中心

| 面板 | 功能 | 数据来源 |
|------|------|---------|
| ISS 追踪 | 国际空间站实时位置、纬度、经度、高度和速度 | wheretheiss.at API |
| 月相 | 当前月相、照明比例、月龄和月相信息 | JavaScript 天文计算 |
| 近地小行星 | 今日接近地球的小行星及距离、直径、速度和危险等级 | NASA NeoWS API |
| ISS 乘组 | 当前空间站乘组信息 | 静态数据 |
| 流星雨 | 流星雨活动日期、峰值和观测信息 | 静态数据集 |
| 日食月食 | 日食、月食预报、可见区域和倒计时 | 静态数据集 |
| 发射任务 | 发射任务列表与任务信息 | Supabase / NASA API |
| 3D 太阳系 | NASA Eyes 交互式太阳系视图 | NASA Eyes |

### 🚀 发射任务管理

- 普通用户可以查看近期发射、倒计时、已发射归档和发射结果。
- 官方账号可以维护发射任务，包括火箭、机构、时间、地点、任务、图片和描述。
- 发射日期支持“日期待确定”。
- 发射任务可打开 Agnes-AI 任务助手。
- 用户可以为具体发射任务设置提醒。

### 🛠️ 技术栈与外部服务

| 技术或服务 | 用途 |
|------------|------|
| HTML5 / CSS3 / JavaScript | 页面结构、样式、交互和动画；首页主要逻辑集中在 `index.html` |
| Supabase | PostgreSQL 数据库、数据读写和客户端初始化 |
| Supabase Edge Functions | AI 代理、管理员校验和注册服务 |
| Cloudflare Turnstile | 注册页人机验证 |
| GitHub Pages | 静态网站托管 |
| NASA APOD API | NASA 每日天文一图 |
| NASA NeoWS API | 近地小行星数据 |
| wheretheiss.at API | ISS 实时位置 |
| NASA Eyes | 3D 太阳系交互视图 |
| Agnes AI | AI 太空助手和发射任务助手 |
| Google Fonts | Exo 2 / Michroma 字体 |

### 📊 数据库结构

| 表名 | 用途与主要字段 |
|------|----------------|
| `posts` | 帖子、点赞、评论、置顶和媒体信息 |
| `users` / `user_profiles` | 用户、密码哈希、头像、活跃时间和禁言状态；当前页面不提供关注/粉丝功能 |
| `launches` | 火箭发射任务、状态、结果和任务详情 |
| `notifications` | 点赞、评论和提及通知 |
| `site_settings` | 注册开关等站点设置 |

### 🔒 安全与部署说明

- 注册请求先经过 Cloudflare Turnstile 校验，再由 `supabase/functions/register/index.ts` 调用服务端注册逻辑。
- `TURNSTILE_SECRET` 和 Supabase `service_role` 密钥只应配置在服务端环境变量中，不得写入前端或提交到仓库。
- 前端只使用可公开的 Supabase publishable/anon key。
- 用户输入在渲染前经过 `escapeHtml()` 转义，减少 XSS 风险。
- 管理员操作通过 Edge Function 校验，不在前端硬编码管理员密码。
- GitHub Pages 发布静态文件；推送 `main` 分支后由 Pages 部署。

### 🎨 设计系统

| 属性 | 值 |
|------|------|
| 主色 | 电蓝 `#5b8fff` |
| 辅色 | 紫罗兰 `#b558ff` |
| 霓虹青 | `#00e8ff` |
| 霓虹品红 | `#ff3d7f` |
| 背景 | 深空蓝 `#060814` |
| 表面 | `rgba(14, 18, 36, 0.75)` |
| 字体 | Exo 2（正文）/ Michroma（标签） |
| 动效 | 星空、超光速加载、进场动画、hover 微交互、骨架屏、扫描线 |

### 📄 许可证

[MIT License](https://opensource.org/licenses/MIT)

---

## 🇬🇧 English

### 📖 About

**SpaceHub** is a space-themed community platform for publishing posts, comments, likes, notifications, rocket launch tracking, a space data center, NASA APOD, and AI assistants. It uses a deep-space palette, glassmorphism cards, neon effects, and responsive layouts for mobile, tablet, and desktop browsers.

### 📁 Project Structure

```
SpaceHub/
├── index.html                         # Home page and main application logic
├── sign-up.html                       # Signup, Turnstile, registration and pointer glow
├── features_index.html                # Feature showcase page
├── supabase_setup.sql                 # Supabase database initialization
├── supabase_edge_register.sql         # Registration RPC and permissions
├── supabase_fix_emergency.sql         # Database repair script
├── supabase/functions/register/       # Registration Edge Function
├── worker.js                          # Legacy Worker code; signup no longer calls it
├── favicon.png                        # Site icon
└── README.md                          # Project documentation
```

### ✨ Current Features

| Feature | Description |
|---------|-------------|
| 📝 Posts | Publish, edit, delete, and pin posts with text, images, and source links |
| 🔥 Post Views | Hot, New, AI Assistant, and Launches tabs |
| 🔍 Search | Real-time search by title, content, and author |
| 💬 Comments | Login-required comments with @mention notifications |
| ❤️ Likes | Login-required likes with author notifications |
| 👤 Profiles | View avatars, posts, and likes |
| 🔔 Notifications | Like, comment, and mention notifications with read/delete actions |
| 🎬 Video Embeds | Automatic YouTube and Bilibili embeds with autoplay disabled |
| 🚀 Launch Schedule | Upcoming launches, second-level countdowns, and launched archive |
| 📊 Launch Management | Official accounts can edit launches and mark success, partial success, or failure |
| 🔔 Launch Reminders | Users can enable or disable reminders for launches |
| 🤖 AI Assistant | Agnes AI through a Supabase Edge Function proxy |
| 🧠 Agnes-AI | A task drawer for questions about a specific rocket mission |
| 🛰️ Space Data Center | ISS, moon phase, NEOs, ISS crew, meteors, eclipses, launches, and 3D solar system |
| 🌌 NASA APOD | NASA Astronomy Picture of the Day with cached fallback and lightbox |
| 🟢 Online Users | Current explorer count and online avatars |
| 🖼️ Image Lightbox | Enlarge post images in a lightbox |
| 🛡️ Admin Dashboard | User management, bans, and registration toggle |
| 📝 Signup | Cloudflare Turnstile, Supabase Edge Function registration, and registration-toggle checks |
| ✨ Signup Glow | Desktop pointer-following background glow; disabled on touch devices |
| 📱 Responsive UI | Mobile, tablet, and desktop layouts |
| 🌠 Visual Effects | Starfield, warp-speed loader, glassmorphism, neon effects, entrance animations, and skeleton loading |

The home page **does not include bookmarks or following**. Bookmark tabs, bookmark buttons, profile bookmark lists, follow controls, follower/following statistics, and their related page logic are not part of the current page. Likes, comments, and notifications remain available.

### 🛰️ Space Data Center

| Panel | Feature | Data Source |
|-------|---------|-------------|
| ISS Tracking | Live ISS position, latitude, longitude, altitude, and velocity | wheretheiss.at API |
| Moon Phase | Current phase, illumination, age, and phase information | JavaScript astronomy calculations |
| Near-Earth Asteroids | Today's NEOs with distance, diameter, velocity, and hazard level | NASA NeoWS API |
| ISS Crew | Current crew information | Static data |
| Meteor Showers | Activity dates, peaks, and observation information | Static dataset |
| Solar/Lunar Eclipses | Predictions, visibility, and countdowns | Static dataset |
| Launches | Launch missions and mission information | Supabase / NASA API |
| 3D Solar System | Interactive NASA Eyes solar-system view | NASA Eyes |

### 🛠️ Technology and Services

| Technology or Service | Purpose |
|-----------------------|---------|
| HTML5 / CSS3 / JavaScript | Structure, styling, interaction, and animation; most home-page logic is in `index.html` |
| Supabase | PostgreSQL database, data access, and client initialization |
| Supabase Edge Functions | AI proxy, admin verification, and signup service |
| Cloudflare Turnstile | Signup human-verification challenge |
| GitHub Pages | Static hosting |
| NASA APOD API | NASA Astronomy Picture of the Day |
| NASA NeoWS API | Near-Earth asteroid data |
| wheretheiss.at API | Live ISS position |
| NASA Eyes | Interactive 3D solar-system view |
| Agnes AI | Space assistant and launch-task assistant |
| Google Fonts | Exo 2 / Michroma |

### 📊 Database Schema

| Table | Purpose |
|-------|---------|
| `posts` | Posts, likes, comments, pins, and media metadata |
| `users` / `user_profiles` | Users, password hashes, avatars, activity, and bans; no current follow UI |
| `launches` | Rocket missions, statuses, results, and mission details |
| `notifications` | Like, comment, and mention notifications |
| `site_settings` | Registration toggle and other site settings |

### 🔒 Security and Deployment

- Signup requests are verified by Cloudflare Turnstile, then processed by `supabase/functions/register/index.ts`.
- `TURNSTILE_SECRET` and the Supabase `service_role` key must remain server-side and must never be committed.
- The frontend only uses a public Supabase publishable/anon key.
- User content is escaped with `escapeHtml()` before rendering.
- Admin actions are verified through an Edge Function instead of hardcoded frontend passwords.
- GitHub Pages hosts the static files and deploys from the `main` branch.

### 📄 License

[MIT License](https://opensource.org/licenses/MIT)
