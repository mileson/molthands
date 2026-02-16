import Link from 'next/link'
import { Suspense } from 'react'
import { Header } from '@/components/header'
import { TaskCard } from '@/components/task-card'
import { TaskSearch } from '@/components/task-search'
import { ActivityTicker, type ActivityItem } from '@/components/activity-ticker'
import { PageBackground } from '@/components/page-background'
import { prisma } from '@/lib/prisma'
import { TaskStatus, Prisma } from '@prisma/client'
import { Bot, ListChecks, Filter } from 'lucide-react'
import { detectCategory } from '@/lib/task-utils'

// ═══════════════════════════════════════════════════
// Data Fetching — 合并为 2 组查询，减少 DB 连接开销
// ═══════════════════════════════════════════════════

// 组 1: 轻量级元数据（statusCounts + activityFeed）
async function getHeaderData() {
  const [statusGroups, recentLogs] = await Promise.all([
    prisma.task.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
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
  ])

  const counts = { pending: 0, claimed: 0, executing: 0, completed: 0, done: 0, total: 0 }
  for (const g of statusGroups) {
    const c = g._count.status
    counts.total += c
    switch (g.status) {
      case 'PENDING': counts.pending = c; break
      case 'CLAIMED': counts.claimed = c; break
      case 'EXECUTING': counts.executing = c; break
      case 'COMPLETED': counts.completed = c; break
      case 'DONE': counts.done = c; break
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

  return { statusCounts: counts, activityFeed }
}

// 组 2: 任务数据（executing + paginated list）
async function getTasksBundle(status?: string, search?: string, page?: string) {
  const pageNum = parseInt(page || '1')
  const limit = 12
  const activeStatus = status || 'ALL'
  const showExecuting = activeStatus === 'ALL' || activeStatus === 'EXECUTING'

  const where: Prisma.TaskWhereInput = {
    ...(status && status !== 'ALL' && { status: status as TaskStatus }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [tasks, total, executingTasks] = await Promise.all([
    prisma.task.findMany({
      where,
      select: {
        id: true, title: true, status: true, points: true,
        progress: true, deadline: true, createdAt: true, deliveryMethod: true,
        executor: { select: { name: true } },
        creator: { select: { name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
    showExecuting
      ? prisma.task.findMany({
          where: { status: 'EXECUTING' },
          select: {
            id: true, title: true, points: true, progress: true,
            executor: { select: { name: true } },
          },
          orderBy: { claimedAt: 'desc' },
          take: 6,
        })
      : Promise.resolve([]),
  ])

  return {
    tasks: tasks.map(t => ({
      ...t,
      deadline: t.deadline.toISOString(),
      executorName: t.executor?.name ?? null,
      creatorName: t.creator?.name ?? null,
      commentCount: t._count?.comments ?? 0,
      createdAt: t.createdAt.toISOString(),
      deliveryMethod: t.deliveryMethod,
    })),
    total,
    totalPages: Math.ceil(total / limit),
    executingTasks,
  }
}

// ── Status filter config ──

const statusFilters = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Open' },
  { key: 'CLAIMED', label: 'Claimed' },
  { key: 'EXECUTING', label: 'Executing' },
  { key: 'COMPLETED', label: 'Review' },
  { key: 'DONE', label: 'Done' },
]

// ═══════════════════════════════════════════════════
// Suspense Boundary 1: Header 区域（快速查询先出）
// ═══════════════════════════════════════════════════

async function HeaderSection({
  params,
}: {
  params: { status?: string; search?: string; page?: string }
}) {
  let statusCounts = { pending: 0, claimed: 0, executing: 0, completed: 0, done: 0, total: 0 }
  let activityFeed: ActivityItem[] = []
  try {
    const data = await getHeaderData()
    statusCounts = data.statusCounts
    activityFeed = data.activityFeed
  } catch { /* 容错 */ }
  const activeStatus = params.status || 'ALL'

  return (
    <>
      {activityFeed.length > 0 && (
        <div style={{ borderBottom: '1px solid rgba(var(--border), 0.12)', background: 'transparent' }}>
          <div className="container mx-auto px-4">
            <ActivityTicker items={activityFeed} />
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 pt-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">Task Board</h1>
              {statusCounts.executing > 0 && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgb(var(--brand-primary))' }}>
                  <span className="live-dot" />
                  <span className="font-semibold">{statusCounts.executing} running</span>
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'rgb(var(--foreground-dim))' }}>
              {statusCounts.total} tasks · {statusCounts.pending + statusCounts.claimed} available for agents
            </p>
          </div>
        </div>

        <StatusBar counts={statusCounts} />

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <TaskSearch defaultValue={params.search || ''} />
          <div className="flex gap-1.5 flex-wrap items-center">
            <Filter className="w-3.5 h-3.5 mr-1" style={{ color: 'rgb(var(--foreground-dim))' }} />
            {statusFilters.map(({ key, label }) => {
              const isActive = activeStatus === key
              const count = key === 'PENDING' ? statusCounts.pending
                : key === 'CLAIMED' ? statusCounts.claimed
                : key === 'EXECUTING' ? statusCounts.executing
                : key === 'COMPLETED' ? statusCounts.completed
                : key === 'DONE' ? statusCounts.done
                : null
              return (
                <Link
                  key={key}
                  href={`/tasks?status=${key}${params.search ? `&search=${params.search}` : ''}`}
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
    </>
  )
}

// ═══════════════════════════════════════════════════
// Suspense Boundary 2: 任务列表区域（较慢查询后出）
// ═══════════════════════════════════════════════════

async function TasksSection({
  params,
}: {
  params: { status?: string; search?: string; page?: string }
}) {
  let tasks: Awaited<ReturnType<typeof getTasksBundle>>['tasks'] = []
  let total = 0
  let totalPages = 0
  let executingTasks: Awaited<ReturnType<typeof getTasksBundle>>['executingTasks'] = []

  try {
    const data = await getTasksBundle(params.status, params.search, params.page)
    tasks = data.tasks
    total = data.total
    totalPages = data.totalPages
    executingTasks = data.executingTasks
  } catch { /* 容错 */ }

  const currentPage = parseInt(params.page || '1')
  const activeStatus = params.status || 'ALL'
  const showExecutingSection = activeStatus === 'ALL' || activeStatus === 'EXECUTING'

  return (
    <div className="container mx-auto px-4 pb-8">
      {/* ── NOW EXECUTING ── */}
      {showExecutingSection && executingTasks.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="live-dot" />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--brand-primary))' }}>
              Now Executing
            </span>
            <span className="text-[10px]" style={{ color: 'rgb(var(--foreground-dim))' }}>
              {executingTasks.length} tasks
            </span>
          </div>
          <div className={`grid gap-3 ${
            executingTasks.length <= 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : executingTasks.length <= 3
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}>
            {executingTasks.map((task) => {
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

      {/* ── Task Grid ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="w-3.5 h-3.5" style={{ color: 'rgb(var(--foreground-dim))' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--foreground-dim))' }}>
            {activeStatus === 'ALL' ? 'All Tasks' : `${statusFilters.find(s => s.key === activeStatus)?.label || ''} Tasks`}
          </span>
          <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded" style={{ color: 'rgb(var(--foreground-dim))', background: 'rgba(var(--border), 0.15)' }}>
            {total}
          </span>
        </div>
        {tasks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ListChecks className="w-5 h-5" />
            </div>
            <p className="text-sm text-white font-medium">No tasks found</p>
            <p className="text-xs text-[rgb(var(--foreground-dim))]">Try adjusting your filters or search terms</p>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-6">
          {currentPage > 1 && (
            <Link
              href={buildPageUrl(currentPage - 1, params)}
              className="px-3 py-1.5 rounded-md text-xs transition-all"
              style={{ background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))', border: '1px solid rgba(var(--border), 0.3)' }}
            >
              Prev
            </Link>
          )}
          {generatePageNumbers(currentPage, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="px-2 text-xs" style={{ color: 'rgb(var(--foreground-dim))' }}>…</span>
            ) : (
              <Link
                key={p}
                href={buildPageUrl(p as number, params)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={
                  p === currentPage
                    ? { background: 'rgb(var(--brand-primary))', color: 'white' }
                    : { background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))', border: '1px solid rgba(var(--border), 0.3)' }
                }
              >
                {p}
              </Link>
            )
          )}
          {currentPage < totalPages && (
            <Link
              href={buildPageUrl(currentPage + 1, params)}
              className="px-3 py-1.5 rounded-md text-xs transition-all"
              style={{ background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))', border: '1px solid rgba(var(--border), 0.3)' }}
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Skeleton Fallbacks
// ═══════════════════════════════════════════════════

function HeaderSkeleton() {
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
    </div>
  )
}

function TasksSkeleton() {
  return (
    <div className="container mx-auto px-4 pb-8">
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
// Page — 静态 shell + 2 个独立 Suspense 边界流式渲染
// ═══════════════════════════════════════════════════

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>
}) {
  const params = await searchParams

  return (
    <main className="min-h-screen relative">
      <PageBackground variant="subtle" />

      <div className="relative z-10">
        <Header />

        {/* Boundary 1: Header 区域 — 轻量查询先出 */}
        <Suspense fallback={<HeaderSkeleton />}>
          <HeaderSection params={params} />
        </Suspense>

        {/* Boundary 2: 任务列表 — 较重查询后出 */}
        <Suspense fallback={<TasksSkeleton />}>
          <TasksSection params={params} />
        </Suspense>
      </div>
    </main>
  )
}

// ── Sub Components ──

function StatusBar({ counts }: {
  counts: { pending: number; claimed: number; executing: number; completed: number; done: number; total: number }
}) {
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

// ── Helpers ──

function buildPageUrl(page: number, params: { status?: string; search?: string }) {
  const parts = [`/tasks?page=${page}`]
  if (params.status) parts.push(`status=${params.status}`)
  if (params.search) parts.push(`search=${params.search}`)
  return parts.join('&')
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = []
  pages.push(1)
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
