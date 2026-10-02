<div align="center">

# 🌌 SpaceHub 星枢

### SpaceHub 星枢 · Explore the Universe Together

[![GitHub Stars](https://img.shields.io/github/stars/polytrack114514/Space-Exploration-Post?style=flat-square&logo=github&color=yellow)](https://github.com/polytrack114514/Space-Exploration-Post/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/polytrack114514/Space-Exploration-Post?style=flat-square&logo=github&color=blue)](https://github.com/polytrack114514/Space-Exploration-Post/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/polytrack114514/Space-Exploration-Post?style=flat-square&logo=github&color=red)](https://github.com/polytrack114514/Space-Exploration-Post/issues)
[![Last Commit](https://img.shields.io/github/last-commit/polytrack114514/Space-Exploration-Post?style=flat-square&logo=git&color=green)](https://github.com/polytrack114514/Space-Exploration-Post/commits)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square&logo=opensourceinitiative)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Online-brightgreen?style=flat-square&logo=githubpages)](https://polytrack114514.github.io/Space-Exploration-Post/)
[![Language](https://img.shields.io/badge/Language-HTML%20%7C%20CSS%20%7C%20JS-orange?style=flat-square&logo=html5)](https://github.com/polytrack114514/Space-Exploration-Post)
[![Supabase](https://img.shields.io/badge/Database-Supabase-green?style=flat-square&logo=supabase)](https://supabase.com/)

**[🌐 在线预览 / Live Demo](https://polytrack114514.github.io/SpaceHub/)** ·
**[📦 仓库 / Repository](https://github.com/polytrack114514/Space-Exploration-Post)**

🌐 **语言 / Language:** [简体中文](#-简体中文) · [English](#-english)

</div>

---

## 🇨🇳 简体中文

### 📖 项目简介

**SpaceHub 星枢** 是一个以太空探索为主题的社区平台，集帖子发布、评论互动、用户关注、火箭发射追踪、🛰️ 太空数据中心（ISS 实时定位 / 行星位置 / 月相 / 近地小行星 / ISS 乘组 / 流星雨 / 日食月食）、NASA 每日天文一图、AI 太空助手于一体。采用深空配色与玻璃态设计，全面适配手机/平板/桌面。全部代码整合在单个 `index.html` 文件中，部署简单。

### 📁 项目结构

```
SpaceHub/
├── index.html          # 全部代码（HTML + CSS + JavaScript 单文件）
├── supabase_setup.sql  # Supabase 数据库初始化脚本
└── README.md           # 项目说明文档
```

### ✨ 核心功能（15 大功能）

| 功能 | 说明 |
|------|------|
| 📝 帖子系统 | 图文发布/编辑/删除/置顶，热门/最新/关注/火箭发射 四标签切换 |
| 🔍 搜索帖子 | 按标题、内容、作者实时搜索 |
| 💬 评论互动 | 需登录后发表，支持 @提及通知 |
| 📌 置顶帖子 | 管理员可置顶重要帖子（Edge Function 验证密码）|
| ❤️ 点赞 | 一键点赞（需登录），自动通知帖子作者 |
| 👤 个人主页 | 展示用户头像/帖子/关注/粉丝/获赞，点击作者名可跳转 |
| 👥 关注系统 | 关注/取消关注，用户主页显示关注数和粉丝数 |
| 🔔 消息通知 | 点赞、评论、关注、@提及 实时通知 |
| 🎬 视频嵌入 | 自动识别 YouTube 和 B站链接，嵌入视频播放器（autoplay 已禁用）|
| 🚀 发射时间表 | 实时倒计时精确到秒 |
| 🏁 已发射归档 | 自动归档，保留最近 15 条 |
| 📊 发射结果 | 官方账号可标记发射结果（成功/部分成功/失败）|
| 🏛️ 官方账号 | NASA/CNSA/SpaceX/其他火箭发射 专属徽标与权限 |
| 🛰️ 太空数据中心 | 8 合 1 多功能航天数据面板（详见下方）|
| 🤖 AI 太空助手 | agnes-2.5-flash 模型，通过 Supabase Edge Function 代理，专注太空/航天话题 |
| 🌌 NASA APOD | 每日天文一图，点击可放大查看（含缓存回退）|
| 🟢 在线用户 | 实时显示在线探索者数量 |
| 🖼️ 图片放大 | 点击帖子图片弹出大图灯箱浏览 |
| 🛡️ 管理员后台 | 用户管理（查看/禁言）、站点设置（注册开关）|
| 📱 响应式布局 | 适配手机（480px）、平板（768px/1024px）、桌面 |
| ✨ 视觉设计 | 深空配色（电蓝+紫罗兰）、玻璃态/霓虹效果 |
| 🎬 动画增强 | 卡片进场动画、hover 微交互、骨架屏加载、扫描线效果 |

### 🛰️ 太空数据中心（8 个标签页）

| 面板 | 功能 | 数据来源 |
|------|------|---------|
| ISS 追踪 | 国际空间站实时位置、速度、高度、地图轨迹 | wheretheiss.at API |
| 行星位置 | 8 大行星 3D 轨道位置可视化（含天王星、海王星、轨道倾角） | 开普勒轨道力学计算 |
| 月相 | 当前月相 SVG 图、照明百分比、月龄、满月/新月预测 | 纯 JS 天文计算 |
| 近地小行星 | 今日接近地球的小行星列表（距离/直径/速度/危险等级） | NASA NeoWS API（本地缓存）|
| ISS 乘组 | 当前在站宇航员名单及所属飞船 | 静态数据 |
| 流星雨日历 | 全年 10 大流星雨，峰值日期、ZHR、活跃期、辐射点 | 静态数据集 |
| 日食月食 | 2026-2028 年日食月食预报，食分、可见区域、倒计时 | 静态数据集 |

### 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| HTML5 | 页面结构 |
| CSS3 | 样式设计（玻璃态、霓虹、动画、响应式） |
| JavaScript | 前端逻辑、Supabase 交互、实时倒计时、开普勒轨道计算 |
| Supabase | 云端数据库（PostgreSQL）+ 用户认证 + Edge Functions |
| Supabase Edge Functions | AI 助手 API 代理 + 管理员密码验证（保护敏感信息）|
| GitHub Pages | 静态网站托管 |
| Google Fonts | Exo 2 / Michroma |
| wheretheiss.at API | ISS 实时位置数据 |
| NASA APOD API | 每日天文一图 |
| NASA NeoWS API | 近地小行星数据 |
| agnes-ai API | AI 太空助手（agnes-2.5-flash 模型） |

### 📊 数据库结构

| 表名 | 主要字段 |
|------|---------|
| posts | id, title, content, author, avatar, image, source_url, time, likes, comments, pinned |
| users | name, password, follows, source_url, last_active, banned |
| launches | id, rocket, agency, date, location, mission, image, description, status, result |
| notifications | id, target_user, from_user, type, post_id, content, is_read, created_at |
| site_settings | id, key, value |

### 🔒 安全特性

- **API Key 保护**：AI 助手 API Key 存储于 Supabase Edge Function，前端仅暴露可公开的 publishable key
- **管理员密码验证**：管理员操作通过 Edge Function 服务端验证，前端不硬编码密码
- **注册开关**：管理员可在后台开启/关闭注册功能
- **XSS 防护**：用户输入内容通过 `escapeHtml()` 转义输出
- **错误处理**：所有外部 API 调用均包含响应状态检查

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
| 圆角 | 卡片 16px / 弹窗 24px |
| 动效 | 进场动画 / hover 变换 / 骨架屏 / 扫描线 |

### 📸 功能预览

```
┌──────────────────────────────────────────────┐
│         🌌 SpaceHub 星枢                    │
│        (发光文字效果)                          │
├──────────────────────────────────────────────┤
│  🔥 热门  🆕 最新  👥 关注  🤖 AI助手         │
│  ┌──────────────────────────────────────────┐ │
│  │ 👤 NASA  🏛️  2小时前             ⋯     │ │
│  │ NASA 发现新行星                            │ │
│  │ [配图]                                    │ │
│  │ ❤️ 42   💬 8                              │ │
│  └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│  🛰️ 太空数据中心 (扫描线动效)                  │
│  [ISS追踪][行星位置][月相][近地小行星]         │
│  [ISS乘组][流星雨][日食月食]                  │
│  🟢 在线: 12 人  🌌 NASA APOD               │
└──────────────────────────────────────────────┘
```

### 📄 许可证

[MIT License](https://opensource.org/licenses/MIT)

---

## 🇬🇧 English

### 📖 About

**SpaceHub** is a space-themed community platform integrating post publishing, comments, user following, rocket launch tracking, 🛰️ Space Data Center (ISS tracking / planet positions / moon phase / NEO asteroids / ISS crew / meteor showers / eclipses), NASA APOD, and an AI space assistant. Features a deep-space color palette with glassmorphism design, fully responsive for mobile/tablet/desktop. All code is combined in a single `index.html` file for easy deployment.

### 📁 Project Structure

```
SpaceHub/
├── index.html          # All code (HTML + CSS + JavaScript in one file)
├── supabase_setup.sql  # Supabase database initialization script
└── README.md           # Project documentation
```

### ✨ Key Features (15 Major Features)

| Feature | Description |
|---------|-------------|
| 📝 Posts | Image/text post publish/edit/delete/pin, Hot/New/Following/Launches tabs |
| 🔍 Search | Real-time search by title, content, author |
| 💬 Comments | Login required, @mention notifications |
| 📌 Pin | Admins can pin posts (Edge Function password verification) |
| ❤️ Likes | One-click like (login required), auto-notification to author |
| 👤 Profile | User avatar/posts/following/followers/likes, click author to view |
| 👥 Follow | Follow/unfollow users, profile shows following/follower counts |
| 🔔 Notifications | Real-time notifications for likes, comments, follows, mentions |
| 🎬 Video Embed | Auto-detects YouTube and Bilibili links (autoplay disabled) |
| 🚀 Launch Schedule | Real-time countdown to the second |
| 🏁 Archive | Auto-archived, keeps latest 15 |
| 📊 Launch Results | Official accounts can mark results (success/partial/failure) |
| 🏛️ Official Accounts | NASA/CNSA/SpaceX badges & permissions |
| 🛰️ Space Data Center | 8-in-1 multifunction space data panel (see below) |
| 🤖 AI Assistant | agnes-2.5-flash model via Supabase Edge Function proxy, space/astronautics topics |
| 🌌 NASA APOD | Astronomy Picture of the Day with lightbox view (cached fallback) |
| 🟢 Online Users | Real-time online explorer count |
| 🖼️ Image Lightbox | Click post images to enlarge in lightbox |
| 🛡️ Admin Dashboard | User management (view/ban), site settings (registration toggle) |
| 📱 Responsive | Mobile (480px) / Tablet (768px/1024px) / Desktop |
| ✨ Visual Design | Deep-space palette (electric blue + violet), glassmorphism/neon effects |
| 🎬 Animations | Card entrance, hover micro-interactions, skeleton loading, scanline effects |

### 🛰️ Space Data Center (8 Tabs)

| Panel | Feature | Data Source |
|-------|---------|-------------|
| ISS Tracking | Real-time ISS position, velocity, altitude, map trajectory | wheretheiss.at API |
| Planet Positions | 8 planets 3D orbit visualization (incl. Uranus, Neptune, inclination) | Keplerian orbital mechanics |
| Moon Phase | Current moon phase SVG, illumination %, age, full/new moon prediction | Pure JS astronomy calc |
| Near-Earth Asteroids | Today's NEO list (distance/diameter/velocity/hazard) | NASA NeoWS API (local cache) |
| ISS Crew | Current in-station astronauts and spacecraft | Static data |
| Meteor Showers | Annual 10 major meteor showers, peak date, ZHR, radiant, period | Static dataset |
| Eclipses | 2026-2028 solar/lunar eclipse predictions, magnitude, visibility, countdown | Static dataset |

### 🛠️ Tech Stack

| Tech | Purpose |
|------|---------|
| HTML5 | Page structure |
| CSS3 | Styling (glassmorphism, neon, animations, responsive) |
| JavaScript | Logic, Supabase interaction, countdown, Keplerian orbital calculations |
| Supabase | Cloud database (PostgreSQL) + Authentication + Edge Functions |
| Supabase Edge Functions | AI assistant proxy + admin password verification (protects secrets) |
| GitHub Pages | Static hosting |
| Google Fonts | Exo 2 / Michroma |
| wheretheiss.at API | ISS real-time position data |
| NASA APOD API | Astronomy Picture of the Day |
| NASA NeoWS API | Near-Earth asteroid data |
| agnes-ai API | AI space assistant (agnes-2.5-flash model) |

### 📊 Database Schema

| Table | Key Fields |
|-------|-----------|
| posts | id, title, content, author, avatar, image, source_url, time, likes, comments, pinned |
| users | name, password, follows, source_url, last_active, banned |
| launches | id, rocket, agency, date, location, mission, image, description, status, result |
| notifications | id, target_user, from_user, type, post_id, content, is_read, created_at |
| site_settings | id, key, value |

### 🔒 Security Features

- **API Key Protection**: AI assistant API key stored in Supabase Edge Function, only public publishable key exposed in frontend
- **Admin Password Verification**: Admin actions verified server-side via Edge Function, no hardcoded passwords in frontend
- **Registration Toggle**: Admins can enable/disable registration from the dashboard
- **XSS Protection**: User-generated content escaped via `escapeHtml()` before rendering
- **Error Handling**: All external API calls include response status checks

### 🎨 Design System

| Property | Value |
|----------|-------|
| Primary | Electric Blue `#5b8fff` |
| Secondary | Violet `#b558ff` |
| Neon Cyan | `#00e8ff` |
| Neon Magenta | `#ff3d7f` |
| Background | Deep Space `#060814` |
| Surface | `rgba(14, 18, 36, 0.75)` |
| Fonts | Exo 2 (body) / Michroma (labels) |
| Radius | Cards 16px / Modals 24px |
| Animations | Entrance / Hover transforms / Skeleton / Scanline |

### 📸 Preview

```
┌──────────────────────────────────────────────┐
│           🌌 SpaceHub 星枢                   │
│        (glowing text effect)                  │
├──────────────────────────────────────────────┤
│  🔥 Hot  🆕 New  👥 Following  🤖 AI         │
│  ┌──────────────────────────────────────────┐ │
│  │ 👤 NASA  🏛️  2h ago                 ⋯  │ │
│  │ NASA Discovers New Planet                  │ │
│  │ [Image]                                    │ │
│  │ ❤️ 42   💬 8                              │ │
│  └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│  🛰️ Space Data Center (scanline effect)       │
│  [ISS][Moon][Asteroids]              │
│  [Crew][Meteors][Eclipses]                 │
│  🟢 Online: 12  🌌 NASA APOD                 │
└──────────────────────────────────────────────┘
```

### 📄 页面底部信息

网站底部包含黑底页脚，内容如下（每行一项）：

| 内容 | 说明 |
|------|------|
| 页面最后更新时间 | 显示最近更新日期 |
| 联系作者邮箱 | polytrack1@outlook.com |
| 中文标语 | 我们诞生于这颗暗淡蓝点，但目光早已越过银河。 |
| 英文标语 | Born on a pale blue dot, our eyes have already pierced the bounds of the galaxy. |
| 版权声明 | © 2026 SpaceHub. |

### 📄 License

[MIT License](https://opensource.org/licenses/MIT)
