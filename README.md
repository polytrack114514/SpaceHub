# SpaceHub 星枢

> 探索浩瀚宇宙，分享星辰大海，一起畅聊太空奥秘。

SpaceHub 星枢 是一个以太空探索为主题的社区平台，融合了**社区互动**与**实时太空数据可视化**两大板块。前端为纯静态页面（原生 HTML/CSS/JavaScript），托管于 GitHub Pages；后端基于 Supabase（PostgreSQL + Edge Functions）。

**线上地址**：<https://polytrack114514.github.io/SpaceHub/>

---

## ✨ 功能特性

### 社区板块

| 标签 | 说明 |
| --- | --- |
| 🔥 热门 | 按热度排序的帖子流 |
| 🆕 最新 | 按时间排序的帖子流 |
| 🤖 AI 助手 | 星际助手对话，回答太空相关提问 |
| 🚀 火箭发射 | 全球发射任务时间表、倒计时与发射结果（成功 / 部分成功 / 失败） |
| 🛰️ 太空数据中心 | 实时太空数据可视化（见下） |

社区功能还包括：发帖 / 编辑 / 删除、评论与 @提及、点赞、收藏、置顶、搜索、消息通知、用户注册与登录、管理员后台（禁言、站点设置等）。

### 🛰️ 太空数据中心

**基础面板**

- **ISS 追踪** — 空间站实时经纬度、高度、速度
- **月相** — 月相、月龄与照明百分比
- **近地小行星** — NASA 近地天体数据
- **ISS 乘组** — 当前在轨航天员名单
- **流星雨** — 流星雨日历与观测窗口
- **日食月食** — 日月食预报
- **🚀 发射任务** — 发射任务可视化
- **🌐 3D 太阳系** — NASA Eyes 太阳系模拟

**增强面板**

- **🌃 今夜星空** — 基于本地天文算法推算日落 / 日出 / 天文暗夜时段、行星视位置、当季最佳观测目标，并结合 Open-Meteo 云量预报给出今夜观星条件评分
- **⏰ ISS 过境** — 基于 satellite.js SGP4 轨道推算未来多次过境，标注最大高度、方位、持续时长与目视可见性，支持过境提醒
- **☀️ 空间天气** — NOAA SWPC 实时数据：太阳风速度、IMF Bz、X 射线耀斑、F10.7 射电通量、Kp 指数（过去 24h 观测 + 未来 24h 预报）与极光可见纬度带
- **🛰️ 卫星编队** — 预置多颗典型航天器（ISS、天和核心舱、哈勃、Terra、NOAA-20、Landsat 9、Sentinel-2A、GPS 等），通过 TLE + SGP4 实时推算位置并每 5 秒刷新

---

## 🧱 技术栈

- **前端**：原生 HTML / CSS / JavaScript（无构建步骤），[supabase-js](https://github.com/supabase/supabase-js) CDN 引入
- **后端**：Supabase（PostgreSQL + Row Level Security + Edge Functions / Deno）
- **托管**：GitHub Pages（通过 GitHub Actions 自动部署）
- **轨道计算**：[satellite.js](https://github.com/shashwatak/satellite-js)（SGP4/SDP4）

## 📡 数据来源

- NASA APOD、NASA 近地天体 API、NASA Eclipse Predictions
- The Space Devs Launch Library 2
- wheretheiss.at 实时卫星定位 API
- tle.ivanstanojevic.me（TLE 轨道根数）
- NOAA SWPC（空间天气）
- Open-Meteo（云量预报）
- 国际流星组织（IMO）

各面板底部均标注当前的数据来源。

---

## 📂 项目结构

```
SpaceHub/
├── index.html                  # 主页面（社区 + 太空数据中心）
├── sign-up.html                # 注册页
├── css/
│   └── main.css                # 全部样式
├── js/
│   ├── config.js               # 全局状态、Supabase 初始化、工具函数
│   ├── auth.js                 # 登录 / 登出 / 用户资料
│   ├── posts.js                # 帖子：加载 / 创建 / 编辑 / 删除 / 搜索 / 点赞 / 置顶
│   ├── comments.js             # 评论与 @提及
│   ├── notifications.js        # 通知系统
│   ├── launches.js             # 发射任务：时间表 / 倒计时 / 管理
│   ├── spacedata.js            # 太空数据中心（全部子面板与天文 / 轨道算法）
│   ├── admin.js                # 管理后台
│   ├── ai.js                   # AI 助手
│   ├── apod.js                 # NASA 每日天文一图
│   └── effects.js              # 星空动画、灯箱、初始化引导
└── supabase/
    ├── functions/              # Edge Functions（Deno）
    │   ├── register/           # 用户注册
    │   ├── auth-token/         # 登录后签发会话 token
    │   ├── post-write/         # 发帖 / 编辑 / 删除
    │   ├── comment-write/      # 发表评论
    │   ├── notification-write/ # 写入通知
    │   ├── launch-write/       # 发射任务增删改
    │   ├── admin-verify/       # 管理员令牌签发
    │   ├── admin-ban/          # 禁言 / 解禁
    │   ├── settings-write/     # 站点设置写入
    │   └── run-migration/      # 数据库迁移执行
    ├── migrations/             # SQL 迁移脚本
    └── config.toml             # Supabase 配置
```

---

## 🚀 本地运行

本项目为纯静态站点，无需构建。任选一种方式在本地起一个静态服务器即可：

```bash
# 方式一：Python
python3 -m http.server 8000

# 方式二：Node
npx serve .
```

然后访问 <http://localhost:8000/>。

> 直接以 `file://` 打开也能浏览大部分内容，但部分接口（CORS / Edge Function）可能受限，建议使用本地服务器。

### 后端（Supabase）开发

```bash
# 安装依赖
npm install

# 登录并关联远端项目
npx supabase login
npx supabase link --project-ref <your-project-ref>

# 部署 Edge Functions
npx supabase functions deploy <function-name>

# 应用数据库迁移
npx supabase db push
```

前端通过 `js/config.js` 中的 `SUPABASE_URL` 与匿名 key 连接后端。

---

## 🖥️ 部署

推送到 `main` 分支后，GitHub Actions 工作流 [.github/workflows/pages.yml](.github/workflows/pages.yml) 会自动将仓库内容部署到 GitHub Pages。

---

## 👤 作者

- polytrack114514
- 邮箱：polytrack1@outlook.com

---

> 我们诞生于这颗暗淡蓝点，但目光早已越过银河。
> *Born on a pale blue dot, our eyes have already pierced the bounds of the galaxy.*
