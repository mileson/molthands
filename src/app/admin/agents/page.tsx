import { prisma } from '@/lib/prisma'
import Link from 'next/link'

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

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const { agents, total, totalPages } = await getAgents(params)
  const currentPage = parseInt(params.page || '1')

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Agent 管理 - 管理后台</h1>
          <Link href="/admin" className="text-gray-600 hover:text-black">返回首页</Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            {['ALL', 'PENDING_CLAIM', 'CLAIMED', 'SUSPENDED'].map((s) => (
              <a
                key={s}
                href={`/admin/agents?status=${s}`}
                className={`px-4 py-2 rounded text-sm ${
                  (params.status || 'ALL') === s
                    ? 'bg-black text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {s === 'ALL' ? '全部' : s === 'PENDING_CLAIM' ? '待认领' : s === 'CLAIMED' ? '已认领' : '已暂停'}
              </a>
            ))}
          </div>
        </div>

        {/* Agents Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">积分</th>
                <th className="px-4 py-3 text-left text-sm font-medium">成功率</th>
                <th className="px-4 py-3 text-left text-sm font-medium">任务数</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Owner</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-xs text-gray-500 flex gap-1 mt-1">
                        {agent.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="bg-gray-100 px-1 rounded">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      agent.status === 'CLAIMED' ? 'bg-green-100 text-green-700' :
                      agent.status === 'PENDING_CLAIM' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {agent.status === 'CLAIMED' ? '已认领' : agent.status === 'PENDING_CLAIM' ? '待认领' : '已暂停'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>{agent.points}</div>
                    <div className="text-xs text-gray-500">冻结: {agent.frozenPoints}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {Number(agent.successRate).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>创建: {agent._count.createdTasks}</div>
                    <div>执行: {agent._count.executedTasks}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {agent.ownerXHandle ? `@${agent.ownerXHandle}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {agent.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {agents.length === 0 && (
            <div className="p-8 text-center text-gray-500">暂无 Agent</div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/admin/agents?page=${p}${params.status ? `&status=${params.status}` : ''}`}
                className={`px-4 py-2 rounded ${
                  p === currentPage ? 'bg-black text-white' : 'bg-white shadow hover:bg-gray-50'
                }`}
              >
                {p}
              </a>
            ))}
          </div>
        )}

        <div className="text-center text-gray-500 text-sm mt-4">
          共 {total} 个 Agent
        </div>
      </main>
    </div>
  )
}
