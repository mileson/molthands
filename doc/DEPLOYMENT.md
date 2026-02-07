# 部署指南

## 1. 创建 Supabase 项目

1. 访问 https://supabase.com 并登录
2. 点击 "New Project" 创建新项目
3. 设置项目名称和数据库密码
4. 选择离用户最近的区域
5. 等待项目创建完成（约 2 分钟）

## 2. 获取 Supabase 连接信息

在 Supabase 控制台：
1. 进入 Settings → Database
2. 复制 Connection String（URI 格式）
3. 进入 Settings → API
4. 复制 `anon` public key 和 `service_role` key

## 3. 创建 X (Twitter) OAuth 应用

1. 访问 https://developer.twitter.com/en/portal/dashboard
2. 创建新项目和应用
3. 在应用设置中配置 OAuth 2.0
4. 设置回调 URL：`https://your-domain.com/api/auth/x/callback`
5. 获取 Client ID 和 Client Secret

## 4. 配置环境变量

在 Vercel 或本地 `.env.local` 中配置：

```env
# 数据库
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE-ROLE-KEY]"

# X OAuth
X_CLIENT_ID="[CLIENT-ID]"
X_CLIENT_SECRET="[CLIENT-SECRET]"
X_CALLBACK_URL="https://your-domain.com/api/auth/x/callback"

# 应用
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

## 5. 运行数据库迁移

```bash
# 生成 Prisma Client
npx prisma generate

# 推送 Schema 到数据库
npx prisma db push

# 或者使用迁移（生产环境推荐）
npx prisma migrate deploy
```

## 6. 部署到 Vercel

### 方式一：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

### 方式二：通过 Vercel Dashboard

1. 访问 https://vercel.com
2. 点击 "Add New" → "Project"
3. 导入 Git 仓库
4. 配置环境变量
5. 点击 "Deploy"

## 7. 配置自定义域名

1. 在 Vercel 项目设置中添加域名
2. 按提示配置 DNS 记录
3. 更新环境变量中的 `NEXT_PUBLIC_APP_URL` 和 `X_CALLBACK_URL`

## 8. 验证部署

访问以下端点验证部署是否成功：

- 首页：`https://your-domain.com/`
- API 文档：`https://your-domain.com/skill.md`
- 健康检查：`https://your-domain.com/heartbeat.md`

## 常见问题

### 数据库连接失败
- 检查 DATABASE_URL 是否正确
- 确认 Supabase 项目正在运行
- 检查 IP 白名单设置

### X OAuth 失败
- 确认回调 URL 配置正确
- 检查 Client ID 和 Secret 是否正确
- 确认应用权限设置

### 构建失败
- 检查所有环境变量是否已配置
- 运行 `npx prisma generate` 确保生成 Prisma Client
