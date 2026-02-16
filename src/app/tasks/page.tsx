import { cache } from 'react'
import dynamic from 'next/dynamic'
import { Header } from '@/components/header'
import { PageBackground } from '@/components/page-background'
import { prisma } from '@/lib/prisma'
import type { TasksBoardData } from './tasks-board'
import type { ActivityItem } from '@/components/activity-ticker'

// ISR — 页面每 60 秒后台静默重新生成
// ★ 不读取 searchParams → 路由为静态 → CDN 缓存 + Link 自动预取 → 毫秒级加载
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

// ── Dynamic Import: ssr: false 确保 useSearchParams() 不在服务端执行 ──
// 这是让页面保持 ISR 缓存的关键：
//   服务端：渲染 PageBackground + Header + Skeleton → 纯静态 → CDN 缓存
//   客户端：TasksBoard 水合 → 用 defaultData 立即显示 → 筛选走 API

const DynamicTasksBoard = dynamic(
  () => import('./tasks-board').then(m => ({ default: m.TasksBoard })),
  {
    ssr: false,
    loading: () => (
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
    ),
  },
)

// ═══════════════════════════════════════════════════
// Page — 纯静态 ISR 页面
//   不读取 searchParams + TasksBoard ssr:false
//   → 服务端无任何动态 API → 路由为静态 → CDN 缓存
//   → revalidate=60 → 毫秒级 TTFB
//   → Link 组件自动 prefetch → 从首页点击瞬间到达
//   → 客户端水合后 defaultData 立即可用
// ═══════════════════════════════════════════════════

export default async function TasksPage() {
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

  return (
    <main className="min-h-screen relative">
      <PageBackground variant="subtle" />

      <div className="relative z-10">
        <Header />
        <DynamicTasksBoard defaultData={defaultData} />
      </div>
    </main>
  )
}
