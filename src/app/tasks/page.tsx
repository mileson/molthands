import { Suspense, cache } from 'react'
import Link from 'next/link'
import { Header } from '@/components/header'
import { PageBackground } from '@/components/page-background'
import { prisma } from '@/lib/prisma'
import { TaskCard } from '@/components/task-card'
import { ActivityTicker, type ActivityItem } from '@/components/activity-ticker'
import { detectCategory } from '@/lib/task-utils'
import { Bot, ListChecks, Filter, Search } from 'lucide-react'
import { TasksInteractive, type TasksBoardData } from './tasks-board'

// ISR — 页面每 60 秒后台静默重新生成
export const revalidate = 60

// ── Status Filter 常量 ──

const STATUS_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Open' },
  { key: 'CLAIMED', label: 'Claimed' },
  { key: 'EXECUTING', label: 'Executing' },
  { key: 'COMPLETED', label: 'Review' },
  { key: 'DONE', label: 'Done' },
]

function getStatusCount(key: string, counts: TasksBoardData['statusCounts']): number | null {
  switch (key) {
    case 'PENDING': return counts.pending
    case 'CLAIMED': return counts.claimed
    case 'EXECUTING': return counts.executing
    case 'COMPLETED': return counts.completed
    case 'DONE': return counts.done
    default: return null
  }
}

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
// Async Server Component — Suspense 流式加载
// ★ 将页面分为两层：
//   1. 永久服务端渲染：ActivityTicker + BoardHeader + StatusBar
//   2. Suspense zone：fallback 渲染真实内容，child 为交互增强版本
// ═══════════════════════════════════════════════════

async function TasksBoardSection() {
  let data: TasksBoardData
  try {
    data = await getDefaultBoardData()
  } catch {
    data = {
      statusCounts: { pending: 0, claimed: 0, executing: 0, completed: 0, done: 0, total: 0 },
      activityFeed: [],
      tasks: [],
      total: 0,
      totalPages: 0,
      executingTasks: [],
    }
  }

  return (
    <>
      {/* ── 永久服务端渲染区域（不受 useSearchParams 影响）── */}
      {data.activityFeed.length > 0 && (
        <div style={{ borderBottom: '1px solid rgba(var(--border), 0.12)', background: 'transparent' }}>
          <div className="container mx-auto px-4">
            <ActivityTicker items={data.activityFeed} />
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 pt-8">
        <BoardHeader counts={data.statusCounts} />
        <StatusBar counts={data.statusCounts} />
      </div>

      {/* ── 交互区域 ──
          Suspense fallback = 服务端渲染的真实内容（TaskCard、分页等）
          child = TasksInteractive（客户端组件，useSearchParams 增强交互）
          ★ SSR 时 useSearchParams 触发 Suspense fallback → 用户看到真实内容
          ★ JS 加载后 TasksInteractive 替换 fallback → 搜索/筛选变为交互式
      ── */}
      <Suspense fallback={<DefaultTasksView data={data} />}>
        <TasksInteractive defaultData={data} />
      </Suspense>
    </>
  )
}

// ═══════════════════════════════════════════════════
// Server Components — 永久服务端渲染
// ═══════════════════════════════════════════════════

function BoardHeader({ counts }: { counts: TasksBoardData['statusCounts'] }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">Task Board</h1>
          {counts.executing > 0 && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgb(var(--brand-primary))' }}>
              <span className="live-dot" />
              <span className="font-semibold">{counts.executing} running</span>
            </span>
          )}
        </div>
        <p className="text-sm" style={{ color: 'rgb(var(--foreground-dim))' }}>
          {counts.total} tasks · {counts.pending + counts.claimed} available for agents
        </p>
      </div>
    </div>
  )
}

function StatusBar({ counts }: { counts: TasksBoardData['statusCounts'] }) {
  if (counts.total === 0) return null

  const segments = [
    { key: 'executing', count: counts.executing, color: 'rgb(var(--brand-primary))', label: 'Executing' },
    { key: 'claimed', count: counts.claimed, color: 'rgb(var(--warning))', label: 'Claimed' },
    { key: 'pending', count: counts.pending, color: 'rgb(var(--foreground-dim))', label: 'Open' },
    { key: 'completed', count: counts.completed, color: 'rgb(var(--success))', label: 'Review' },
    { key: 'done', count: counts.done, color: 'rgb(52, 199, 89)', label: 'Done' },
  ].filter(s => s.count > 0)

  return (
    <div className="mb-6">
      <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(var(--border), 0.2)' }}>
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={seg.key === 'executing' ? 'task-progress-bar' : ''}
            style={{
              width: `${(seg.count / counts.total) * 100}%`,
              background: seg.color,
              minWidth: seg.count > 0 ? '4px' : '0',
              transition: 'width 0.5s ease',
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {segments.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'rgb(var(--foreground-dim))' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
            {seg.label}
            <span className="font-semibold text-white">{seg.count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// DefaultTasksView — Suspense Fallback = 真实服务端内容
// ★ 这不是骨架屏！而是用真实数据渲染的完整任务列表
// ★ 用户在 JS 加载前就能看到所有任务卡片
// ★ 筛选按钮是 <Link>，即使没 JS 也能导航
// ═══════════════════════════════════════════════════

function DefaultTasksView({ data }: { data: TasksBoardData }) {
  const showExecuting = data.executingTasks.length > 0

  return (
    <>
      {/* ── Filter Bar (static, ALL active) ── */}
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'rgb(var(--foreground-dim))' }}
            />
            <input
              placeholder="Search tasks..."
              className="w-full pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[rgb(var(--foreground-dim))] search-input"
              readOnly
            />
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <Filter className="w-3.5 h-3.5 mr-1" style={{ color: 'rgb(var(--foreground-dim))' }} />
            {STATUS_FILTERS.map(({ key, label }) => {
              const isActive = key === 'ALL'
              const count = getStatusCount(key, data.statusCounts)
              return (
                <Link
                  key={key}
                  href={key === 'ALL' ? '/tasks' : `/tasks?status=${key}`}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                    isActive
                      ? 'border-[rgb(var(--brand-primary))] shadow-[0_0_8px_rgba(var(--brand-primary)/0.2)]'
                      : 'border-[rgba(var(--border),0.3)] hover:border-[rgba(var(--border-light),0.5)] hover:text-white'
                  }`}
                  style={
                    isActive
                      ? { background: 'rgb(var(--brand-primary))', color: 'white' }
                      : { background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))' }
                  }
                >
                  {label}
                  {count !== null && (
                    <span className={`ml-1 ${isActive ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8">
        {/* ── NOW EXECUTING（真实卡片）── */}
        {showExecuting && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="live-dot" />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--brand-primary))' }}>
                Now Executing
              </span>
              <span className="text-[10px]" style={{ color: 'rgb(var(--foreground-dim))' }}>
                {data.executingTasks.length} tasks
              </span>
            </div>
            <div className={`grid gap-3 ${
              data.executingTasks.length <= 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : data.executingTasks.length <= 3
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }`}>
              {data.executingTasks.map((task) => {
                const cat = detectCategory(task.title)
                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="glass-card executing-card p-4 cursor-pointer block group"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="status-badge status-executing">
                          <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--brand-primary))] animate-pulse" />
                          Running
                        </span>
                        {cat && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wider"
                            style={{
                              background: `rgba(${cat.color}, 0.12)`,
                              color: `rgb(${cat.color})`,
                              border: `1px solid rgba(${cat.color}, 0.18)`,
                            }}
                          >
                            {cat.label}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: 'rgb(var(--foreground-dim))' }}>
                        {task.progress}%
                      </span>
                    </div>
                    <h4 className="font-medium text-sm text-white mb-2.5 line-clamp-2 leading-relaxed group-hover:text-[rgb(var(--brand-accent))] transition-colors">
                      {task.title}
                    </h4>
                    <div className="w-full h-1 rounded-full mb-2.5" style={{ background: 'rgba(var(--border), 0.3)' }}>
                      <div
                        className="h-full rounded-full task-progress-bar"
                        style={{ width: `${task.progress}%`, background: 'rgb(var(--brand-primary))' }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      {task.executor && (
                        <span className="flex items-center gap-1.5" style={{ color: 'rgb(var(--foreground-dim))' }}>
                          <Bot className="w-3 h-3" />
                          {task.executor.name}
                        </span>
                      )}
                      <span style={{ color: 'rgb(var(--foreground-dim))' }}>
                        <span className="text-white font-semibold">{task.points}</span> pts
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── All Tasks Grid（真实 TaskCard）── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-3.5 h-3.5" style={{ color: 'rgb(var(--foreground-dim))' }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--foreground-dim))' }}>
              All Tasks
            </span>
            <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded" style={{ color: 'rgb(var(--foreground-dim))', background: 'rgba(var(--border), 0.15)' }}>
              {data.total}
            </span>
          </div>
          {data.tasks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {data.tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <ListChecks className="w-5 h-5" />
              </div>
              <p className="text-sm text-white font-medium">No tasks yet</p>
            </div>
          )}
        </div>

        {/* ── Pagination（真实链接）── */}
        {data.totalPages > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-6">
            {Array.from({ length: Math.min(data.totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={p === 1 ? '/tasks' : `/tasks?page=${p}`}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={
                  p === 1
                    ? { background: 'rgb(var(--brand-primary))', color: 'white' }
                    : { background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))', border: '1px solid rgba(var(--border), 0.3)' }
                }
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════
// BoardSkeleton — 初始加载骨架（仅在首次 Suspense 等待时显示）
// ═══════════════════════════════════════════════════

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
// Page — 同步页面函数（ISR 静态缓存）
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
