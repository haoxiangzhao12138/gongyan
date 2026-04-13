# 共研 GongYan — 完整实现计划

## 一、项目概述

**项目名称**：共研（GongYan）  
**定位**：面向科研小团体的私密互助平台（邀请制）  
**形态**：PWA 响应式网站，移动端优先，支持添加到主屏幕  
**用户规模**：初期 20-50 人，上限 200 人左右  
**核心理念**：让圈子里的研究生互相帮助，提升每个人的科研影响力

---

## 二、技术栈

| 层级 | 选型 | 理由 |
|------|------|------|
| 前端 | React 18 + TypeScript + Tailwind CSS | 生态成熟，组件化开发效率高 |
| 路由 | React Router v6 | SPA 路由管理 |
| 状态管理 | Zustand | 轻量，适合中小型项目 |
| 后端 | Supabase（BaaS） | 自带 Auth、PostgreSQL、实时订阅、Storage，开发速度极快 |
| 部署 | MacBook 本地运行前端 + Cloudflare Tunnel 内网穿透 + Supabase Cloud（后端） | 零成本，数据安全在云端 |
| 消息推送 | 企业微信群 Webhook + Resend 邮件 | 群聊实时通知 + 邮件正式通知双通道 |
| 邮件服务 | Resend（免费 3000 封/月） | 注册审批通知、Deadline 提醒、新论文通知等 |
| 论文数据 | Semantic Scholar API | 免费，数据质量好，支持按 author ID 批量拉取 |
| PWA | Vite PWA Plugin | 离线缓存 + 安装提示 |

---

## 三、数据库设计（Supabase PostgreSQL）

### 3.1 用户表 `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,          -- 用户名
  display_name TEXT NOT NULL,             -- 显示昵称
  avatar_url TEXT,                        -- 头像
  bio TEXT,                               -- 一句话简介
  research_directions TEXT[],             -- 研究方向标签数组，如 ['NLP', 'LLM', 'RLHF']
  institution TEXT,                       -- 所属机构
  google_scholar_id TEXT,                 -- Google Scholar ID（选填）
  semantic_scholar_id TEXT,               -- Semantic Scholar ID（选填）
  github_username TEXT,                   -- GitHub 用户名
  huggingface_username TEXT,              -- HuggingFace 用户名
  twitter_handle TEXT,                    -- Twitter/X 账号
  personal_website TEXT,                  -- 个人主页
  contribution_score INT DEFAULT 0,       -- 贡献积分
  badge_level INT DEFAULT 1,             -- 当前等级（1-5，根据积分自动计算）
  pinned_announcement TEXT,              -- 置顶公告（Lv.4+ 可用）
  pinned_paper_ids UUID[],              -- 置顶论文 ID（Lv.4+ 可用，最多 2 篇）
  thanks_received_count INT DEFAULT 0,   -- 收到的感谢次数
  invited_by UUID REFERENCES profiles(id),-- 邀请人
  invite_code TEXT UNIQUE,                -- 该用户的邀请码
  approval_status TEXT DEFAULT 'pending', -- 审批状态：'pending' | 'approved' | 'rejected'
  approved_at TIMESTAMPTZ,               -- 审批时间
  rejection_reason TEXT,                  -- 拒绝原因（选填）
  is_admin BOOLEAN DEFAULT FALSE,        -- 是否管理员（你自己设为 true）
  onboarding_completed BOOLEAN DEFAULT FALSE, -- 是否已完成新用户引导
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 论文表 `papers`

```sql
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) NOT NULL,  -- 论文属于谁
  title TEXT NOT NULL,
  authors TEXT[] NOT NULL,                          -- 作者列表
  abstract TEXT,
  venue TEXT,                                       -- 发表会议/期刊，如 'NeurIPS 2025'
  year INT,
  research_directions TEXT[],                       -- 方向标签
  arxiv_id TEXT,                                    -- arXiv ID
  semantic_scholar_id TEXT,                         -- Semantic Scholar Paper ID
  doi TEXT,
  pdf_url TEXT,
  code_url TEXT,                                    -- GitHub 代码链接
  bibtex TEXT,                                      -- BibTeX 引用格式
  citation_count INT DEFAULT 0,                     -- 外部引用次数（从 Semantic Scholar 同步）
  internal_cite_count INT DEFAULT 0,                -- 圈内被引次数（有人从论文池复制了 BibTeX 时 +1）
  status TEXT DEFAULT 'published',                  -- published / preprint / under_review
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 全文搜索索引（英文）
CREATE INDEX papers_search_idx ON papers 
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(abstract, '')));

-- 中文搜索支持：安装 pg_trgm 扩展做模糊匹配（Supabase 已内置）
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX papers_title_trgm_idx ON papers USING GIN (title gin_trgm_ops);
CREATE INDEX papers_abstract_trgm_idx ON papers USING GIN (abstract gin_trgm_ops);
-- 中文搜索用 ILIKE 或 similarity() 而不是 to_tsvector，因为 PostgreSQL 默认不支持中文分词
-- 前端搜索查询示例：.or(`title.ilike.%${keyword}%,abstract.ilike.%${keyword}%`)
```

### 3.3 Star/Upvote 请求表 `star_requests`

```sql
CREATE TABLE star_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) NOT NULL,  -- 谁发的请求
  platform TEXT NOT NULL,                           -- 'github' | 'huggingface' | 'alphaxiv' | 'other'
  url TEXT NOT NULL,                                -- 需要 star 的链接
  title TEXT NOT NULL,                              -- 显示标题，如 "我的新 repo: xxx"
  description TEXT,                                 -- 简短说明
  target_count INT,                                -- 目标 star 数量（选填，如"希望能有 20 个 star"）
  is_active BOOLEAN DEFAULT TRUE,                   -- 是否还需要
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.4 Star 完成记录表 `star_completions`

```sql
CREATE TABLE star_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES star_requests(id) NOT NULL,
  helper_id UUID REFERENCES profiles(id) NOT NULL,     -- 谁帮忙点的
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, helper_id)                        -- 每人每个请求只能标记一次
);
```

### 3.5 互助帖子表 `help_posts`

```sql
CREATE TABLE help_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,                                 -- 帖子标题
  content TEXT NOT NULL,                               -- 详细描述（支持 Markdown）
  category TEXT NOT NULL,                              -- 类别：'star' | 'citation' | 'collaboration' | 'review' | 'compute' | 'other'
  offer_coauthorship BOOLEAN DEFAULT FALSE,            -- 是否提供挂名
  coauthorship_details TEXT,                           -- 挂名说明
  urgency TEXT DEFAULT 'normal',                       -- 'urgent' | 'normal' | 'low'
  status TEXT DEFAULT 'open',                          -- 'open' | 'in_progress' | 'completed' | 'closed'
  synced_to_wechat BOOLEAN DEFAULT FALSE,              -- 是否已同步到微信群
  deadline TIMESTAMPTZ,                                -- 截止时间（选填）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.6 互助帖子响应表 `help_responses`

```sql
CREATE TABLE help_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES help_posts(id) NOT NULL,
  responder_id UUID REFERENCES profiles(id) NOT NULL,
  message TEXT,                                        -- 回复内容
  status TEXT DEFAULT 'offered',                       -- 'offered' | 'accepted' | 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.7 投稿日历表 `deadlines`

```sql
CREATE TABLE deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_name TEXT NOT NULL,                            -- 会议/期刊名称
  venue_type TEXT NOT NULL,                            -- 'conference' | 'journal' | 'workshop'
  full_name TEXT,                                      -- 全称
  deadline_date TIMESTAMPTZ,                           -- 截稿日期（滚动投稿的期刊可为空）
  is_rolling BOOLEAN DEFAULT FALSE,                    -- 是否全年滚动接收投稿
  notification_date TIMESTAMPTZ,                       -- 出结果日期
  conference_date TIMESTAMPTZ,                         -- 会议日期
  website_url TEXT,
  ccf_rank TEXT,                                       -- CCF 等级：A / B / C / N
  core_rank TEXT,                                      -- CORE 等级
  research_directions TEXT[],                          -- 相关方向
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.8 投稿意向表 `deadline_intents`

```sql
CREATE TABLE deadline_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_id UUID REFERENCES deadlines(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  paper_title TEXT,                                    -- 打算投的论文题目
  looking_for_collaborator BOOLEAN DEFAULT FALSE,      -- 是否找合作者
  looking_for_reviewer BOOLEAN DEFAULT FALSE,          -- 是否找审稿人
  notes TEXT,
  UNIQUE(deadline_id, user_id)
);
```

### 3.9 通知表 `notifications`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,      -- 接收人
  type TEXT NOT NULL,                                  -- 'new_paper' | 'help_request' | 'star_request' | 'response' | 'deadline_reminder' | 'approval' | 'citation_intent' | 'thanks_received' | 'badge_upgrade'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                                           -- 点击跳转链接
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.10 邀请码表 `invitations`

```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                           -- 6位邀请码
  created_by UUID REFERENCES profiles(id) NOT NULL,
  used_by UUID REFERENCES profiles(id),
  is_used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,                              -- 过期时间
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.11 统一标签表 `tags`

```sql
-- 统一管理所有研究方向标签，避免"NLP"和"自然语言处理"重复
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,                           -- 标签名，如 'NLP'
  aliases TEXT[],                                      -- 别名数组，如 ['自然语言处理', 'Natural Language Processing']
  parent_id UUID REFERENCES tags(id),                  -- 父标签（支持层级，如 NLP → AI）
  usage_count INT DEFAULT 0,                           -- 使用次数（方便排序）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- profiles、papers、deadlines 中的 research_directions 改为引用 tag id
-- 关联表
CREATE TABLE profile_tags (
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, tag_id)
);

CREATE TABLE paper_tags (
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id, tag_id)
);

CREATE TABLE deadline_tags (
  deadline_id UUID REFERENCES deadlines(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (deadline_id, tag_id)
);
```

### 3.12 评论表 `comments`

```sql
-- 通用评论，可挂在互助帖子、论文等下面，支持多人讨论
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES profiles(id) NOT NULL,
  target_type TEXT NOT NULL,                           -- 'help_post' | 'paper' | 'star_request'
  target_id UUID NOT NULL,                             -- 对应的帖子/论文/请求 ID
  content TEXT NOT NULL,                               -- 评论内容（支持 Markdown）
  parent_id UUID REFERENCES comments(id),              -- 回复哪条评论（支持楼中楼）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX comments_target_idx ON comments(target_type, target_id);
```

### 3.13 用户通知偏好表 `notification_preferences`

```sql
-- 每个用户可以自定义想收哪些类型的通知、通过哪个渠道
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  email_new_paper BOOLEAN DEFAULT TRUE,                -- 新论文 → 邮件
  email_help_response BOOLEAN DEFAULT TRUE,            -- 帖子有人响应 → 邮件
  email_deadline_reminder BOOLEAN DEFAULT TRUE,        -- Deadline 提醒 → 邮件
  email_weekly_digest BOOLEAN DEFAULT TRUE,            -- 每周汇总 → 邮件
  email_approval_result BOOLEAN DEFAULT TRUE,          -- 审批结果 → 邮件（不可关闭）
  site_all BOOLEAN DEFAULT TRUE,                       -- 站内通知总开关
  wechat_help_post BOOLEAN DEFAULT TRUE,               -- 新互助帖 → 微信群（群通知由管理员控制）
  digest_day TEXT DEFAULT 'monday',                    -- 周报发送日：'monday' | 'friday'
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.14 收藏表 `bookmarks`

```sql
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  target_type TEXT NOT NULL,                           -- 'paper' | 'help_post' | 'deadline'
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);
```

### 3.15 操作日志表 `activity_log`

```sql
-- 记录关键操作，方便管理员查看平台活跃度和排查问题
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,                                -- 'register' | 'approve' | 'post_created' | 'star_completed' | 'paper_added' | ...
  target_type TEXT,
  target_id UUID,
  metadata JSONB,                                      -- 附加信息
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX activity_log_user_idx ON activity_log(user_id);
CREATE INDEX activity_log_time_idx ON activity_log(created_at DESC);
```

### 3.16 感谢表 `thanks`

```sql
-- 被帮助的人给帮助者发的公开感谢
CREATE TABLE thanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES profiles(id) NOT NULL,  -- 发感谢的人（被帮助者）
  to_user_id UUID REFERENCES profiles(id) NOT NULL,    -- 收感谢的人（帮助者）
  help_post_id UUID REFERENCES help_posts(id),         -- 关联的互助帖子（选填）
  message TEXT NOT NULL,                               -- 感谢内容，如"帮我跑了 DPO 实验，太靠谱了"
  is_public BOOLEAN DEFAULT TRUE,                      -- 是否公开显示在对方主页
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id, help_post_id)       -- 同一个帖子只能感谢一次
);
```

### 3.17 引用意向追踪表 `citation_intents`

```sql
-- 追踪谁从引用助手复制了谁的 BibTeX（用于统计和通知）
CREATE TABLE citation_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citer_id UUID REFERENCES profiles(id) NOT NULL,      -- 谁复制了 BibTeX（引用者）
  paper_id UUID REFERENCES papers(id) NOT NULL,        -- 被引用的论文
  source TEXT DEFAULT 'cite_assistant',                 -- 来源：'cite_assistant' | 'paper_page' | 'search'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX citation_intents_paper_idx ON citation_intents(paper_id);
```

---

## 四、核心功能模块详细设计

### 4.1 注册与邀请系统（邀请码 + 管理员审批双重机制）

**注册流程**：
1. 新用户访问网站 → 看到登录页，点击"申请加入"
2. 输入邀请码 → 系统验证邀请码有效
3. 使用 Supabase Auth 注册（邮箱+密码 或 GitHub OAuth）
4. 填写个人资料：真实姓名、昵称、机构、研究方向、Semantic Scholar ID 等
5. 提交申请 → 账号状态标记为 `pending`（待审批）
6. 系统自动通知管理员（你）：
   - 发邮件到你的邮箱，内容包含申请人信息 + 一键审批链接
   - 推送到企业微信群："新人申请：张三（清华/NLP），邀请人：李四"
7. 你在管理后台（`/admin/approvals`）查看申请，点击"通过"或"拒绝"
8. 通过 → 申请人收到邮件通知"你的申请已通过，现在可以登录共研了"
9. 拒绝 → 申请人收到邮件通知"你的申请未通过"（可附原因）

**待审批期间**：
- 用户可以登录，但看到的是一个等待页面："你的申请正在审核中，请耐心等待"
- 不能访问任何功能页面
- RLS 策略中通过 `approval_status = 'approved'` 过滤，确保待审批用户无法读取数据

**管理员审批页面** `/admin/approvals`：
- 显示所有待审批用户列表
- 每个申请卡片显示：昵称、机构、研究方向、邀请人是谁、申请时间
- 两个按钮："通过" / "拒绝"（拒绝可填原因）
- 只有 `is_admin = true` 的用户能访问此页面

**邀请码规则**：
- 每个已通过的用户初始获得 3 个邀请码
- 贡献积分达到一定分数后可以获得额外邀请码
- 邀请码 7 天有效
- 邀请码只是第一道门槛，最终是否通过由管理员决定

**页面**：
- `/login` — 登录页
- `/register?code=xxx` — 注册页（带邀请码）
- `/pending` — 等待审批页面
- `/admin/approvals` — 管理员审批页面
- `/settings/invites` — 管理自己的邀请码

### 4.2 个人主页

**页面路径**：`/user/:username`

**包含内容**：
1. **基本信息卡片**：头像、昵称 + 等级徽章、机构、研究方向标签、社交链接（GitHub / HF / Scholar / Twitter）
2. **置顶公告栏**（Lv.4+）：一条自定义横幅，如"最近在做多模态 RLHF，欢迎合作"
3. **精选论文**（Lv.4+）：置顶展示 1-2 篇代表作，独立于时间排序
4. **我的论文**：按时间倒序展示，每篇论文显示标题、venue、年份、BibTeX 复制按钮、圈内被引次数
5. **Star 请求墙**：展示该用户当前需要帮忙点 star/upvote 的链接列表，每个链接旁边有：
   - 平台图标（GitHub / HF / AlphaXiv）
   - "我已 star" 按钮
   - 进度条（已完成 / 目标数量）
   - 已帮忙的人头像列表
6. **感谢墙**（Lv.3+）：展示收到的公开感谢，如"感谢帮我跑了 DPO 实验 —— 来自李四"
7. **互助统计卡片**：帮了多少人、被帮了多少次、积分、等级、感谢数
8. **"我帮助过的人"墙**（Lv.3+）：帮助过的圈友头像列表

**论文自动导入**：
- 用户填写 Semantic Scholar Author ID 后，系统调用 API 自动拉取论文列表
- 用户可以选择哪些论文要展示
- 后台每周自动检查是否有新论文

### 4.3 互助看板

**页面路径**：`/board`

**帖子发布流程**：
1. 用户点击 "发布求助" 按钮
2. 填写：标题、详细描述（Markdown）、类别（下拉选择）、是否提供挂名、紧急程度、截止时间
3. 提交后：
   - 帖子出现在看板上
   - 自动触发 Webhook 推送到微信群/飞书群
   - 自动给所有用户发送站内通知（可按方向过滤）

**微信群同步消息格式**：
```
📢 【共研·新求助】
发布者：张三
类别：求合作
标题：需要有人帮忙跑 DPO 实验
挂名：可挂共一
详情：https://gongyan.app/board/post/xxx
```

**看板视图**：
- 默认按时间倒序
- 可按类别筛选（全部 / 求 star / 求引用 / 求合作 / 求审稿 / 求算力）
- 可按状态筛选（进行中 / 已完成）
- 可按紧急程度排序

**响应流程**：
1. 看到帖子 → 点击 "我可以帮忙"
2. 帖子作者收到通知，可以接受/拒绝
3. 接受后状态变为 "进行中"
4. 完成后双方确认，帖子标记为 "已完成"
5. 双方获得贡献积分

### 4.4 论文资源池

**页面路径**：`/papers`

**功能**：
- 汇总所有成员的论文，形成一个内部论文库
- **方向分类导航**：左侧显示所有研究方向标签，点击筛选
- **搜索**：支持按标题、摘要、作者、方向关键词搜索
- **论文卡片**：标题、作者（圈内作者高亮）、venue、年份、摘要折叠
- **一键 BibTeX**：每篇论文旁边有复制 BibTeX 按钮
- **引用助手**：核心功能，见 4.4.1

#### 4.4.1 AI 引用助手（核心功能）

**页面路径**：`/papers/cite-assistant`

这是整个平台最重要的功能。用户把自己正在写的 Related Work（或整篇论文）粘贴进来，AI 自动分析文本内容，从圈内论文池中找出可以引用的论文，并给出具体的插入建议。

**用户操作流程**：

```
第一步：粘贴文本
┌─────────────────────────────────────────────┐
│  📋 粘贴你的 Related Work 或论文段落           │
│                                              │
│  [大文本框，支持 LaTeX 格式]                   │
│                                              │
│  或者：📎 上传 .tex / .pdf 文件               │
│                                              │
│  [🔍 开始分析]                                │
└─────────────────────────────────────────────┘

第二步：AI 分析结果
┌─────────────────────────────────────────────┐
│  找到 5 篇圈内论文可以引用：                    │
│                                              │
│  📍 你的第 3 段讨论了 "RLHF alignment"        │
│  → 推荐引用：Wang et al. (2025) "..."        │
│    相关度：⭐⭐⭐⭐⭐                           │
│    建议插入位置："...recent work on RLHF       │
│    [INSERT HERE] has shown..."               │
│    插入后的句子预览：                           │
│    "...recent work on RLHF (Wang et al.,     │
│     2025) has shown..."                      │
│    [复制修改后的段落] [复制 BibTeX]             │
│                                              │
│  📍 你的第 5 段讨论了 "reward modeling"        │
│  → 推荐引用：Li et al. (2024) "..."          │
│    ...                                       │
│                                              │
│  ─────────────────────────────────────────── │
│  📋 一键复制所有推荐论文的 BibTeX               │
│  📄 下载修改后的完整文本（已插入引用）            │
└─────────────────────────────────────────────┘
```

**技术实现**：

```typescript
// 引用助手的核心 Edge Function
// POST /functions/v1/cite-assistant

import Anthropic from '@anthropic-ai/sdk';

interface CiteSuggestion {
  paper_id: string;
  paper_title: string;
  paper_authors: string;
  paper_bibtex: string;
  relevance_score: number;           // 0-1 相关度
  paragraph_index: number;           // 建议插入的段落编号
  context_sentence: string;          // 原文中相关的句子
  suggested_insertion: string;       // 建议插入后的句子
  reason: string;                    // 为什么推荐（一句话解释）
}

async function analyzeCitations(userText: string, paperPool: Paper[]): Promise<CiteSuggestion[]> {
  const client = new Anthropic();
  
  // 构建论文池的摘要信息（控制 token 量）
  const poolSummary = paperPool.map(p => ({
    id: p.id,
    title: p.title,
    authors: p.authors.join(', '),
    year: p.year,
    abstract: p.abstract?.substring(0, 200),  // 截取前 200 字
    venue: p.venue,
    directions: p.research_directions,
  }));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: `你是一个学术引用助手。用户会给你一段论文文本（通常是 Related Work），以及一个论文池。
你的任务是：
1. 分析用户文本中讨论了哪些主题
2. 从论文池中找出与这些主题相关的论文
3. 对于每篇推荐论文，给出具体的插入位置和插入方式
4. 只推荐真正相关的论文，不要强行推荐

输出严格的 JSON 格式，不要包含任何其他文字。`,
    messages: [{
      role: 'user',
      content: `## 用户的论文文本：
${userText}

## 可引用的论文池：
${JSON.stringify(poolSummary)}

请分析文本内容，找出可以引用论文池中哪些论文，并给出具体的插入建议。
返回 JSON 数组，每个元素包含：
- paper_id: 论文 ID
- relevance_score: 相关度 0-1
- paragraph_index: 建议插入的段落编号（从 0 开始）
- context_sentence: 原文中与该论文相关的句子
- suggested_insertion: 插入引用后的句子（用 LaTeX \\cite{citekey} 格式）
- reason: 为什么推荐这篇论文（一句话）

只返回 relevance_score > 0.5 的结果。`
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const suggestions = JSON.parse(text.replace(/```json|```/g, '').trim());
  
  // 补充完整的论文信息和 BibTeX
  return suggestions.map((s: any) => {
    const paper = paperPool.find(p => p.id === s.paper_id);
    return {
      ...s,
      paper_title: paper?.title,
      paper_authors: paper?.authors?.join(', '),
      paper_bibtex: paper?.bibtex,
    };
  });
}
```

**两种使用模式**：

**模式一：完整分析**（粘贴 Related Work → 全面分析）
- 用户粘贴整段 Related Work 或上传 .tex 文件
- AI 分析全文，批量推荐所有可引用的圈内论文
- 适合写论文初期，一次性找到所有可引用的资源

**模式二：快速搜索**（输入几个关键词 → 快速匹配）
- 用户输入"我正在写关于 RLHF + reward hacking 的 related work"
- 系统快速返回相关论文列表 + BibTeX
- 不做插入建议，只做匹配
- 不调用 AI API，纯标签/embedding 匹配，速度更快

**引用追踪**：
- 每次用户从引用助手复制了 BibTeX，系统记录一次"被引用意向"
- 被引论文的 `internal_cite_count` +1
- 论文作者收到通知："张三可能在新论文中引用了你的论文 [xxx]"
- 这个数据也可以展示在论文详情页：`圈内 3 人可能引用了这篇论文`

**API 配置**：
- 管理员在设置页配置 Anthropic API Key（或 OpenAI API Key）
- 存储在 Supabase Edge Function Secrets 中
- 支持切换模型：Claude Sonnet（推荐）/ GPT-4o
- 如果没有配置 API Key，引用助手降级为纯标签匹配模式（不需要 AI）

### 4.5 投稿日历

**页面路径**：`/calendar`

**功能**：
- 日历视图 + 列表视图切换
- 显示各会议/期刊的截稿时间线
- 支持按方向筛选、按 CCF 等级筛选
- 每个 Deadline 卡片显示：
  - 会议名、全称、CCF 等级
  - 截稿日期 + 倒计时天数
  - "我要投这个" 按钮 → 标记意向
  - 已标记意向的其他用户列表（方便找队友）
- 截稿前 7 天 / 3 天 / 1 天自动提醒（站内通知 + 微信推送）

**Deadline 数据来源**：
- 初始可手动录入或爬取 CCF-Deadlines / AI-Deadlines 等开源项目的数据
- 成员可以自行添加新的 Deadline

### 4.6 通知系统（三通道：站内 + 邮件 + 企业微信群）

**通知触发场景及通道分配**：

| 事件 | 接收人 | 站内 | 邮件 | 微信群 |
|------|--------|------|------|--------|
| 新用户申请注册 | 管理员 | ✅ | ✅ | ✅ |
| 注册审批通过/拒绝 | 申请人 | ✅ | ✅ | ❌ |
| 新互助帖子发布 | 所有人 | ✅ | ❌ | ✅ |
| 有人响应你的帖子 | 帖子作者 | ✅ | ✅ | ❌ |
| 有人 star 了你的请求 | 请求发起者 | ✅ | ❌ | ❌ |
| 有人可能引用了你的论文 | 论文作者 | ✅ | ✅ | ❌ |
| 收到感谢 | 帮助者 | ✅ | ✅ | ❌ |
| 等级提升 | 本人 | ✅ | ✅ | ✅ |
| 圈内有人发新论文 | 相关方向的人 | ✅ | ✅ | ✅ |
| 投稿 Deadline 临近（7天/3天/1天） | 标记了意向的人 | ✅ | ✅ | ✅ |
| 有人和你投同一个会议 | 双方 | ✅ | ✅ | ❌ |
| 月度排行榜出炉 | 所有人 | ✅ | ❌ | ✅ |

**分配原则**：
- 站内通知：所有事件都发
- 邮件：重要的个人相关事件（审批结果、帖子有人响应、Deadline 提醒、新论文）
- 微信群：群体性事件（新求助帖、新论文、Deadline 提醒、新人申请），让大家看到动态

**邮件服务实现（Resend）**：

```typescript
// Supabase Edge Function: send-email
import { Resend } from 'resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

// 审批通过通知邮件
async function sendApprovalEmail(userEmail: string, userName: string) {
  await resend.emails.send({
    from: '共研 GongYan <noreply@gongyan.app>',
    to: userEmail,
    subject: '🎉 你的共研申请已通过',
    html: `
      <h2>欢迎加入共研！</h2>
      <p>Hi ${userName}，</p>
      <p>你的注册申请已通过审核，现在可以登录共研平台了。</p>
      <p><a href="https://gongyan.app/login">点击登录</a></p>
    `,
  });
}

// 新人申请通知管理员
async function notifyAdminNewApplication(applicant: Profile, inviter: Profile) {
  await resend.emails.send({
    from: '共研 GongYan <noreply@gongyan.app>',
    to: Deno.env.get('ADMIN_EMAIL'),
    subject: `📋 新人申请：${applicant.display_name}（${applicant.institution}）`,
    html: `
      <h2>新的注册申请</h2>
      <p><strong>申请人：</strong>${applicant.display_name}</p>
      <p><strong>机构：</strong>${applicant.institution}</p>
      <p><strong>研究方向：</strong>${applicant.research_directions?.join(', ')}</p>
      <p><strong>邀请人：</strong>${inviter.display_name}</p>
      <p><a href="https://gongyan.app/admin/approvals">前往审批</a></p>
    `,
  });
}

// Deadline 提醒邮件
async function sendDeadlineReminder(userEmail: string, deadline: Deadline, daysLeft: number) {
  await resend.emails.send({
    from: '共研 GongYan <noreply@gongyan.app>',
    to: userEmail,
    subject: `⏰ ${deadline.venue_name} 还有 ${daysLeft} 天截稿`,
    html: `
      <h2>${deadline.venue_name} 截稿提醒</h2>
      <p>距离 ${deadline.full_name} 截稿还有 <strong>${daysLeft} 天</strong>。</p>
      <p>截稿时间：${deadline.deadline_date}</p>
      <p><a href="https://gongyan.app/calendar/${deadline.id}">查看详情</a></p>
    `,
  });
}
```

**通知渠道**：
1. **站内通知**：顶部铃铛图标 + 红点未读计数，点击展开通知列表
2. **邮件通知**：通过 Resend 发送，重要事件实时发，Deadline 提醒按计划发
3. **企业微信群 Webhook**：群体性事件自动推送到群里

### 4.7 贡献与奖励系统

#### 4.7.1 积分规则

| 行为 | 积分 | 说明 |
|------|------|------|
| 帮别人点 star / upvote | +1 | 点完后在平台标记"已完成" |
| 帮别人引用论文（从引用助手复制 BibTeX） | +2 | 系统自动记录 |
| 响应互助帖子并完成 | +3 | 双方确认后发放 |
| 帮人审稿 / 校对 | +5 | 帖子作者确认 |
| 合作完成论文（被确认挂名） | +10 | 帖子作者确认 |
| 添加新的 Deadline 信息 | +1 | 自动发放 |
| 邀请新成员加入（审批通过后） | +2 | 审批通过后自动发放 |
| 发布互助帖子 | +1 | 鼓励大家提需求 |
| 在论文/帖子下发表有价值的评论 | +1 | 被评论对象点赞后发放 |

#### 4.7.2 等级与徽章系统

根据累计积分自动解锁等级，每个等级有对应的徽章和特权：

| 等级 | 所需积分 | 徽章名称 | 特权 |
|------|----------|----------|------|
| Lv.1 | 0 | 🌱 新芽 | 基础功能 |
| Lv.2 | 20 | 🔬 研究者 | 解锁 3 个额外邀请码 |
| Lv.3 | 50 | ⭐ 活跃贡献者 | 个人主页展示"活跃贡献者"金色徽章，首页动态流中你的帖子带高亮边框 |
| Lv.4 | 100 | 🏆 核心成员 | 主页展示"核心成员"徽章 + 个人主页顶部可置顶一条自定义公告（如"最近在做 XX，欢迎合作"） |
| Lv.5 | 200 | 💎 共研元老 | 主页展示"元老"徽章 + 在成员目录中排名靠前 + 解锁无限邀请码 |

**徽章显示位置**：
- 用户昵称旁边（全站所有出现昵称的地方都带徽章图标）
- 个人主页大头卡片上
- 成员目录中
- 帖子和评论中的作者名旁

#### 4.7.3 个人主页增强展示（高积分特权）

**Lv.3+ 主页额外展示区**：
- **"我帮助过的人"墙**：展示你帮助过的圈友的头像列表（类似 GitHub 贡献者列表）
- **互助数据可视化**：帮了多少人点 star、引用了多少篇圈内论文、完成了多少互助任务，用小型图表展示
- **"感谢 XX"标签**：被你帮助过的人可以给你发一个公开感谢，显示在你的主页上（如："感谢帮我跑了 DPO 实验 —— 来自李四"）

**Lv.4+ 主页额外展示区**：
- **置顶公告栏**：主页顶部一条横幅，自己可以编辑内容，如"最近在做多模态 RLHF，欢迎找我合作"
- **精选论文推荐位**：可以在主页上置顶展示 1-2 篇自己最得意的论文，独立于时间排序

**Lv.5+ 主页额外展示区**：
- **"我的引用网络"图**：可视化展示你和圈内其他人的互相引用关系（简单的节点连线图）

#### 4.7.4 感谢机制

**被帮助的人可以给帮助者发"感谢"**：
- 在互助帖子完成后，系统提示帖子作者"要不要给 XX 发一个感谢？"
- 感谢内容是一句话（如"帮我跑了 3 个实验，太靠谱了"），公开显示在帮助者的主页上
- 每收到一个感谢，额外 +2 积分
- 感谢数量也是一个独立指标，显示在个人资料中："收到 12 次感谢"

#### 4.7.5 排行榜增强

**`/leaderboard` 页面**：
- **月度排行**：本月积分最高的 Top 10（避免老用户永远霸榜）
- **总榜**：累计积分 Top 10
- **专项榜**：
  - "Star 之王"：本月帮别人点 star 最多的人
  - "引用达人"：本月引用圈内论文最多的人
  - "互助先锋"：本月完成互助任务最多的人
- 每月 1 号自动在微信群推送上月排行榜 Top 3

### 4.8 成员目录

**页面路径**：`/members`

**功能**：
- 以卡片网格展示圈内所有已通过审批的成员
- 每张卡片显示：头像、昵称、机构、研究方向标签、论文数量、贡献积分
- 支持按研究方向标签筛选（点击标签过滤）
- 支持按昵称/机构搜索
- 点击卡片跳转到个人主页
- 可切换为列表视图（信息更紧凑）
- 显示邀请关系树（谁邀请了谁，管理员视角可看完整树）

### 4.9 新用户引导流程

**触发条件**：用户审批通过后首次登录，自动跳转到 `/onboarding`

**引导步骤**（分步引导页，3-4 步）：
1. **欢迎页**：简要介绍共研是什么、能做什么
2. **完善资料**：引导填写 Semantic Scholar ID（自动导入论文）、GitHub 用户名、研究方向标签
3. **添加 Star 请求**：引导用户把自己需要帮忙的 GitHub repo / HF 模型链接加上来
4. **订阅设置**：选择关注的研究方向标签、通知偏好

完成后标记 `onboarding_completed = true`，后续登录不再跳转。

### 4.10 收藏系统

**功能**：
- 在论文卡片、互助帖子、Deadline 卡片上都有收藏按钮（小书签图标）
- 点击收藏/取消收藏
- `/bookmarks` 页面汇总所有收藏内容，按类型分 Tab：论文 / 帖子 / Deadline

### 4.11 帖子编辑与删除

**规则**：
- 帖子作者可以编辑自己的帖子（标题、内容、类别、挂名信息）
- 编辑后帖子显示"已编辑"标记 + 编辑时间
- 帖子作者可以关闭帖子（状态变为 `closed`，但不删除，历史可查）
- 管理员可以关闭任何帖子
- 不做硬删除，避免数据丢失

### 4.12 每周汇总邮件（Weekly Digest）

**功能**：
- 每周一（可在通知偏好中改为周五）自动发送一封汇总邮件给所有开启了此功能的用户
- 邮件内容包括：
  - 本周新发布的论文（圈内）
  - 本周发布的互助帖子（未完成的）
  - 本周即将到来的 Deadline
  - 本周贡献积分 Top 3
  - 新加入的成员
- 由 Supabase Cron Job 触发 Edge Function 生成并发送

### 4.13 投稿日历补充：期刊滚动投稿

**问题**：部分期刊没有固定 Deadline，全年接收投稿（rolling submission）

**解决方案**：
- `deadlines` 表中 `deadline_date` 允许为空
- 新增字段 `is_rolling BOOLEAN DEFAULT FALSE`
- 滚动投稿的期刊在日历中以不同样式显示（如虚线边框 + "全年接收"标签）
- 用户仍然可以标记意向，方便找同一个期刊的投稿伙伴

---

## 五、页面结构总览

```
/                          → 首页 Dashboard（动态流 + 快捷入口）
/login                     → 登录
/register                  → 注册（需邀请码）
/pending                   → 等待审批页面（未通过审核的用户看到这个）
/onboarding                → 新用户引导页（审批通过后首次登录）
/members                   → 成员目录（按方向浏览圈内所有人）
/user/:username            → 个人主页
/user/:username/edit       → 编辑个人资料
/papers                    → 论文资源池
/papers/:id                → 论文详情 + 评论区
/papers/cite-assistant     → AI 引用助手
/board                     → 互助看板
/board/new                 → 发布求助
/board/post/:id            → 帖子详情 + 讨论区
/board/post/:id/edit       → 编辑帖子
/calendar                  → 投稿日历
/calendar/:id              → Deadline 详情 + 投稿意向
/bookmarks                 → 我的收藏
/notifications             → 通知中心
/settings                  → 个人设置
/settings/invites          → 邀请码管理
/settings/notifications    → 通知偏好设置
/leaderboard               → 贡献排行榜
/admin/approvals           → 管理员：注册审批（仅管理员可见）
/admin/members             → 管理员：成员管理（仅管理员可见）
/admin/tags                → 管理员：标签管理（合并/新增/删除标签）
/admin/activity            → 管理员：操作日志（查看平台活跃度）
```

---

## 六、首页 Dashboard 设计

首页是用户打开网站看到的第一个页面，需要快速展示最重要的信息：

1. **顶部快捷操作栏**：发布求助 / 添加论文 / 引用助手 / 生成邀请码
2. **动态流**（类似 timeline，混合展示以下内容，按时间倒序）：
   - 最新互助帖子（前 5 条）
   - 最新发布的论文（带"引用"快捷按钮）
   - 最新的 star 请求
   - 临近的 Deadline 提醒
   - 等级提升动态（"张三升级为 ⭐ 活跃贡献者"）
   - 感谢动态（"李四感谢了王五：帮我跑了 DPO 实验"）
   - Lv.3+ 用户的帖子在动态流中带高亮边框
3. **侧边栏**（桌面端显示，移动端折叠）：
   - 我的待办（我发的帖子有几个新响应、别人的 star 请求我还没帮忙点的数量）
   - 即将到来的 Deadline（倒计时卡片）
   - 月度贡献排行 Top 5（带徽章图标）
   - 引用助手快捷入口（"写论文？试试引用助手"）

---

## 七、API 接口设计

由于使用 Supabase，大部分 CRUD 操作直接通过 Supabase Client SDK 操作数据库（Row Level Security 控制权限），以下列出需要额外处理的 Edge Functions：

### 7.1 Supabase Edge Functions

```
POST /functions/v1/sync-wechat          → 互助帖子同步到企业微信群
POST /functions/v1/send-email           → 通用邮件发送（审批通知、Deadline 提醒等）
POST /functions/v1/approve-user         → 管理员审批通过用户（更新状态 + 发邮件 + 发微信）
POST /functions/v1/reject-user          → 管理员拒绝用户（更新状态 + 发邮件）
POST /functions/v1/cite-assistant       → AI 引用助手（分析文本 + 推荐圈内论文 + 生成插入建议）
POST /functions/v1/import-papers        → 从 Semantic Scholar 批量导入论文
POST /functions/v1/check-new-papers     → 定时检查圈内是否有新论文（Cron：每周一次）
POST /functions/v1/send-deadline-remind → 定时发送 Deadline 提醒（Cron：每天检查，邮件+微信+站内）
POST /functions/v1/send-weekly-digest   → 每周汇总邮件（Cron：每周一早上）
POST /functions/v1/send-monthly-rank    → 每月排行榜推送到微信群（Cron：每月 1 号）
POST /functions/v1/generate-invite-code → 生成邀请码
POST /functions/v1/validate-invite-code → 验证邀请码
POST /functions/v1/update-badge-level   → 积分变动时重新计算用户等级（Database Webhook 触发）
```

### 7.2 Row Level Security (RLS) 策略

```sql
-- 辅助函数：检查当前用户是否已通过审批
CREATE OR REPLACE FUNCTION is_approved() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND approval_status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 辅助函数：检查当前用户是否是管理员
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- profiles：已通过审批的用户可读所有人资料，本人可写自己的，管理员可改审批状态
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON profiles FOR SELECT 
  USING (auth.uid() = id OR is_approved());  -- 本人始终可读自己的，已审批用户可读所有人
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE 
  USING (auth.uid() = id);
CREATE POLICY "profiles_admin_update" ON profiles FOR UPDATE 
  USING (is_admin());  -- 管理员可更新任何人的资料（用于审批）

-- papers：仅已通过审批的用户可读，论文所有者可增删改
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "papers_read" ON papers FOR SELECT USING (is_approved());
CREATE POLICY "papers_write" ON papers FOR ALL USING (auth.uid() = owner_id);

-- help_posts：仅已通过审批的用户可读可发帖，作者可改自己的帖
ALTER TABLE help_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_read" ON help_posts FOR SELECT USING (is_approved());
CREATE POLICY "posts_insert" ON help_posts FOR INSERT WITH CHECK (auth.uid() = author_id AND is_approved());
CREATE POLICY "posts_update" ON help_posts FOR UPDATE USING (auth.uid() = author_id);

-- 其他表（star_requests, deadlines, notifications 等）类似模式
-- 统一规则：SELECT 需要 is_approved()，INSERT 需要 is_approved() + 本人，UPDATE 需要本人
```

### 7.3 实时订阅（Supabase Realtime）

```typescript
// 监听新互助帖子（用于首页实时更新）
supabase
  .channel('help_posts')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'help_posts' }, 
    payload => { /* 更新 UI */ })
  .subscribe();

// 监听通知
supabase
  .channel('notifications')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
    payload => { /* 显示通知 */ })
  .subscribe();
```

### 7.4 数据库触发器（自动化关键逻辑）

```sql
-- 积分变动时自动更新等级
CREATE OR REPLACE FUNCTION update_badge_level()
RETURNS TRIGGER AS $$
BEGIN
  NEW.badge_level := CASE
    WHEN NEW.contribution_score >= 200 THEN 5
    WHEN NEW.contribution_score >= 100 THEN 4
    WHEN NEW.contribution_score >= 50  THEN 3
    WHEN NEW.contribution_score >= 20  THEN 2
    ELSE 1
  END;
  
  -- 如果等级提升了，插入一条通知
  IF NEW.badge_level > OLD.badge_level THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.id,
      'badge_upgrade',
      '🎉 等级提升！',
      '恭喜你升级到 Lv.' || NEW.badge_level,
      '/user/' || NEW.username
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_badge_level
  BEFORE UPDATE OF contribution_score ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_badge_level();

-- 新互助帖子自动触发微信群同步（通过 Supabase Database Webhook）
-- 在 Supabase Dashboard → Database → Webhooks 中配置：
-- 表: help_posts, 事件: INSERT
-- URL: https://<project>.supabase.co/functions/v1/sync-wechat
-- 这样每次 INSERT help_posts 都会自动调用 sync-wechat Edge Function

-- BibTeX 复制时自动记录引用意向并更新计数
-- 这部分在前端实现：复制 BibTeX 时同时调用 citation_intents INSERT + papers.internal_cite_count UPDATE
```

### 7.5 标签系统迁移说明

```
profiles、papers、deadlines 表中都保留了 research_directions TEXT[] 字段。
这是为了兼容 MVP 阶段的简单实现。

迁移路径：
Phase 1-2：直接使用 TEXT[] 字段，简单快捷
Phase 3-4：启用 tags 表 + 关联表（profile_tags, paper_tags, deadline_tags）
          编写迁移脚本：将所有 TEXT[] 中的值去重后插入 tags 表，
          建立关联关系，然后前端切换到读取关联表
          TEXT[] 字段保留但不再写入，最终可以删除

迁移脚本示例：
INSERT INTO tags (name) 
  SELECT DISTINCT unnest(research_directions) FROM profiles
  ON CONFLICT (name) DO NOTHING;
```
```

---

## 八、微信群同步实现

### 8.1 企业微信群机器人方案

```typescript
// Supabase Edge Function: sync-wechat
const WECHAT_WEBHOOK_URL = Deno.env.get('WECHAT_WEBHOOK_URL');

async function syncToWechat(post: HelpPost, author: Profile) {
  const categoryMap = {
    star: '求 Star',
    citation: '求引用',
    collaboration: '求合作',
    review: '求审稿',
    compute: '求算力',
    other: '其他',
  };

  const coauthorInfo = post.offer_coauthorship 
    ? `\n🤝 挂名：${post.coauthorship_details || '可挂名'}` 
    : '';

  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `📢 **【共研·新求助】**
> 发布者：${author.display_name}
> 类别：${categoryMap[post.category]}
> 标题：${post.title}${coauthorInfo}
> 
> [👉 查看详情](https://gongyan.app/board/post/${post.id})`
    }
  };

  await fetch(WECHAT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
}
```

### 8.2 如果用飞书

```typescript
// 飞书 Webhook 格式类似，改 msgtype 为 interactive 卡片即可
const message = {
  msg_type: 'interactive',
  card: {
    header: { title: { tag: 'plain_text', content: '📢 共研·新求助' } },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: `**${post.title}**\n发布者：${author.display_name}\n类别：${categoryMap[post.category]}` } },
      { tag: 'action', actions: [{ tag: 'button', text: { tag: 'plain_text', content: '查看详情' }, url: `https://gongyan.app/board/post/${post.id}`, type: 'primary' }] }
    ]
  }
};
```

---

## 九、论文自动导入流程

```
用户填写 Semantic Scholar Author ID
        ↓
Edge Function 调用 Semantic Scholar API:
GET https://api.semanticscholar.org/graph/v1/author/{authorId}/papers
  ?fields=title,authors,year,venue,abstract,externalIds,citationCount
        ↓
返回论文列表，写入 papers 表
        ↓
自动提取 arXiv ID → 生成 BibTeX
        ↓
用户在前端确认要展示哪些论文
        ↓
后台 Cron Job 每周检查新论文
  → 发现新论文自动添加 + 通知圈内相关方向的人
```

---

## 十、分期实现计划

### Phase 1：MVP 最小可用版（2-3 周）

**目标**：能注册、能看到人、能发帖求助

- [ ] Supabase 项目初始化 + 数据库建表
- [ ] 邀请码 + 管理员审批注册系统
- [ ] 管理员审批后台页面 `/admin/approvals`
- [ ] 待审批等待页面 `/pending`
- [ ] 个人主页（基本信息 + 研究方向）
- [ ] 互助看板（发帖 + 列表 + 状态管理）
- [ ] 首页 Dashboard（动态流）
- [ ] 基础 UI 框架 + 移动端适配
- [ ] MacBook 本地部署 + Cloudflare Tunnel 内网穿透

### Phase 2：核心功能（2-3 周）

**目标**：论文库和 star 系统上线

- [ ] 论文资源池（手动添加 + Semantic Scholar 自动导入）
- [ ] BibTeX 一键复制
- [ ] 论文搜索 + 方向筛选
- [ ] Star 请求墙（个人主页）
- [ ] Star 完成记录 + "我已 star" 交互
- [ ] 贡献积分系统
- [ ] 企业微信群 Webhook 同步
- [ ] Resend 邮件通知（审批结果、新论文、帖子响应）
- [ ] AI 引用助手（粘贴 Related Work → 推荐圈内论文 + 插入建议）

### Phase 3：完善体验（2-3 周）

**目标**：日历、评论、收藏等社区功能上线

- [ ] 投稿日历（日历视图 + 列表视图 + 滚动投稿支持）
- [ ] 投稿意向标记 + 组队匹配
- [ ] Deadline 倒计时提醒（邮件 + 微信 + 站内三通道）
- [ ] 站内通知系统 + 通知偏好设置
- [ ] 评论系统（帖子和论文下方的讨论区）
- [ ] 收藏功能（收藏论文/帖子/Deadline）
- [ ] 帖子编辑和关闭功能
- [ ] 等级徽章系统（积分自动升级 + 全站徽章展示）
- [ ] 感谢机制（互助完成后发感谢 + 感谢墙）
- [ ] 个人主页增强展示（Lv.3+ 的感谢墙/帮助墙，Lv.4+ 的置顶公告/精选论文）
- [ ] 实时订阅（新帖子 / 新通知即时推送）
- [ ] PWA 配置（离线缓存 + 安装提示）
- [ ] 贡献排行榜

### Phase 4：优化迭代（持续）

- [ ] 成员目录页面 + 按方向浏览
- [ ] 新用户引导流程（Onboarding）
- [ ] 每周汇总邮件（Weekly Digest）
- [ ] 统一标签管理系统（管理员后台）
- [ ] 引用推荐系统（基于标签匹配 → 基于语义 embedding）
- [ ] 论文新增自动检测（Cron Job）
- [ ] 操作日志 + 管理员活跃度面板
- [ ] 数据导出（我的论文列表、我的互助记录）
- [ ] 论文去重检测
- [ ] 排行榜增强（月度榜 + 专项榜 + 每月自动微信推送）
- [ ] Lv.5 引用网络可视化（节点连线图）
- [ ] 暗色模式

---

## 十一、UI 设计要求

### 11.1 整体风格

- 风格：简洁学术风，不要花哨，高效信息密度
- 配色：主色用深靛蓝（#1e293b）+ 辅助色翠绿（#10b981）做强调
- 字体：中文用系统默认（`"PingFang SC", "Microsoft YaHei", sans-serif`），英文用 `"JetBrains Mono"` 做代码和 BibTeX 展示
- 卡片：白色卡片 + 轻阴影，圆角 8-12px
- 移动端：底部 Tab 导航（首页 / 看板 / 论文 / 日历 / 我的）
- 桌面端：左侧侧边栏导航

### 11.2 关键交互

- 发帖后有 toast 提示 "已同步到微信群"
- Star "我已完成" 按钮点击后有轻微动画反馈 + 进度条更新
- BibTeX 复制按钮点击后显示 "已复制 ✓"，同时后台记录引用意向
- 论文搜索结果实时显示（debounce 300ms）
- 日历 Deadline 卡片支持拖拽查看（移动端）
- 等级升级时全屏弹出升级动画（轻量，1-2 秒）
- 引用助手分析过程中显示进度条 + "AI 正在分析你的文本..."
- 感谢提交后在帮助者主页实时出现（Supabase Realtime）
- 徽章图标 hover 时 tooltip 显示等级名和所需积分

---

## 十二、环境变量配置

```env
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# 企业微信群 Webhook（存在 Supabase Edge Function Secrets 中）
WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx

# 邮件服务 Resend（存在 Supabase Edge Function Secrets 中）
RESEND_API_KEY=re_xxx
ADMIN_EMAIL=你的邮箱@xxx.com

# Semantic Scholar（免费 API，无需 key，但有请求频率限制）
SEMANTIC_SCHOLAR_API_KEY=（可选，申请后配额更高）

# AI 引用助手 API（存在 Supabase Edge Function Secrets 中）
ANTHROPIC_API_KEY=sk-ant-xxx                  # 推荐使用 Claude Sonnet
# 或者：OPENAI_API_KEY=sk-xxx                 # 备选方案
AI_PROVIDER=anthropic                         # 'anthropic' | 'openai'

# Cloudflare Tunnel（本地部署用）
TUNNEL_TOKEN=xxx
```

---

## 十三、项目目录结构

```
gongyan/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   └── icons/                 # App 图标
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── lib/
│   │   ├── supabase.ts        # Supabase client 初始化
│   │   ├── api/
│   │   │   ├── papers.ts      # 论文 CRUD
│   │   │   ├── helpPosts.ts   # 互助帖子 CRUD
│   │   │   ├── starRequests.ts# Star 请求 CRUD
│   │   │   ├── deadlines.ts   # Deadline CRUD
│   │   │   ├── profiles.ts    # 用户资料 CRUD
│   │   │   ├── notifications.ts
│   │   │   ├── invitations.ts
│   │   │   ├── comments.ts    # 评论 CRUD
│   │   │   ├── bookmarks.ts   # 收藏 CRUD
│   │   │   ├── thanks.ts      # 感谢 CRUD
│   │   │   ├── tags.ts        # 标签 CRUD
│   │   │   └── citeAssistant.ts # 引用助手 API 调用
│   │   └── hooks/
│   │       ├── useAuth.ts
│   │       ├── useRealtime.ts
│   │       ├── useNotifications.ts
│   │       └── useBadge.ts     # 等级/徽章计算
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── BottomNav.tsx   # 移动端底部导航
│   │   │   ├── Header.tsx
│   │   │   └── NotificationBell.tsx
│   │   ├── papers/
│   │   │   ├── PaperCard.tsx
│   │   │   ├── PaperSearch.tsx
│   │   │   ├── BibtexButton.tsx
│   │   │   ├── PaperImport.tsx
│   │   │   └── CiteAssistant.tsx  # 引用助手组件
│   │   ├── board/
│   │   │   ├── PostCard.tsx
│   │   │   ├── PostForm.tsx
│   │   │   ├── PostDetail.tsx
│   │   │   └── CategoryFilter.tsx
│   │   ├── profile/
│   │   │   ├── ProfileCard.tsx
│   │   │   ├── StarRequestWall.tsx
│   │   │   ├── ContributionStats.tsx
│   │   │   ├── ProfileEdit.tsx
│   │   │   ├── BadgeDisplay.tsx    # 徽章/等级展示
│   │   │   └── ThanksWall.tsx      # 感谢墙
│   │   ├── calendar/
│   │   │   ├── CalendarView.tsx
│   │   │   ├── DeadlineCard.tsx
│   │   │   └── IntentButton.tsx
│   │   ├── shared/
│   │   │   ├── CommentSection.tsx  # 通用评论组件
│   │   │   ├── BookmarkButton.tsx  # 收藏按钮
│   │   │   ├── TagSelector.tsx     # 标签选择器
│   │   │   └── UserBadge.tsx       # 昵称旁的徽章图标
│   │   └── common/
│   │       ├── Badge.tsx
│   │       ├── Toast.tsx
│   │       ├── Modal.tsx
│   │       ├── EmptyState.tsx
│   │       └── LoadingSpinner.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Pending.tsx            # 等待审批页面
│   │   ├── Onboarding.tsx         # 新用户引导
│   │   ├── Members.tsx            # 成员目录
│   │   ├── Papers.tsx
│   │   ├── PaperDetail.tsx        # 论文详情 + 评论
│   │   ├── CiteAssistant.tsx      # AI 引用助手页面
│   │   ├── Board.tsx
│   │   ├── PostDetail.tsx         # 帖子详情 + 讨论
│   │   ├── PostEdit.tsx           # 编辑帖子
│   │   ├── Calendar.tsx
│   │   ├── Bookmarks.tsx          # 我的收藏
│   │   ├── Profile.tsx
│   │   ├── Settings.tsx
│   │   ├── NotificationSettings.tsx # 通知偏好
│   │   ├── Notifications.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── admin/
│   │   │   ├── Approvals.tsx      # 注册审批
│   │   │   ├── MemberManage.tsx   # 成员管理
│   │   │   ├── TagManage.tsx      # 标签管理
│   │   │   └── ActivityLog.tsx    # 操作日志
│   │   └── NotFound.tsx           # 404 页面
│   ├── store/
│   │   ├── authStore.ts
│   │   └── notificationStore.ts
│   └── styles/
│       └── globals.css
├── supabase/
│   ├── migrations/             # 数据库迁移文件
│   │   └── 001_initial_schema.sql
│   └── functions/
│       ├── sync-wechat/
│       ├── send-email/
│       ├── approve-user/
│       ├── reject-user/
│       ├── cite-assistant/
│       ├── import-papers/
│       ├── check-new-papers/
│       ├── send-deadline-remind/
│       ├── send-weekly-digest/
│       ├── send-monthly-rank/
│       ├── update-badge-level/
│       ├── generate-invite-code/
│       └── validate-invite-code/
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

---

## 十四、MacBook 本地部署方案

### 14.1 前端启动

```bash
# 开发模式（热更新）
cd gongyan && npm run dev -- --host 0.0.0.0 --port 3000

# 或者生产模式（更快、更稳定）
npm run build
npx serve -s dist -l 3000
```

### 14.2 Cloudflare Tunnel 内网穿透

```bash
# 安装（macOS）
brew install cloudflared

# 首次登录认证
cloudflared tunnel login

# 创建 tunnel
cloudflared tunnel create gongyan

# 配置路由（将 tunnel 绑定到你的域名，需要在 Cloudflare 添加域名）
cloudflared tunnel route dns gongyan gongyan.你的域名.com

# 启动 tunnel
cloudflared tunnel --url http://localhost:3000 run gongyan
```

如果没有域名，也可以用 Cloudflare 的快速临时隧道（每次重启 URL 会变）：
```bash
cloudflared tunnel --url http://localhost:3000
# 会输出一个 https://xxx.trycloudflare.com 的临时地址
```

### 14.3 开机自启（launchd）

创建文件 `~/Library/LaunchAgents/com.gongyan.startup.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gongyan.startup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/你的用户名/gongyan/start.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/你的用户名/gongyan/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/你的用户名/gongyan/logs/stderr.log</string>
</dict>
</plist>
```

启动脚本 `start.sh`：

```bash
#!/bin/bash
cd /Users/你的用户名/gongyan

# 防止 MacBook 睡眠
caffeinate -s &

# 启动前端
npx serve -s dist -l 3000 &

# 启动 Cloudflare Tunnel
cloudflared tunnel run gongyan &

wait
```

注册并启动：
```bash
chmod +x ~/gongyan/start.sh
launchctl load ~/Library/LaunchAgents/com.gongyan.startup.plist
```

### 14.4 防休眠设置

系统设置 → 电池 → 选项 → 关闭"当显示器关闭时使 Mac 自动进入睡眠"。或者在终端直接运行 `caffeinate -s`（start.sh 中已包含）。

---

## 十五、数据备份方案

**Supabase Cloud 自动备份**：
- 免费版每日自动备份，保留 7 天
- 可在 Supabase Dashboard → Database → Backups 查看和下载

**手动导出（建议每月一次）**：
```bash
# 使用 pg_dump 导出整个数据库（需要 Supabase 数据库连接字符串）
pg_dump "postgresql://postgres:密码@db.xxx.supabase.co:5432/postgres" > backup_$(date +%Y%m%d).sql
```

**论文数据导出**：
- 管理后台提供一键导出所有论文列表为 CSV/JSON 的功能
- 每个用户可以在设置页导出自己的论文列表和互助记录

---

## 十六、BibTeX 自动生成逻辑

当从 Semantic Scholar 导入论文时，自动生成 BibTeX：

```typescript
function generateBibtex(paper: SemanticScholarPaper): string {
  const firstAuthor = paper.authors[0]?.name?.split(' ').pop() || 'unknown';
  const year = paper.year || 'unknown';
  const key = `${firstAuthor.toLowerCase()}${year}${paper.title?.split(' ')[0]?.toLowerCase() || ''}`;
  
  const authors = paper.authors.map(a => a.name).join(' and ');
  const venue = paper.venue || '';
  
  // 根据 venue 类型生成不同格式
  const isConference = /neurips|icml|iclr|aaai|acl|emnlp|cvpr|iccv|eccv/i.test(venue);
  const type = isConference ? 'inproceedings' : 'article';
  const venueField = isConference 
    ? `  booktitle = {${venue}},` 
    : `  journal = {${venue}},`;

  return `@${type}{${key},
  title = {${paper.title}},
  author = {${authors}},
${venueField}
  year = {${year}},${paper.externalIds?.DOI ? `\n  doi = {${paper.externalIds.DOI}},` : ''}${paper.externalIds?.ArXiv ? `\n  eprint = {${paper.externalIds.ArXiv}},\n  archivePrefix = {arXiv},` : ''}
}`;
}
```

**论文去重逻辑**：
- 导入时按 Semantic Scholar ID / arXiv ID / DOI 去重
- 如果标题相似度 > 90%（Levenshtein 距离），提示"可能是重复论文"
- 同一篇论文多人录入时，合并到第一个录入者名下，其他人显示关联

---

## 十七、错误处理策略

**前端**：
- 所有 API 调用使用统一的 `try/catch` 封装
- 网络错误显示 Toast 提示"网络异常，请稍后重试"
- Supabase 返回 403 时提示"无权限"并跳转登录
- 表单提交失败时保留用户输入，不要清空

**后端（Edge Functions）**：
- 所有 Webhook 推送失败时重试 3 次（间隔 1s、5s、30s）
- 邮件发送失败时记录到 `activity_log` 表，不阻塞主流程
- Semantic Scholar API 超时时返回友好提示，建议用户手动录入
- 所有 Edge Function 错误写入日志，管理员可在 Supabase Dashboard 查看

**降级策略**：
- 微信 Webhook 不可用时，仍然发站内通知和邮件
- Semantic Scholar API 不可用时，论文导入降级为手动录入
- MacBook 关机时，Supabase 后端（数据库、Cron Job、邮件）仍然正常运行

---

## 十八、注意事项和建议

1. **Supabase 免费额度**：500MB 数据库 + 1GB Storage + 50,000 月活用户 + 500,000 Edge Function 调用，对于几十人的小圈子绰绰有余。

2. **Semantic Scholar API 限制**：免费无 key 每秒 1 请求，申请 API key 后每秒 10 请求。初期用户少完全够用。

3. **微信群 Webhook 限制**：企业微信群机器人每分钟最多发 20 条消息，足够。个人微信群需要第三方工具（如 WeChatFerry），合规性差一些，建议用企业微信。

4. **Resend 邮件限制**：免费版每月 3000 封，每天 100 封。50 人的圈子完全够用。需要绑定自己的域名做发件人（如 `noreply@gongyan.app`），否则只能用 Resend 提供的测试域名。

5. **Cloudflare Tunnel 注意**：免费版无限流量，但需要注册 Cloudflare 账号。如果想绑定自定义域名（如 `gongyan.app`），需要把域名 DNS 托管到 Cloudflare（免费）。

6. **AI 引用助手 API 成本**：每次调用引用助手大约消耗 2000-4000 tokens 输入 + 1000-2000 tokens 输出。以 Claude Sonnet 价格估算，每次约 $0.01-0.02。50 个人每人每月用 10 次 ≈ $5-10/月。如果想省钱，可以限制每人每天使用次数（如 5 次），或优先使用免费的标签匹配模式。

7. **中文搜索说明**：PostgreSQL 默认的全文搜索（`to_tsvector`）不支持中文分词。文档中已使用 `pg_trgm` 扩展做模糊匹配作为替代方案。如果后期需要更精确的中文搜索，可以考虑接入 Supabase 的 Vector 扩展做基于 embedding 的语义搜索。

8. **标签管理建议**：初始标签由管理员预设一批（NLP、CV、LLM、RL、Multimodal 等），用户可以申请新标签，管理员审核后添加。避免标签爆炸。

9. **安全考虑**：
   - RLS 策略要覆盖所有表，防止未授权访问
   - 邀请码使用后立即标记为已用
   - 个人主页的外部链接点击跳转前加提示
   - 管理员审批邮件中的"一键通过"链接需要带安全 token，防止伪造
   - 限制注册频率（同一 IP 每小时最多 3 次注册尝试）

10. **性能优化**：
   - 论文列表分页加载（每页 20 条）
   - 搜索使用 PostgreSQL 全文索引
   - 首页 Dashboard 的动态流用 Supabase Realtime 实时更新
   - 图片使用 Supabase Storage + CDN
   - 标签和成员列表可做客户端缓存（Zustand persist）

11. **后续可扩展**：
   - 如果用户增长到百人以上，可以考虑迁移到自建后端
   - 引用推荐可以接入 OpenAI Embedding API 做语义搜索
   - 可以增加 AI 功能：自动生成论文摘要、自动推荐审稿人等
   - MacBook 不够稳定时，可以随时迁移到 Vercel（前端几乎零改动）