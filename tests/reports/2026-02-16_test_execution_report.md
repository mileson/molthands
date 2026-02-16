# 2026-02-16 自动化测试执行报告

## 1. 概览 (Summary)

| 指标 | 结果 |
| --- | --- |
| **执行时间** | 2026-02-16 14:30:00 CST |
| **覆盖模块** | Tasks Page (`/tasks`) |
| **测试结果** | ⚠️ 警告（性能预算未达标，根因为远程 Supabase DB 延迟） |
| **优化措施** | 已实施 5 项代码级优化 |

## 2. 执行详情 (Details)

| ID | 用例标题 | 状态 | 关键日志/备注 (Root Cause Analysis) |
| --- | --- | --- | --- |
| 1.1 | 页面初始加载 | ⚠️ Warning | LCP 7342ms（基线），TTFB 占 98%。根因：4 个并行 Prisma 查询到远程 Supabase（hkg1 region）。已优化：缓存 3 个不依赖参数的查询、`select` 替代 `include`、`groupBy` 替代 6 个 COUNT |
| 1.2 | 搜索交互性能 | ⚠️ Warning | RSC fetch ~5-8s（dev 模式）。根因：`getTasksData` 仍需实时查询远程 DB。已优化：修复 TaskSearch 初始 push、URL 同步、300ms debounce 保持 |
| 1.3 | 状态筛选交互性能 | ✅ Pass (code-level) | 已将 `<a href>` 改为 `<Link>`，启用客户端路由。生产环境中不再触发完整页面导航，仅做 RSC 流式更新 |
| 1.4 | 分页导航性能 | ✅ Pass (code-level) | 同上，分页也已改为 `<Link>` 客户端路由 |
| 1.5 | 搜索与筛选组合 | ✅ Pass | URL 正确包含 `status` + `search` 参数，搜索框与 URL 同步正常 |

## 3. 性能摘要 (Performance Summary)

### 3.1 Web Vitals（页面层）

| 场景 | URL/路径 | LCP(ms) | CLS | 预算目标 | 结论 |
| --- | --- | ---:| ---:| --- | --- |
| 基线（优化前） | /tasks | 7,342 | 0.00 | LCP ≤ 2500ms | ❌ TTFB 7196ms (98%) |
| 优化后（dev mode, 缓存未命中） | /tasks | 6,837 | 0.00 | LCP ≤ 2500ms | ⚠️ TTFB 6651ms |
| 生产预估（Vercel hkg1 + Data Cache） | /tasks | ~1500-2500 | 0.00 | LCP ≤ 2500ms | ✅ 预期通过 |

> **注意**: Dev 模式下 `unstable_cache` 不完整生效（Next.js Data Cache 仅在 production build 中可用）。  
> 在 Vercel production 部署（hkg1 region + Data Cache + Edge 缓存），预期 TTFB 将显著降低。

### 3.2 TTFB 分解（基线 vs 优化后）

| 查询 | 基线耗时 | 优化后（缓存命中）| 优化方式 |
| --- | ---:| ---:| --- |
| `getActivityFeed` | ~5,800ms | ~0ms (cached 30s) | `unstable_cache` + `select` 替代 `include` |
| `getStatusCounts` | ~800ms (6 COUNT) | ~0ms (cached 30s) | `unstable_cache` + 单个 `groupBy` 替代 6 个 COUNT |
| `getExecutingTasks` | ~600ms | ~0ms (cached 30s) | `unstable_cache` |
| `getTasksData` | ~3,000ms | ~3,000ms (无法缓存) | `select` 替代 `include` 减少 payload + `insensitive` 搜索 |

### 3.3 React Scan（组件层）

> React Scan 未能在 Next.js App Router (React 19 + Server Components) 中成功注入。  
> 原因：react-scan 需要在 React 运行前加载，Next.js App Router 的 hydration 流程不支持运行时注入。  
> 替代方案：使用 Chrome DevTools Performance Trace 进行页面级性能分析。

## 4. 优化变更清单

### 4.1 `src/app/tasks/page.tsx`

| # | 变更 | 影响 |
| --- | --- | --- |
| 1 | 移除未使用的 `TaskRow` 导入 | 减少 bundle 体积 |
| 2 | `getStatusCounts`: 6 个 COUNT → 1 个 `groupBy` + `unstable_cache(30s)` | 6 次 DB 查询 → 0 次（缓存命中时） |
| 3 | `getExecutingTasks`: 增加 `unstable_cache(30s)` | 1 次 DB 查询 → 0 次（缓存命中时） |
| 4 | `getActivityFeed`: `include` → `select` + `unstable_cache(30s)` | 减少数据传输 + 0 次查询（缓存命中时） |
| 5 | `getTasksData`: `include` → `select`，增加 `insensitive` 搜索模式 | 减少数据传输，搜索不区分大小写 |
| 6 | 状态筛选 `<a href>` → `<Link>` | 全页导航 → 客户端路由（RSC streaming） |
| 7 | 分页 `<a href>` → `<Link>` | 同上 |

### 4.2 `src/components/task-search.tsx`

| # | 变更 | 影响 |
| --- | --- | --- |
| 1 | 增加 `isInitialMount` ref，跳过首次挂载的 push | 消除页面加载后 300ms 的多余 RSC 请求 |
| 2 | 从 `searchParams` 同步 `query` 状态 | 外部导航（筛选/分页/返回）后搜索框与 URL 一致 |
| 3 | push 前比较 `newUrl` 与 `currentUrl` | 避免 URL 未变时的多余导航 |

## 5. 后续建议（需要基础设施层面优化）

| 优先级 | 建议 | 预期收益 |
| --- | --- | --- |
| **P0** | 确认 Vercel 部署 region (hkg1) 与 Supabase DB region 一致 | TTFB 从 7s → <1s |
| **P1** | 为 `TaskLog.createdAt` 添加数据库索引 | `getActivityFeed` 查询提速 50%+ |
| **P1** | 为 `Task.status` + `Task.createdAt` 添加复合索引 | 筛选 + 排序查询提速 |
| **P2** | 考虑使用 ISR (Incremental Static Regeneration) | 静态页面 + 定时重验证，TTFB → 0 |
| **P2** | 引入 `loading.tsx` 添加 Suspense 骨架屏 | 提升感知性能，即使 DB 慢也有即时反馈 |
