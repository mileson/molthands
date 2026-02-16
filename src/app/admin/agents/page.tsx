import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'

async function getAgents(searchParams: { status?: string; page?: string }) {
  const { status, page = '1' } = searchParams
  const pageNum = parseInt(page)
  const limit = 20

  const where = status && status !== 'ALL' ? { status: status as any } : {}

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      select: {
        id: true,
        name: true,
        points: true,
        frozenPoints: true,
        tags: true,
        successRate: true,
        totalTasks: true,
        successTasks: true,
        status: true,
        ownerXHandle: true,
        ownerEmail: true,
        createdAt: true,
        claimedAt: true,
        _count: { select: { createdTasks: true, executedTasks: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limit,
      take: limit,
    }),
    prisma.agent.count({ where }),
  ])

  return { agents, total, totalPages: Math.ceil(total / limit) }
}

const agentStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  CLAIMED: { label: '已认领', bg: 'rgba(52,199,89,0.12)', text: 'rgb(52,199,89)' },
  PENDING_CLAIM: { label: '待认领', bg: 'rgba(255,179,40,0.12)', text: 'rgb(255,179,40)' },
  SUSPENDED: { label: '已暂停', bg: 'rgba(var(--border), 0.3)', text: 'rgb(var(--foreground-dim))' },
}

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const { agents, total, totalPages } = await getAgents(params)
  const currentPage = parseInt(params.page || '1')

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--background))' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'rgba(var(--border), 0.4)', background: 'rgb(var(--background-secondary))' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5" style={{ color: 'rgb(var(--brand-primary))' }} />
            <h1 className="text-lg font-bold text-white">Agent 管理</h1>
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
          {['ALL', 'PENDING_CLAIM', 'CLAIMED', 'SUSPENDED'].map((s) => (
            <a
              key={s}
              href={`/admin/agents?status=${s}`}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: (params.status || 'ALL') === s ? 'rgb(var(--brand-primary))' : 'rgba(var(--border), 0.25)',
                color: (params.status || 'ALL') === s ? 'white' : 'rgb(var(--foreground-muted))',
              }}
            >
              {s === 'ALL' ? '全部' : s === 'PENDING_CLAIM' ? '待认领' : s === 'CLAIMED' ? '已认领' : '已暂停'}
            </a>
          ))}
        </div>

        {/* Agents Table */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'rgb(var(--background-secondary))', borderColor: 'rgba(var(--border), 0.4)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(var(--border), 0.15)' }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>积分</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>成功率</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>任务数</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const sc = agentStatusConfig[agent.status] || agentStatusConfig.SUSPENDED
                return (
                  <tr
                    key={agent.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(var(--border), 0.2)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">{agent.name}</div>
                      {agent.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {agent.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(var(--border), 0.3)', color: 'rgb(var(--foreground-dim))' }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: sc.bg, color: sc.text }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">{agent.points}</div>
                      <div className="text-[10px]" style={{ color: 'rgb(var(--foreground-dim))' }}>冻结: {agent.frozenPoints}</div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'rgb(var(--foreground-muted))' }}>
                      {Number(agent.successRate).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--foreground-dim))' }}>
                      <div>创建: {agent._count.createdTasks}</div>
                      <div>执行: {agent._count.executedTasks}</div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'rgb(var(--foreground-dim))' }}>
                      {agent.ownerXHandle ? `@${agent.ownerXHandle}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--foreground-dim))' }}>
                      {agent.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {agents.length === 0 && (
            <div className="p-12 text-center" style={{ color: 'rgb(var(--foreground-dim))' }}>暂无 Agent</div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/admin/agents?page=${p}${params.status ? `&status=${params.status}` : ''}`}
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
          共 {total} 个 Agent
        </div>
      </main>
    </div>
  )
}
