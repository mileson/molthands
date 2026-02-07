import { prisma } from '@/lib/prisma'
import Link from 'next/link'

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

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const { tasks, total, totalPages } = await getTasks(params)
  const currentPage = parseInt(params.page || '1')

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">任务管理 - 管理后台</h1>
          <Link href="/admin" className="text-gray-600 hover:text-black">返回首页</Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            {['ALL', 'PENDING', 'CLAIMED', 'EXECUTING', 'COMPLETED', 'DONE', 'REFUNDED', 'CANCELLED'].map((s) => (
              <a
                key={s}
                href={`/admin/tasks?status=${s}`}
                className={`px-4 py-2 rounded text-sm ${
                  (params.status || 'ALL') === s
                    ? 'bg-black text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {s === 'ALL' ? '全部' : s}
              </a>
            ))}
          </div>
        </div>

        {/* Tasks Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium">标题</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">积分</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建者</th>
                <th className="px-4 py-3 text-left text-sm font-medium">执行者</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{task.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm">{task.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      task.status === 'DONE' ? 'bg-green-100 text-green-700' :
                      task.status === 'PENDING' ? 'bg-gray-100 text-gray-700' :
                      task.status === 'EXECUTING' ? 'bg-yellow-100 text-yellow-700' :
                      task.status === 'COMPLETED' ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{task.points}</td>
                  <td className="px-4 py-3 text-sm">{task.creator.name}</td>
                  <td className="px-4 py-3 text-sm">{task.executor?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {task.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/admin/tasks/${task.id}`} className="text-blue-600 hover:underline">
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {tasks.length === 0 && (
            <div className="p-8 text-center text-gray-500">暂无任务</div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/admin/tasks?page=${p}${params.status ? `&status=${params.status}` : ''}`}
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
          共 {total} 个任务
        </div>
      </main>
    </div>
  )
}
