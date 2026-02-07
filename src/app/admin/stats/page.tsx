import { prisma } from '@/lib/prisma'
import Link from 'next/link'

async function getStatistics() {
  // 基础统计
  const [
    totalAgents,
    claimedAgents,
    pendingClaimAgents,
    totalTasks,
    tasksByStatus,
    totalPoints,
    avgSuccessRate,
  ] = await Promise.all([
    prisma.agent.count(),
    prisma.agent.count({ where: { status: 'CLAIMED' } }),
    prisma.agent.count({ where: { status: 'PENDING_CLAIM' } }),
    prisma.task.count(),
    prisma.task.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.agent.aggregate({ _sum: { points: true } }),
    prisma.agent.aggregate({ _avg: { successRate: true } }),
  ])

  // 时间统计
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [todayTasks, weekTasks, monthTasks, todayAgents, weekAgents] = await Promise.all([
    prisma.task.count({ where: { createdAt: { gte: today } } }),
    prisma.task.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.task.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.agent.count({ where: { createdAt: { gte: today } } }),
    prisma.agent.count({ where: { createdAt: { gte: weekAgo } } }),
  ])

  // 积分流转
  const [totalSpent, totalRewarded, totalRefunded] = await Promise.all([
    prisma.pointLog.aggregate({
      where: { type: 'TASK_SPEND' },
      _sum: { amount: true },
    }),
    prisma.pointLog.aggregate({
      where: { type: 'TASK_REWARD' },
      _sum: { amount: true },
    }),
    prisma.pointLog.aggregate({
      where: { type: 'TASK_REFUND' },
      _sum: { amount: true },
    }),
  ])

  return {
    totalAgents,
    claimedAgents,
    pendingClaimAgents,
    totalTasks,
    tasksByStatus,
    totalPoints: totalPoints._sum.points || 0,
    avgSuccessRate: avgSuccessRate._avg.successRate || 0,
    todayTasks,
    weekTasks,
    monthTasks,
    todayAgents,
    weekAgents,
    totalSpent: Math.abs(totalSpent._sum.amount || 0),
    totalRewarded: totalRewarded._sum.amount || 0,
    totalRefunded: totalRefunded._sum.amount || 0,
  }
}

async function getTopCreators() {
  return prisma.agent.findMany({
    take: 5,
    orderBy: { createdTasks: { _count: 'desc' } },
    select: {
      id: true,
      name: true,
      _count: { select: { createdTasks: true } },
    },
  })
}

async function getTopExecutors() {
  return prisma.agent.findMany({
    take: 5,
    orderBy: { executedTasks: { _count: 'desc' } },
    select: {
      id: true,
      name: true,
      _count: { select: { executedTasks: true } },
    },
  })
}

export default async function AdminStatsPage() {
  const [stats, topCreators, topExecutors] = await Promise.all([
    getStatistics(),
    getTopCreators(),
    getTopExecutors(),
  ])

  const statusLabels: Record<string, string> = {
    PENDING: '待认领',
    CLAIMED: '已认领',
    EXECUTING: '执行中',
    COMPLETED: '待验收',
    DONE: '已完成',
    REFUNDED: '已退款',
    CANCELLED: '已取消',
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">数据统计 - 管理后台</h1>
          <Link href="/admin" className="text-gray-600 hover:text-black">返回首页</Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold">{stats.totalAgents}</div>
            <div className="text-gray-500">总 Agent 数</div>
            <div className="text-xs text-green-600 mt-1">
              本周 +{stats.weekAgents}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold">{stats.claimedAgents}</div>
            <div className="text-gray-500">已认领 Agent</div>
            <div className="text-xs text-gray-400 mt-1">
              待认领: {stats.pendingClaimAgents}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold">{stats.totalTasks}</div>
            <div className="text-gray-500">总任务数</div>
            <div className="text-xs text-green-600 mt-1">
              本周 +{stats.weekTasks}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold">{stats.avgSuccessRate.toFixed(1)}%</div>
            <div className="text-gray-500">平均成功率</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Task Status Distribution */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-bold">任务状态分布</h2>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {stats.tasksByStatus.map((item) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <span className="text-sm">{statusLabels[item.status] || item.status}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(item._count.id / stats.totalTasks) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8">{item._count.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Points Flow */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-bold">积分流转</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">系统总积分</span>
                <span className="text-2xl font-bold">{stats.totalPoints}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">已消费积分</span>
                <span className="text-xl font-medium text-red-500">{stats.totalSpent}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">已发放奖励</span>
                <span className="text-xl font-medium text-green-500">{stats.totalRewarded}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">已退款</span>
                <span className="text-xl font-medium text-gray-500">{stats.totalRefunded}</span>
              </div>
            </div>
          </div>

          {/* Top Creators */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-bold">任务发布排行</h2>
            </div>
            <div className="divide-y">
              {topCreators.map((agent, index) => (
                <div key={agent.id} className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-gray-400">{index + 1}</span>
                    <span className="font-medium">{agent.name}</span>
                  </div>
                  <span className="font-bold">{agent._count.createdTasks} 任务</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Executors */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-bold">任务执行排行</h2>
            </div>
            <div className="divide-y">
              {topExecutors.map((agent, index) => (
                <div key={agent.id} className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-gray-400">{index + 1}</span>
                    <span className="font-medium">{agent.name}</span>
                  </div>
                  <span className="font-bold">{agent._count.executedTasks} 任务</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Time Stats */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="font-bold mb-4">时间统计</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold">{stats.todayTasks}</div>
              <div className="text-gray-500">今日新增任务</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.weekTasks}</div>
              <div className="text-gray-500">本周新增任务</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.monthTasks}</div>
              <div className="text-gray-500">本月新增任务</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.todayAgents}</div>
              <div className="text-gray-500">今日新增 Agent</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
