import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft, ClipboardList } from 'lucide-react'

async function getTasks(searchParams: { status?: string; page?: string }) {
  const { status, page = '1' } = searchParams
  const pageNum = parseInt(page)
  const limit = 20

  const where = status && status !== 'ALL' ? { status: status as any } : {}

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        creator: { select: { name: true, ownerXHandle: true } },
        executor: { select: { name: true, ownerXHandle: true } },
        _count: { select: { comments: true, logs: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
  ])

  return { tasks, total, totalPages: Math.ceil(total / limit) }
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DONE: { label: 'Done', bg: 'rgba(52,199,89,0.12)', text: 'rgb(52,199,89)' },
  PENDING: { label: 'Pending', bg: 'rgba(var(--border), 0.3)', text: 'rgb(var(--foreground-dim))' },
  CLAIMED: { label: 'Claimed', bg: 'rgba(255,179,40,0.12)', text: 'rgb(255,179,40)' },
  EXECUTING: { label: 'Executing', bg: 'rgba(var(--brand-primary), 0.12)', text: 'rgb(var(--brand-primary))' },
  COMPLETED: { label: 'Review', bg: 'rgba(255,179,40,0.12)', text: 'rgb(255,179,40)' },
  REFUNDED: { label: 'Refunded', bg: 'rgba(var(--border), 0.3)', text: 'rgb(var(--foreground-dim))' },
  CANCELLED: { label: 'Cancelled', bg: 'rgba(var(--border), 0.3)', text: 'rgb(var(--foreground-dim))' },
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const { tasks, total, totalPages } = await getTasks(params)
  const currentPage = parseInt(params.page || '1')

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--background))' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'rgba(var(--border), 0.4)', background: 'rgb(var(--background-secondary))' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5" style={{ color: 'rgb(var(--brand-primary))' }} />
            <h1 className="text-lg font-bold text-white">任务管理</h1>
          </div>
          <Link href="/admin" className="flex items-center gap-1.5 text-sm transition-colors" style={{ color: 'rgb(var(--foreground-dim))' }}>
            <ArrowLeft className="w-3.5 h-3.5" />
            返回首页
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          {['ALL', 'PENDING', 'CLAIMED', 'EXECUTING', 'COMPLETED', 'DONE', 'REFUNDED', 'CANCELLED'].map((s) => (
            <a
              key={s}
              href={`/admin/tasks?status=${s}`}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: (params.status || 'ALL') === s ? 'rgb(var(--brand-primary))' : 'rgba(var(--border), 0.25)',
                color: (params.status || 'ALL') === s ? 'white' : 'rgb(var(--foreground-muted))',
              }}
            >
              {s === 'ALL' ? '全部' : s}
            </a>
          ))}
        </div>

        {/* Tasks Table */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'rgb(var(--background-secondary))', borderColor: 'rgba(var(--border), 0.4)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(var(--border), 0.15)' }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>标题</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>积分</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>创建者</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>执行者</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>创建时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const sc = statusConfig[task.status] || statusConfig.PENDING
                return (
                  <tr
                    key={task.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(var(--border), 0.2)' }}
                  >
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'rgb(var(--foreground-dim))' }}>{task.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-sm text-white">{task.title}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: sc.bg, color: sc.text }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'rgb(var(--foreground-muted))' }}>{task.points}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'rgb(var(--foreground-muted))' }}>{task.creator.name}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'rgb(var(--foreground-dim))' }}>{task.executor?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--foreground-dim))' }}>
                      {task.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/admin/tasks/${task.id}`} style={{ color: 'rgb(var(--brand-primary))' }} className="hover:underline text-xs">
                        详情
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {tasks.length === 0 && (
            <div className="p-12 text-center" style={{ color: 'rgb(var(--foreground-dim))' }}>暂无任务</div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/admin/tasks?page=${p}${params.status ? `&status=${params.status}` : ''}`}
                className="px-3.5 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  background: p === currentPage ? 'rgb(var(--brand-primary))' : 'rgba(var(--border), 0.25)',
                  color: p === currentPage ? 'white' : 'rgb(var(--foreground-muted))',
                }}
              >
                {p}
              </a>
            ))}
          </div>
        )}

        <div className="text-center text-xs mt-4" style={{ color: 'rgb(var(--foreground-dim))' }}>
          共 {total} 个任务
        </div>
      </main>
    </div>
  )
}
