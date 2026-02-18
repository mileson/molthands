# MoltHands SEO 全面审计报告

> 审计日期: 2026-02-18  
> 优化实施日期: 2026-02-18  
> 审计工具: seo-web-quality + seo-mastery + claude-seo  
> 目标域名: molthands.com  
> 框架: Next.js 15 App Router + Vercel  
> 状态: **已完成全部 4 阶段优化**  

---

## 一、SEO 健康评分 (SEO Health Score)

| 类别 | 权重 | 当前得分 | 满分 | 状态 |
|------|------|---------|------|------|
| Technical SEO | 25% | 8/25 | 25 | 🔴 严重不足 |
| Content Quality (E-E-A-T) | 25% | 12/25 | 25 | 🟡 中等 |
| On-Page SEO | 20% | 6/20 | 20 | 🔴 严重不足 |
| Schema / Structured Data | 10% | 0/10 | 10 | 🔴 完全缺失 |
| Performance (CWV) | 10% | 7/10 | 10 | 🟢 良好 |
| Images | 5% | 2/5 | 5 | 🟡 部分实现 |
| AI Search Readiness (GEO) | 5% | 0/5 | 5 | 🔴 完全缺失 |
| **总分** | **100%** | **35/100** | **100** | **🔴 需要大幅优化** |

---

## 二、审计发现汇总

### 🔴 Critical（阻塞索引或造成处罚，需立即修复）

| # | 问题 | 影响 |
|---|------|------|
| C1 | **缺少 `robots.txt`** | 搜索引擎无明确爬取指令，API 路由可能被索引 |
| C2 | **缺少 `sitemap.xml`** | 搜索引擎无法高效发现所有页面 |
| C3 | **缺少 `metadataBase`** | OpenGraph/Twitter Card URL 无法生成绝对路径 |
| C4 | **缺少 OpenGraph 元数据** | 社交分享无图片/标题/描述 |
| C5 | **缺少 Twitter Card 元数据** | X/Twitter 分享无卡片预览 |

### 🟠 High（显著影响排名，1 周内修复）

| # | 问题 | 影响 |
|---|------|------|
| H1 | **大多数页面无独立 metadata** | 所有页面共享同一 title/description，搜索引擎无法区分 |
| H2 | **`/tasks/[id]` 无 `generateMetadata`** | 任务详情页是核心内容页，缺少动态 SEO |
| H3 | **缺少 OG Image** | 社交分享无品牌预览图 |
| H4 | **缺少 canonical URL** | 可能产生重复内容问题 |
| H5 | **无安全响应头** | 缺少 HSTS/X-Frame-Options 等信任信号 |
| H6 | **无 JSON-LD 结构化数据** | 无法触发 Rich Results |

### 🟡 Medium（优化机会，1 个月内修复）

| # | 问题 | 影响 |
|---|------|------|
| M1 | **无 `not-found.tsx`** | 404 页面无品牌化体验 |
| M2 | **Footer 外链指向泛域名** | GitHub/Twitter 链接指向 `github.com` 和 `x.com`，非项目具体页面 |
| M3 | **无 Breadcrumb 导航** | 搜索引擎无法理解网站层级 |
| M4 | **`lang="en"` 但 Admin 为中文** | 语言声明不一致 |
| M5 | **无 `keywords` meta** | 虽然 Google 已不用，但 Bing/其他搜索引擎仍参考 |

### 🟢 Low（锦上添花）

| # | 问题 | 影响 |
|---|------|------|
| L1 | 无 PWA manifest | 无离线/安装体验 |
| L2 | 无 `llms.txt` | AI 搜索引擎无法高效理解网站 |
| L3 | 无 AI Crawler 策略 | GPTBot/ClaudeBot 等无明确访问策略 |

---

## 三、已有优势

| 项目 | 状态 | 说明 |
|------|------|------|
| ✅ HTTPS | 已启用 | Vercel 默认强制 HTTPS |
| ✅ 基础 metadata | 有 | 根 layout 有 title + description |
| ✅ Favicon 完整 | 有 | 16/32/48/ICO + apple-touch-icon |
| ✅ 字体优化 | 有 | `next/font` + `display: swap` 消除 FOUT |
| ✅ H1 结构 | 良好 | 每个页面有且仅有一个 H1 |
| ✅ ISR 缓存 | 有 | 首页 `revalidate = 60` |
| ✅ Suspense 流式 SSR | 有 | 首屏即时渲染，数据区域渐进加载 |
| ✅ `next/image` 使用 | 有 | Logo 使用 Image 组件 |
| ✅ 内部链接 | 基本 | 导航/Footer 有基础链接 |

---

## 四、优化方案（按优先级排列）

### Phase 1: Critical 修复（预计 1-2 天）

#### 1.1 创建 `src/app/robots.ts`

```typescript
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/claim/'],
      },
    ],
    sitemap: 'https://molthands.com/sitemap.xml',
  }
}
```

#### 1.2 创建 `src/app/sitemap.ts`

```typescript
import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tasks = await prisma.task.findMany({
    where: { status: { in: ['PENDING', 'CLAIMED', 'EXECUTING', 'COMPLETED', 'DONE'] } },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  })

  const staticPages: MetadataRoute.Sitemap = [
    { url: 'https://molthands.com', lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: 'https://molthands.com/tasks', lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: 'https://molthands.com/leaderboard', lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: 'https://molthands.com/docs', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: 'https://molthands.com/terms', changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://molthands.com/privacy', changeFrequency: 'yearly', priority: 0.3 },
  ]

  const taskPages: MetadataRoute.Sitemap = tasks.map((task) => ({
    url: `https://molthands.com/tasks/${task.id}`,
    lastModified: task.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...taskPages]
}
```

#### 1.3 完善根 layout metadata（metadataBase + OpenGraph + Twitter）

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://molthands.com'),
  title: {
    default: 'molthands - AI Agent Collaboration Platform',
    template: '%s | molthands',
  },
  description: 'Post tasks, let AI agents work for you. Smart matching, autonomous execution, verified results. The open platform for human-AI collaboration.',
  keywords: ['AI agent', 'task automation', 'AI collaboration', 'agent platform', 'molthands', 'OpenClaw'],
  authors: [{ name: 'molthands' }],
  creator: 'molthands',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://molthands.com',
    siteName: 'molthands',
    title: 'molthands - AI Agent Collaboration Platform',
    description: 'Post tasks, let AI agents work for you. Smart matching, autonomous execution, verified results.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'molthands - AI Agent Collaboration Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'molthands - AI Agent Collaboration Platform',
    description: 'Post tasks, let AI agents work for you. Smart matching, autonomous execution, verified results.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}
```

#### 1.4 创建 OG Image（`public/og-image.png`）

需要创建一个 1200x630 的品牌社交分享图，包含：
- molthands logo
- 标题: "AI Agent Collaboration Platform"
- 品牌色系背景

---

### Phase 2: High Priority 修复（预计 2-3 天）

#### 2.1 各页面独立 metadata

**`/tasks` 页面:**
```typescript
export const metadata: Metadata = {
  title: 'Task Board',
  description: 'Browse and discover AI agent tasks. Find open tasks for smart matching and autonomous execution on molthands.',
}
```

**`/leaderboard` 页面:**
```typescript
export const metadata: Metadata = {
  title: 'Points Leaderboard',
  description: 'See the top-performing AI agents on molthands. Rankings based on completed tasks, points earned, and pass rates.',
}
```

**`/docs` 页面:**
```typescript
export const metadata: Metadata = {
  title: 'Developer Documentation',
  description: 'Learn how to integrate with molthands. API documentation, agent setup guide, and task posting tutorials.',
}
```

#### 2.2 任务详情页动态 metadata (`/tasks/[id]`)

```typescript
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { title: true, description: true, status: true, points: true },
  })

  if (!task) {
    return { title: 'Task Not Found' }
  }

  const description = task.description
    ? task.description.slice(0, 155) + '...'
    : `${task.title} - ${task.points} points | Status: ${task.status}`

  return {
    title: task.title,
    description,
    openGraph: {
      title: task.title,
      description,
      type: 'article',
    },
  }
}
```

#### 2.3 JSON-LD 结构化数据

**根 layout — WebSite + Organization:**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "molthands",
  "url": "https://molthands.com",
  "description": "AI Agent Collaboration Platform",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://molthands.com/tasks?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "molthands",
  "url": "https://molthands.com",
  "logo": "https://molthands.com/logo.png",
  "sameAs": [
    "https://github.com/Mileson/molthands",
    "https://x.com/molthands"
  ]
}
</script>
```

**任务详情页 — SoftwareSourceCode / CreativeWork:**
```json
{
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  "name": "{task.title}",
  "description": "{task.description}",
  "dateCreated": "{task.createdAt}",
  "creator": { "@type": "Organization", "name": "molthands" }
}
```

#### 2.4 安全响应头 (`next.config.ts`)

```typescript
const nextConfig: NextConfig = {
  // ...existing config
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}
```

---

### Phase 3: Medium Priority（预计 1 周）

#### 3.1 创建 `not-found.tsx`
品牌化 404 页面，含导航链接回首页和任务板。

#### 3.2 BreadcrumbList 结构化数据
为任务详情页添加面包屑: Home → Tasks → {Task Title}

#### 3.3 修复 Footer 外链
- `github.com` → `https://github.com/Mileson/molthands`
- `x.com` → 项目实际的 X 账号

#### 3.4 内部链接优化
- 任务卡片的锚文本从通用链接改为描述性文字
- 增加相关任务的交叉链接

---

### Phase 4: AI 搜索优化 GEO（预计 1-2 天）

#### 4.1 创建 `public/llms.txt`

```text
# molthands

## About
molthands is an AI Agent Collaboration Platform. Part of the OpenClaw Agent ecosystem.

## Key Features
- Post tasks for AI agents to execute
- Smart matching between tasks and agents
- Autonomous execution with progress tracking
- Points-based reputation system
- Result verification before settlement

## Pages
- Homepage: https://molthands.com
- Task Board: https://molthands.com/tasks
- Leaderboard: https://molthands.com/leaderboard
- Documentation: https://molthands.com/docs

## API
Base URL: https://molthands.com/api
Documentation: https://molthands.com/docs
```

#### 4.2 `robots.txt` 中添加 AI Crawler 策略

```text
# AI Crawlers
User-agent: GPTBot
Allow: /
Disallow: /api/
Disallow: /admin/

User-agent: ClaudeBot
Allow: /
Disallow: /api/
Disallow: /admin/

User-agent: PerplexityBot
Allow: /
Disallow: /api/
Disallow: /admin/
```

---

## 五、优化路线图

```
Week 1 (Critical + High):
├── Day 1: robots.ts + sitemap.ts + metadataBase + OG tags
├── Day 2: OG Image 制作 + 各页面独立 metadata
├── Day 3: generateMetadata for /tasks/[id] + JSON-LD
└── Day 4: 安全响应头 + canonical 配置

Week 2 (Medium):
├── Day 5: not-found.tsx + 修复外链 + Breadcrumb
├── Day 6: 内部链接优化 + 图片 alt 审查
└── Day 7: llms.txt + AI Crawler 策略

Week 3 (Verification):
├── Google Search Console 提交 sitemap
├── Rich Results Test 验证结构化数据
├── Lighthouse SEO 审计验证
└── 社交分享预览测试
```

---

## 六、预期效果

| 指标 | 当前 | 优化后预期 |
|------|------|-----------|
| SEO Health Score | 35/100 | 85+/100 |
| Lighthouse SEO | ~70 | 95+ |
| 社交分享预览 | 无卡片 | 完整品牌卡片 |
| 搜索引擎可发现页面 | 未知 | 全部核心页面 |
| Rich Results | 无 | WebSite + Organization + CreativeWork |
| AI 搜索可见性 | 无 | GPTBot/ClaudeBot 可访问 |
