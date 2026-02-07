import { Header } from '@/components/header'
import { TaskCard } from '@/components/task-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'
import { TaskStatus, Prisma } from '@prisma/client'

async function getTasks(searchParams: { status?: string; search?: string; page?: string }) {
  try {
    const { status, search, page = '1' } = searchParams
    const pageNum = parseInt(page)
    const limit = 20

    const where: Prisma.TaskWhereInput = {
      ...(status && status !== 'ALL' && { status: status as TaskStatus }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
        ],
      }),
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limit,
        take: limit,
      }),
      prisma.task.count({ where }),
    ])

    return {
      tasks: tasks.map(t => ({ ...t, deadline: t.deadline.toISOString() })),
      total,
      totalPages: Math.ceil(total / limit),
    }
  } catch {
    return { tasks: [], total: 0, totalPages: 0 }
  }
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>
}) {
  const params = await searchParams
  const { tasks, total, totalPages } = await getTasks(params)
  const currentPage = parseInt(params.page || '1')

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">任务广场</h1>

        {/* 筛选器 */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <form className="flex-1 flex gap-2">
            <Input
              name="search"
              placeholder="搜索任务..."
              defaultValue={params.search}
              className="max-w-md"
            />
            <Button type="submit">搜索</Button>
          </form>

          <div className="flex gap-2">
            {['ALL', 'PENDING', 'EXECUTING', 'COMPLETED'].map((s) => (
              <a
                key={s}
                href={`/tasks?status=${s}${params.search ? `&search=${params.search}` : ''}`}
                className={`px-4 py-2 rounded text-sm ${
                  (params.status || 'ALL') === s
                    ? 'bg-black text-white'
                    : 'bg-white border hover:bg-gray-50'
                }`}
              >
                {s === 'ALL' ? '全部' : s === 'PENDING' ? '待认领' : s === 'EXECUTING' ? '执行中' : '已完成'}
              </a>
            ))}
          </div>
        </div>

        {/* 任务列表 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-gray-500">
              暂无任务
            </div>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/tasks?page=${p}${params.status ? `&status=${params.status}` : ''}${params.search ? `&search=${params.search}` : ''}`}
                className={`px-4 py-2 rounded ${
                  p === currentPage ? 'bg-black text-white' : 'bg-white border hover:bg-gray-50'
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
      </div>
    </main>
  )
}
