<div align="center">

# 🌌 Nuxt Community

### 小红书风格的全栈社区平台 · 博客 / 社交 / 实时通信 / 媒体管理

</div>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/Nuxt-3.17-00DC82?logo=nuxtdotjs&logoColor=white" alt="Nuxt 3"/>
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white" alt="Vue 3"/>
  <img src="https://img.shields.io/badge/Ant_Design_Vue-4.2-0170FE?logo=antdesign&logoColor=white" alt="Ant Design Vue"/>
  <img src="https://img.shields.io/badge/Pinia-3.x-FFD859?logo=pinia&logoColor=black" alt="Pinia"/>
  <img src="https://img.shields.io/badge/WebSocket-Realtime-010101?logo=websocket&logoColor=white" alt="WebSocket"/>
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License"/>
</p>

---

<br>

## ✨ 项目简介

> 一个基于 **Nuxt 3** 全栈框架构建的现代社区平台，融合了小红书的内容消费体验、微博的社交关系链和微信的实时私信能力。

项目采用 **玻璃拟态（Glassmorphism）** 设计语言，以半透明毛玻璃面板悬浮于动态粒子背景之上。所有数据通过 JSON 文件持久化存储，无需数据库即可完整运行——开箱即用，零配置启动。

<br>

<table>
<tr>
<td width="50%" align="center">

**🎨 设计系统**

全局 Design Token 体系 · 玻璃材质 · 亮/暗双主题 · 入场动效 · 响应式瀑布流

</td>
<td width="50%" align="center">

**⚡ 实时通信**

WebSocket 双向通道 · 在线状态检测 · 离线消息队列 · 自动重连 + 心跳

</td>
</tr>
<tr>
<td width="50%" align="center">

**📦 媒体管理**

图片 + 视频持久存储 · 结构化元信息 · 零依赖尺寸读取 · Range 流式传输

</td>
<td width="50%" align="center">

**🔐 安全认证**

HMAC 签名 Cookie · scrypt 密码哈希 · 无状态鉴权 · RBAC 角色控制

</td>
</tr>
</table>

<br>

---

## 🚀 功能总览

<br>

### 📝 社区博客系统

| 功能 | 描述 |
|:---:|:---|
| 📌 **发帖** | 富文本正文 · 多标签 · 最多 9 张配图 + 4 个视频混排上传 |
| 🔥 **瀑布流** | 小红书风格 masonry 布局 · 最新/热门/关注三栏切换 |
| 🖼️ **图片画廊** | 详情弹窗内多图轮播 · 缩略图导航 · 全屏预览 |
| 🎬 **视频播放** | 原生 `<video>` 播放器 · 流式 Range 加载 · 缩略图预览 |
| ❤️ **点赞** | 实时切换 · 防抖更新 · 计数同步 |
| 🔖 **收藏夹** | 多收藏夹管理 · 帖子归类 · 独立页面浏览 |
| 💬 **评论系统** | 多级回复树 · 评论点赞 · 级联删除 · 实时计数 |

<br>

### 👥 社交关系

| 功能 | 描述 |
|:---:|:---|
| 🤝 **关注/粉丝** | 一键关注 · 粉丝/关注列表 · 关注动态 Feed |
| 👤 **用户主页** | 公开资料 · 自定义头像 + 背景横幅 · 统计面板（帖子/粉丝/获赞/收藏） |
| 📨 **实时私信** | WebSocket 即时推送 · 离线消息队列暂存 · 上线自动消费 |
| 🔔 **通知中心** | 未读消息计数 · 关注通知 · 实时铃铛提醒 |
| ⚙️ **个人设置** | 头像上传 · 背景图设置 · 简介编辑 · 即时预览 |

<br>

### 🛠️ 后台管理

| 功能 | 描述 |
|:---:|:---|
| 📊 **仪表盘** | 数据统计 · 内容管理 · 用户管理 |
| 📂 **分类管理** | 分组/标签/内容 CRUD · 拖拽排序 |
| ⭐ **评分系统** | 1-5 星评分 · 应用推荐 |

<br>

---

## 🏗️ 技术架构

```
my-nuxt-demo/
├── 📂 pages/                  # 页面路由（文件即路由）
│   ├── index.vue             #   落地页（生成式 Hero + 粒子动画）
│   ├── community.vue         #   社区瀑布流
│   ├── collections.vue       #   收藏夹
│   ├── settings.vue          #   个人信息设置
│   ├── user/[id].vue         #   用户公开主页
│   ├── application.vue       #   应用推荐
│   ├── admin.vue             #   后台管理（admin only）
│   └── art.vue               #   艺术展示
│
├── 📂 components/             # Vue 组件
│   ├── PostCard.vue          #   瀑布流卡片（图片/视频封面）
│   ├── PostDetailModal.vue   #   详情弹窗（画廊 + 评论 + 操作）
│   ├── PostEditorModal.vue   #   发帖编辑器（混合媒体上传）
│   ├── ChatPanel.vue         #   浮动私信面板
│   ├── NotificationBell.vue  #   通知铃铛
│   ├── FollowButton.vue      #   关注按钮
│   ├── Header.vue            #   全局导航栏
│   ├── Sider.vue             #   侧边导航
│   ├── AuthModal.vue         #   登录/注册弹窗
│   └── ContentDetail.vue     #   应用详情
│
├── 📂 composables/           # Vue Composables（状态逻辑）
│   ├── useAuth.ts            #   认证状态 + 用户信息
│   ├── usePosts.ts           #   帖子 CRUD
│   ├── useCollections.ts     #   收藏夹管理
│   ├── useMessages.ts        #   私信状态
│   ├── useFollows.ts         #   关注关系
│   ├── useRealtime.ts        #   WebSocket 客户端
│   ├── useAvatar.ts          #   头像样式
│   └── useTheme.ts           #   主题切换
│
├── 📂 server/                # Nitro 服务端
│   ├── api/                  #   REST API（40+ 端点）
│   │   ├── auth/             #     认证（登录/注册/登出/me）
│   │   ├── posts/            #     帖子 CRUD + 点赞
│   │   ├── comments/         #     评论 CRUD + 点赞
│   │   ├── collections/      #     收藏夹 CRUD
│   │   ├── follows/          #     关注/取关/列表
│   │   ├── messages/         #     私信发送/会话/已读
│   │   ├── users/            #     用户资料 + 统计
│   │   ├── feed/             #     关注动态
│   │   ├── upload.post.ts    #     媒体上传（图片+视频）
│   │   ├── uploads/[file]    #     静态媒体服务（Range 支持）
│   │   └── images/           #     元信息查询
│   ├── routes/
│   │   └── _ws.ts            #   WebSocket 入口
│   ├── utils/
│   │   ├── db.ts             #   JSON 数据层（原子写入 + 互斥锁）
│   │   ├── auth.ts           #   HMAC Cookie + scrypt 密码
│   │   ├── realtime.ts       #   在线注册表 + 消息投递
│   │   └── imageMeta.ts      #   零依赖图片尺寸读取
│   └── plugins/
│       └── seed-admin.ts     #   启动时种子管理员
│
├── 📂 data/                  # JSON 持久化存储
│   ├── users.json            #   用户数据
│   ├── posts.json            #   帖子数据
│   ├── comments.json         #   评论数据
│   ├── collections.json      #   收藏夹
│   ├── follows.json          #   关注关系
│   ├── messages.json         #   私信记录
│   ├── images.json           #   媒体元信息
│   ├── content.json          #   应用推荐内容
│   ├── tags.json             #   标签定义
│   ├── menu.json             #   分类导航
│   ├── ratings.json          #   评分记录
│   └── uploads/              #   媒体文件存储
│
├── 📂 assets/css/            # 全局设计系统
│   └── main.css              #   Design Token + 玻璃材质 + 动效
│
├── 📂 stores/                # Pinia 状态仓库
│   ├── contentStore.ts       #   应用内容
│   └── menuStore.ts          #   导航菜单
│
├── nuxt.config.ts            # Nuxt 配置
└── package.json
```

<br>

---

## 🔧 核心技术实现

<br>

<details>
<summary><b>🔐 无状态认证（HMAC Cookie + scrypt）</b></summary>

<br>

```typescript
// 签名：payload(base64url) + HMAC-SHA256 签名
const token = `${base64url(payload)}.${hmacSig}`

// 验证：常量时间比较签名 + 过期检查
function verifyToken(token: string): { uid: string } | null {
  const [b64, sig] = token.split('.')
  const expected = createHmac('sha256', secret).update(b64).digest('base64url')
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  // ... 过期检查
}
```

- **Cookie**: `httpOnly` + `sameSite: lax` + 30 天有效期
- **密码**: `scrypt` 哈希 + 随机盐（`salt:hash` 格式存储）
- **角色**: `admin` / `user`，后台管理仅 admin 可见

</details>

<br>

<details>
<summary><b>📦 JSON 数据层（原子写入 + 互斥锁）</b></summary>

<br>

```typescript
// 事务性更新：lock → read → mutate → write
async function updateData<T, R>(kind: DataKind, fn: (items: T[]) => R): Promise<R> {
  return withLock(kind, async () => {
    const items = await readJson<T[]>(fileFor(kind))
    const result = await fn(items)        // 原地修改
    await writeJson(fileFor(kind), items) // 原子写入
    return result
  })
}
```

- **原子写入**: 临时文件 → rename（同文件系统原子操作）
- **互斥锁**: 每资源独立 `Promise` 链，序列化并发写入
- **容错**: 只读文件系统降级为 507 而非崩溃
- **向后兼容**: `ensureIds` 自动回填缺失字段

</details>

<br>

<details>
<summary><b>⚡ WebSocket 实时通信</b></summary>

<br>

```
浏览器 ──ws://host/_ws──→ Nitro crossws 适配器
                              │
                    ┌─────────┴──────────┐
                    │  open(peer)         │
                    │  Cookie 认证        │
                    │  注册在线           │
                    │  消费离线队列       │
                    └─────────┬──────────┘
                              │
                    ┌─────────┴──────────┐
                    │  内存注册表          │
                    │  Map<userId, Set>   │
                    └────────────────────┘
```

- **认证**: WS 握手时浏览器自动携带 Cookie，`open` 钩子读取验证
- **离线队列**: 消息存储 `delivered: false`，上线时 `drainPendingMessages` 批量推送
- **多端支持**: 同一用户可多连接，消息广播到所有活跃端
- **心跳**: 25 秒 ping/pong，断线 3 秒自动重连

</details>

<br>

<details>
<summary><b>🎬 媒体存储（图片 + 视频）</b></summary>

<br>

```typescript
// 结构化元信息
interface ImageMeta {
  id: string
  filename: string          // 磁盘文件名
  originalName: string      // 原始文件名
  mimeType: string          // image/jpeg, video/mp4, ...
  kind: 'image' | 'video'   // 媒体类型
  size: number              // 字节数
  width: number             // 像素宽
  height: number            // 像素高
  duration: number          // 视频时长（秒）
  userId: string            // 上传者
  purpose: 'post' | 'avatar' | 'background' | 'other'
  url: string               // 公开访问路径
  createdAt: number
}
```

- **持久化**: 文件存储于 `data/uploads/`，元信息记录于 `data/images.json`
- **零依赖尺寸读取**: 直接解析 PNG/JPEG/GIF/WEBP/BMP 二进制头部
- **视频流式传输**: HTTP Range 请求支持（206 Partial Content），可拖拽跳转
- **用途标记**: `purpose` 字段区分帖子配图/头像/背景，便于管理

</details>

<br>

---

## 🏁 快速开始

<br>

### 环境要求

| 依赖 | 最低版本 |
|:---:|:---:|
| Node.js | `>= 18.0.0` |
| npm / pnpm / yarn | 任一包管理器 |

<br>

### 安装与启动

```bash
# 1️⃣ 克隆仓库
git clone git@github.com:kingdol666/nuxtProj.git
cd nuxtProj

# 2️⃣ 安装依赖
npm install        # 或 pnpm install / yarn install

# 3️⃣ 启动开发服务器
npm run dev        # 或 pnpm dev / yarn dev
```

<br>

> 🎉 启动成功后访问 **http://localhost:3000**

<br>

### 默认账号

| 角色 | 用户名 | 密码 | 权限 |
|:---:|:---:|:---:|:---|
| 🔑 管理员 | `admin` | `admin23` | 全部功能 + 后台管理 |
| 👤 普通用户 | 注册获取 | 注册设置 | 社区全部功能（无后台） |

> 管理员账号在首次启动时自动种子创建（幂等，不覆盖已有）

<br>

---

## 📖 使用指南

<br>

<table>
<tr>
<td width="33%" align="center" valign="top">

**📝 发布笔记**

点击「发布」按钮 → 上传图片/视频 → 填写标题正文 → 添加标签 → 发布

支持最多 9 个文件混合上传（图片 ≤8MB / 视频 ≤100MB）

</td>
<td width="33%" align="center" valign="top">

**👤 个人主页**

点击任意用户头像/昵称 → 查看公开主页 → 关注/私信

主页展示：头像、背景、简介、统计、笔记网格

</td>
<td width="33%" align="center" valign="top">

**📨 私信聊天**

点击通知铃铛或私信按钮 → 打开聊天面板 → 实时收发消息

离线消息自动暂存，上线后即时推送

</td>
</tr>
</table>

<br>

---

## 🔌 生产部署

<br>

```bash
# 构建生产版本
npm run build

# 本地预览生产构建
npm run preview

# 生成静态站点（SSG）
npm run generate
```

<br>

### 环境变量

| 变量 | 说明 | 默认值 |
|:---|:---|:---:|
| `NUXT_DATA_DIR` | 数据存储目录（需可写） | `<cwd>/data` |
| `NUXT_AUTH_SECRET` | HMAC 签名密钥（**生产必须修改**） | 内置开发密钥 |

<br>

> ⚠️ **生产环境务必设置 `NUXT_AUTH_SECRET`**，否则 Cookie 签名可被伪造。

<br>

---

## 🎨 设计系统

<br>

项目使用统一的 **Design Token** 体系，定义于 `assets/css/main.css`：

```
┌─────────────────────────────────────────────────┐
│  🎨 Design Tokens                               │
├──────────────────┬──────────────────────────────┤
│  主色 (Indigo)    │  --accent: #6366f1          │
│  字体              │  Inter + Noto Sans SC       │
│  圆角              │  --radius-sm → --radius-xl   │
│  阴影              │  --shadow-xs → --shadow-lg   │
│  玻璃材质          │  --glass-bg + backdrop-blur  │
│  动效              │  --ease-spring + --dur-*     │
├──────────────────┼──────────────────────────────┤
│  🌙 暗色模式       │  html.dark 自动切换全部 token │
│  📱 响应式          │  masonry 5→4→3→2 列自适应    │
│  ♿ 无障碍          │  focus-visible + aria 标签   │
│  🎭 动画            │  fade-up / scale-in / 路由过渡│
└──────────────────┴──────────────────────────────┘
```

<br>

---

## 📊 API 端点一览

<br>

| 模块 | 方法 | 路径 | 说明 |
|:---:|:---:|:---|:---|
| **认证** | POST | `/api/auth/login` | 登录 |
| | POST | `/api/auth/register` | 注册 |
| | POST | `/api/auth/logout` | 登出 |
| | GET | `/api/auth/me` | 当前用户 |
| **帖子** | GET | `/api/posts` | 列表（tag/keyword/userId 过滤） |
| | POST | `/api/posts` | 创建（images + videos） |
| | GET | `/api/posts/[id]` | 详情 |
| | DELETE | `/api/posts/[id]` | 删除 |
| | POST | `/api/posts/[id]/like` | 点赞切换 |
| **评论** | GET | `/api/comments` | 列表（targetType 过滤） |
| | POST | `/api/comments` | 创建（含回复） |
| | DELETE | `/api/comments/[id]` | 删除（级联） |
| | POST | `/api/comments/[id]/like` | 点赞 |
| **收藏** | GET | `/api/collections` | 用户收藏夹列表 |
| | POST | `/api/collections` | 创建收藏夹 |
| | DELETE | `/api/collections/[id]` | 删除收藏夹 |
| | POST | `/api/collections/[id]/items` | 收藏/取消帖子 |
| **关注** | GET | `/api/follows` | 粉丝/关注列表 |
| | POST | `/api/follows` | 关注/取关 |
| **私信** | GET | `/api/messages` | 会话列表/单会话 |
| | POST | `/api/messages` | 发送消息 |
| | POST | `/api/messages/read` | 标记已读 |
| | GET | `/api/messages/unread` | 未读计数 |
| **用户** | GET | `/api/users/[id]/profile` | 公开资料 + 统计 |
| | PUT | `/api/users/profile` | 更新个人资料 |
| **媒体** | POST | `/api/upload` | 上传图片/视频 |
| | GET | `/api/uploads/[file]` | 媒体服务（Range） |
| | GET | `/api/images` | 元信息列表 |
| **Feed** | GET | `/api/feed/following` | 关注动态 |
| **WebSocket** | WS | `/_ws` | 实时通信（私信/通知） |

<br>

---

## 📜 许可证

MIT License © 2025

<br>

---

<div align="center">

**⭐ 如果这个项目对你有帮助，欢迎 Star**

<br>

<sub>Built with ❤️ using Nuxt 3 · Vue 3 · Ant Design Vue · Pinia · WebSocket</sub>

</div>
