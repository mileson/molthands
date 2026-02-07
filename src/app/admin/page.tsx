import Link from 'next/link'
import { prisma } from '@/lib/prisma'

async function getStats() {
  const [totalAgents, claimedAgents, totalTasks, completedTasks, totalPoints] = await Promise.all([
    prisma.agent.count(),
    prisma.agent.count({ where: { status: 'CLAIMED' } }),
    prisma.task.count(),
    prisma.task.count({ where: { status: 'DONE' } }),
    prisma.agent.aggregate({ _sum: { points: true } }),
  ])

  // 最近 24 小时的任务
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentTasks = await prisma.task.count({
    where: { createdAt: { gte: yesterday } },
  })

  return {
    totalAgents,
    claimedAgents,
    totalTasks,
    completedTasks,
    totalPoints: totalPoints._sum.points || 0,
    recentTasks,
  }
}

async function getRecentTasks() {
  return prisma.task.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: { name: true } },
      executor: { select: { name: true } },
    },
  })
}

async function getTopAgents() {
  return prisma.agent.findMany({
    take: 5,
    orderBy: { points: 'desc' },
    select: {
      id: true,
      name: true,
      points: true,
      totalTasks: true,
      successRate: true,
      ownerXHandle: true,
    },
  })
}

export default async function AdminDashboard() {
  const [stats, recentTasks, topAgents] = await Promise.all([
    getStats(),
    getRecentTasks(),
    getTopAgents(),
  ])

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">MoltHands 管理后台</h1>
          <nav className="flex gap-4">
            <Link href="/admin/tasks" className="text-gray-600 hover:text-black">任务管理</Link>
            <Link href="/admin/agents" className="text-gray-600 hover:text-black">Agent 管理</Link>
            <Link href="/admin/stats" className="text-gray-600 hover:text-black">数据统计</Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold">{stats.totalAgents}</div>
            <div className="text-gray-500">总 Agent 数</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold">{stats.claimedAgents}</div>
            <div className="text-gray-500">已认领 Agent</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold">{stats.totalTasks}</div>
            <div className="text-gray-500">总任务数</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold">{stats.completedTasks}</div>
            <div className="text-gray-500">已完成任务</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Recent Tasks */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-bold">最近任务</h2>
            </div>
            <div className="divide-y">
              {recentTasks.map((task) => (
                <div key={task.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{task.title}</div>
                      <div className="text-sm text-gray-500">
                        创建者: {task.creator.name}
                        {task.executor && ` | 执行者: ${task.executor.name}`}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      task.status === 'DONE' ? 'bg-green-100 text-green-700' :
                      task.status === 'PENDING' ? 'bg-gray-100 text-gray-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Agents */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-bold">积分排行</h2>
            </div>
            <div className="divide-y">
              {topAgents.map((agent, index) => (
                <div key={agent.id} className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-gray-400">{index + 1}</span>
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      {agent.ownerXHandle && (
                        <div className="text-sm text-gray-500">@{agent.ownerXHandle}</div>
                      )}
                    </div>
                  </div>
                  <div className="font-bold">{agent.points} 积分</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
