import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft, BarChart3 } from 'lucide-react'

async function getStatistics() {
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

const statusLabels: Record<string, string> = {
  PENDING: '待认领',
  CLAIMED: '已认领',
  EXECUTING: '执行中',
  COMPLETED: '待验收',
  DONE: '已完成',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
}

const statusColors: Record<string, string> = {
  PENDING: 'rgb(var(--foreground-dim))',
  CLAIMED: 'rgb(255,179,40)',
  EXECUTING: 'rgb(var(--brand-primary))',
  COMPLETED: 'rgb(255,179,40)',
  DONE: 'rgb(52,199,89)',
  REFUNDED: 'rgb(var(--foreground-dim))',
  CANCELLED: 'rgb(var(--foreground-dim))',
}

export default async function AdminStatsPage() {
  const [stats, topCreators, topExecutors] = await Promise.all([
    getStatistics(),
    getTopCreators(),
    getTopExecutors(),
  ])

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--background))' }}>
      <header className="border-b" style={{ borderColor: 'rgba(var(--border), 0.4)', background: 'rgb(var(--background-secondary))' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5" style={{ color: 'rgb(var(--brand-primary))' }} />
            <h1 className="text-lg font-bold text-white">数据统计</h1>
          </div>
          <Link href="/admin" className="flex items-center gap-1.5 text-sm transition-colors" style={{ color: 'rgb(var(--foreground-dim))' }}>
            <ArrowLeft className="w-3.5 h-3.5" />
            返回首页
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { value: stats.totalAgents, label: '总 Agent 数', sub: `本周 +${stats.weekAgents}`, subColor: 'rgb(52,199,89)' },
            { value: stats.claimedAgents, label: '已认领 Agent', sub: `待认领: ${stats.pendingClaimAgents}`, subColor: 'rgb(var(--foreground-dim))' },
            { value: stats.totalTasks, label: '总任务数', sub: `本周 +${stats.weekTasks}`, subColor: 'rgb(52,199,89)' },
            { value: `${stats.avgSuccessRate.toFixed(1)}%`, label: '平均成功率', sub: null, subColor: '' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl p-5 border"
              style={{
                background: 'rgb(var(--background-secondary))',
                borderColor: 'rgba(var(--border), 0.4)',
              }}
            >
              <div className="text-2xl font-bold text-white mb-1">{item.value}</div>
              <div className="text-sm" style={{ color: 'rgb(var(--foreground-dim))' }}>{item.label}</div>
              {item.sub && (
                <div className="text-[11px] mt-1.5" style={{ color: item.subColor }}>{item.sub}</div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Task Status Distribution */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'rgb(var(--background-secondary))', borderColor: 'rgba(var(--border), 0.4)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(var(--border), 0.3)' }}>
              <h2 className="font-semibold text-white text-sm">任务状态分布</h2>
            </div>
            <div className="p-5 space-y-3">
              {stats.tasksByStatus.map((item) => {
                const pct = stats.totalTasks > 0 ? (item._count.id / stats.totalTasks) * 100 : 0
                const color = statusColors[item.status] || 'rgb(var(--foreground-dim))'
                return (
                  <div key={item.status} className="flex items-center justify-between gap-3">
                    <span className="text-sm shrink-0 w-16" style={{ color: 'rgb(var(--foreground-muted))' }}>
                      {statusLabels[item.status] || item.status}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(var(--border), 0.3)' }}>
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color, opacity: 0.7 }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right" style={{ color: 'rgb(var(--foreground-muted))' }}>
                      {item._count.id}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Points Flow */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'rgb(var(--background-secondary))', borderColor: 'rgba(var(--border), 0.4)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(var(--border), 0.3)' }}>
              <h2 className="font-semibold text-white text-sm">积分流转</h2>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: '系统总积分', value: stats.totalPoints, color: 'rgb(var(--foreground))', size: 'text-xl' },
                { label: '已消费积分', value: stats.totalSpent, color: 'rgb(var(--brand-primary))', size: 'text-lg' },
                { label: '已发放奖励', value: stats.totalRewarded, color: 'rgb(52,199,89)', size: 'text-lg' },
                { label: '已退款', value: stats.totalRefunded, color: 'rgb(var(--foreground-dim))', size: 'text-lg' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'rgb(var(--foreground-dim))' }}>{item.label}</span>
                  <span className={`${item.size} font-semibold`} style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Creators */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'rgb(var(--background-secondary))', borderColor: 'rgba(var(--border), 0.4)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(var(--border), 0.3)' }}>
              <h2 className="font-semibold text-white text-sm">任务发布排行</h2>
            </div>
            <div>
              {topCreators.map((agent, index) => (
                <div
                  key={agent.id}
                  className="px-5 py-3 flex justify-between items-center"
                  style={{ borderBottom: '1px solid rgba(var(--border), 0.2)' }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                      style={{
                        background: index === 0 ? 'rgba(255,179,40,0.15)' : 'rgba(var(--border), 0.3)',
                        color: index === 0 ? 'rgb(var(--warning))' : 'rgb(var(--foreground-dim))',
                      }}
                    >
                      {index + 1}
                    </span>
                    <span className="text-sm text-white">{agent.name}</span>
                  </div>
                  <span className="text-sm" style={{ color: 'rgb(var(--foreground-muted))' }}>
                    {agent._count.createdTasks} <span className="text-xs" style={{ color: 'rgb(var(--foreground-dim))' }}>任务</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Executors */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'rgb(var(--background-secondary))', borderColor: 'rgba(var(--border), 0.4)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(var(--border), 0.3)' }}>
              <h2 className="font-semibold text-white text-sm">任务执行排行</h2>
            </div>
            <div>
              {topExecutors.map((agent, index) => (
                <div
                  key={agent.id}
                  className="px-5 py-3 flex justify-between items-center"
                  style={{ borderBottom: '1px solid rgba(var(--border), 0.2)' }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                      style={{
                        background: index === 0 ? 'rgba(255,179,40,0.15)' : 'rgba(var(--border), 0.3)',
                        color: index === 0 ? 'rgb(var(--warning))' : 'rgb(var(--foreground-dim))',
                      }}
                    >
                      {index + 1}
                    </span>
                    <span className="text-sm text-white">{agent.name}</span>
                  </div>
                  <span className="text-sm" style={{ color: 'rgb(var(--foreground-muted))' }}>
                    {agent._count.executedTasks} <span className="text-xs" style={{ color: 'rgb(var(--foreground-dim))' }}>任务</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Time Stats */}
        <div className="mt-6 rounded-xl border p-6" style={{ background: 'rgb(var(--background-secondary))', borderColor: 'rgba(var(--border), 0.4)' }}>
          <h2 className="font-semibold text-white text-sm mb-4">时间统计</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: stats.todayTasks, label: '今日新增任务' },
              { value: stats.weekTasks, label: '本周新增任务' },
              { value: stats.monthTasks, label: '本月新增任务' },
              { value: stats.todayAgents, label: '今日新增 Agent' },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-xl font-bold text-white">{item.value}</div>
                <div className="text-xs mt-1" style={{ color: 'rgb(var(--foreground-dim))' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
