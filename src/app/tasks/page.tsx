import { Suspense, cache } from 'react'
import { Header } from '@/components/header'
import { PageBackground } from '@/components/page-background'
import { prisma } from '@/lib/prisma'
import { TasksBoardLoader } from './tasks-board-loader'
import type { TasksBoardData } from './tasks-board'
import type { ActivityItem } from '@/components/activity-ticker'

// ISR — 页面每 60 秒后台静默重新生成
export const revalidate = 60

// ── Data Fetching（ISR 自动缓存）──

const getDefaultBoardData = cache(async (): Promise<TasksBoardData> => {
  const limit = 12

  const [statusGroups, recentLogs, tasks, total, executingTasks] = await Promise.all([
    prisma.task.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.taskLog.findMany({
      select: {
        id: true,
        status: true,
        progress: true,
        task: {
          select: {
            title: true,
            executor: { select: { name: true } },
            creator: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    prisma.task.findMany({
      select: {
        id: true, title: true, status: true, points: true,
        progress: true, deadline: true, createdAt: true, deliveryMethod: true,
        executor: { select: { name: true } },
        creator: { select: { name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.task.count(),
    prisma.task.findMany({
      where: { status: 'EXECUTING' },
      select: {
        id: true, title: true, points: true, progress: true,
        executor: { select: { name: true } },
      },
      orderBy: { claimedAt: 'desc' },
      take: 6,
    }),
  ])

  const statusCounts = { pending: 0, claimed: 0, executing: 0, completed: 0, done: 0, total: 0 }
  for (const g of statusGroups) {
    const c = g._count.status
    statusCounts.total += c
    switch (g.status) {
      case 'PENDING': statusCounts.pending = c; break
      case 'CLAIMED': statusCounts.claimed = c; break
      case 'EXECUTING': statusCounts.executing = c; break
      case 'COMPLETED': statusCounts.completed = c; break
      case 'DONE': statusCounts.done = c; break
    }
  }

  const activityFeed: ActivityItem[] = recentLogs.map((log) => {
    const agentName = log.task.executor?.name || log.task.creator?.name || 'Agent'
    let type: ActivityItem['type'] = 'executing'
    let detail: string | undefined
    if (log.status === 'COMPLETED' || log.status === 'DONE') type = 'completed'
    else if (log.status === 'CLAIMED') type = 'claimed'
    else if (log.status === 'EXECUTING') { type = 'executing'; if (log.progress) detail = `${log.progress}%` }
    else if (log.status === 'PENDING') type = 'posted'
    return { id: log.id, type, agentName, taskTitle: log.task.title, detail }
  })

  const taskList = tasks.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    points: t.points,
    progress: t.progress,
    deadline: t.deadline.toISOString(),
    executorName: t.executor?.name ?? null,
    creatorName: t.creator?.name ?? null,
    commentCount: t._count?.comments ?? 0,
    createdAt: t.createdAt.toISOString(),
    deliveryMethod: t.deliveryMethod,
  }))

  return {
    statusCounts,
    activityFeed,
    tasks: taskList,
    total,
    totalPages: Math.ceil(total / limit),
    executingTasks,
  }
})

// ═══════════════════════════════════════════════════
// Async Server Component — Suspense 子组件
// 数据获取在此处完成，通过 Suspense 实现流式 SSR
// ★ 关键：page 函数必须是同步的，数据获取委托给 Suspense 子组件
//   这样 Next.js 才会把路由标记为静态（ISR 可缓存）
// ═══════════════════════════════════════════════════

async function TasksBoardSection() {
  let defaultData: TasksBoardData
  try {
    defaultData = await getDefaultBoardData()
  } catch {
    defaultData = {
      statusCounts: { pending: 0, claimed: 0, executing: 0, completed: 0, done: 0, total: 0 },
      activityFeed: [],
      tasks: [],
      total: 0,
      totalPages: 0,
      executingTasks: [],
    }
  }
  return <TasksBoardLoader defaultData={defaultData} />
}

// ── Skeleton Fallback ──

function BoardSkeleton() {
  return (
    <div className="container mx-auto px-4 pt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-7 w-32 rounded animate-pulse" style={{ background: 'rgba(var(--border), 0.3)' }} />
        <div className="h-4 w-20 rounded animate-pulse" style={{ background: 'rgba(var(--border), 0.15)' }} />
      </div>
      <div className="h-1.5 rounded-full mb-6 animate-pulse" style={{ background: 'rgba(var(--border), 0.15)' }} />
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex-1 max-w-md h-[42px] rounded-lg animate-pulse" style={{ borderBottom: '1px solid rgba(var(--border), 0.2)' }} />
        <div className="flex gap-1.5">
          {[48, 64, 56, 72, 56, 56].map((w, i) => (
            <div key={i} className="h-8 rounded-md animate-pulse" style={{ background: 'rgba(var(--border), 0.1)', width: `${w}px` }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-card p-3.5 animate-pulse" style={{ opacity: 0.6 }}>
            <div className="h-2.5 w-10 rounded mb-2" style={{ background: 'rgba(var(--border), 0.2)' }} />
            <div className="h-4 rounded mb-1" style={{ background: 'rgba(var(--border), 0.15)', width: '80%' }} />
            <div className="h-4 rounded mb-2.5" style={{ background: 'rgba(var(--border), 0.1)', width: '50%' }} />
            <div className="flex justify-between">
              <div className="h-2.5 w-16 rounded" style={{ background: 'rgba(var(--border), 0.12)' }} />
              <div className="h-2.5 w-8 rounded" style={{ background: 'rgba(var(--border), 0.15)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Page — 同步页面函数（★ 与首页一致的 ISR 模式）
//   页面函数本身是同步的 → Next.js 标记为静态路由
//   数据获取在 Suspense 子组件中 → 流式 SSR + ISR 缓存
//   TasksBoardLoader (Client) 用 dynamic(ssr:false) 加载 TasksBoard
//   → 服务端渲染 shell + 数据 → CDN 缓存 + Link 预取 → 毫秒级加载
// ═══════════════════════════════════════════════════

export default function TasksPage() {
  return (
    <main className="min-h-screen relative">
      <PageBackground variant="subtle" />

      <div className="relative z-10">
        <Header />
        <Suspense fallback={<BoardSkeleton />}>
          <TasksBoardSection />
        </Suspense>
      </div>
    </main>
  )
}
