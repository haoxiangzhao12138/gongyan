# 共研 GongYan

科研小团体的私密互助平台（邀请制）。

## 技术栈

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- React Router v7
- Zustand (状态管理)
- Supabase (Auth + Database + Realtime)

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 Supabase URL 和 anon key

# 启动开发服务器
npm run dev

# 构建
npm run build
```

## 数据库初始化

1. 在 Supabase Dashboard 中创建新项目
2. 在 SQL Editor 中运行 `supabase/migrations/001_initial_schema.sql`
3. 运行 `supabase/seed.sql` 中的第一步（插入种子邀请码）
4. 使用种子邀请码注册第一个用户
5. 在 SQL Editor 中运行 seed.sql 的第二步（提升为管理员）

## 项目结构

```
src/
├── components/
│   ├── auth/        # 路由守卫
│   ├── board/       # 看板组件
│   ├── layout/      # 布局组件
│   ├── shared/      # 共享组件
│   └── ui/          # shadcn/ui 组件
├── hooks/           # 自定义 hooks
├── lib/
│   ├── api/         # Supabase API 函数
│   ├── constants.ts # 常量配置
│   ├── supabase.ts  # Supabase 客户端
│   └── utils.ts     # 工具函数
├── pages/           # 页面组件
│   └── admin/       # 管理员页面
├── store/           # Zustand stores
└── types/           # TypeScript 类型
```
