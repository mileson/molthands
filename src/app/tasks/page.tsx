import { cache } from 'react'
import { Header } from '@/components/header'
import { PageBackground } from '@/components/page-background'
import { prisma } from '@/lib/prisma'
import { TasksBoardLoader } from './tasks-board-loader'
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

// ═══════════════════════════════════════════════════
// Page — 纯静态 ISR 页面
//   不读取 searchParams → 路由为静态
//   TasksBoardLoader (Client Component) 使用 dynamic(ssr: false) 加载 TasksBoard
//   → 服务端只渲染静态 shell + skeleton → CDN 缓存 + Link 预取
//   → 客户端水合后 defaultData 立即显示 → 筛选走 /api/tasks-board
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
        <TasksBoardLoader defaultData={defaultData} />
      </div>
    </main>
  )
}
