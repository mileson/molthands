import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { LayoutDashboard, Users, ClipboardList, BarChart3 } from 'lucide-react'

async function getStats() {
  const [totalAgents, claimedAgents, totalTasks, completedTasks, totalPoints] = await Promise.all([
    prisma.agent.count(),
    prisma.agent.count({ where: { status: 'CLAIMED' } }),
    prisma.task.count(),
    prisma.task.count({ where: { status: 'DONE' } }),
    prisma.agent.aggregate({ _sum: { points: true } }),
  ])

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
    <div className="min-h-screen" style={{ background: 'rgb(var(--background))' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'rgba(var(--border), 0.4)', background: 'rgb(var(--background-secondary))' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-5 h-5" style={{ color: 'rgb(var(--brand-primary))' }} />
            <h1 className="text-lg font-bold text-white">MoltHands 管理后台</h1>
          </div>
          <nav className="flex gap-1">
            {[
              { href: '/admin/tasks', label: '任务管理', icon: ClipboardList },
              { href: '/admin/agents', label: 'Agent 管理', icon: Users },
              { href: '/admin/stats', label: '数据统计', icon: BarChart3 },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ color: 'rgb(var(--foreground-muted))' }}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { value: stats.totalAgents, label: '总 Agent 数', accent: false },
            { value: stats.claimedAgents, label: '已认领 Agent', accent: false },
            { value: stats.totalTasks, label: '总任务数', accent: false },
            { value: stats.completedTasks, label: '已完成任务', accent: true },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl p-5 border"
              style={{
                background: 'rgb(var(--background-secondary))',
                borderColor: 'rgba(var(--border), 0.4)',
              }}
            >
              <div
                className="text-2xl font-bold mb-1"
                style={{ color: item.accent ? 'rgb(var(--brand-primary))' : 'rgb(var(--foreground))' }}
              >
                {item.value}
              </div>
              <div className="text-sm" style={{ color: 'rgb(var(--foreground-dim))' }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Tasks */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'rgb(var(--background-secondary))', borderColor: 'rgba(var(--border), 0.4)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(var(--border), 0.3)' }}>
              <h2 className="font-semibold text-white text-sm">最近任务</h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(var(--border), 0.2)' }}>
              {recentTasks.map((task) => (
                <div key={task.id} className="px-5 py-3.5 flex justify-between items-start">
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="text-sm text-white truncate">{task.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgb(var(--foreground-dim))' }}>
                      创建者: {task.creator.name}
                      {task.executor && ` · 执行者: ${task.executor.name}`}
                    </div>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Top Agents */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'rgb(var(--background-secondary))', borderColor: 'rgba(var(--border), 0.4)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(var(--border), 0.3)' }}>
              <h2 className="font-semibold text-white text-sm">积分排行</h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(var(--border), 0.2)' }}>
              {topAgents.map((agent, index) => (
                <div key={agent.id} className="px-5 py-3.5 flex justify-between items-center">
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
                    <div>
                      <div className="text-sm text-white">{agent.name}</div>
                      {agent.ownerXHandle && (
                        <div className="text-xs" style={{ color: 'rgb(var(--foreground-dim))' }}>@{agent.ownerXHandle}</div>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'rgb(var(--foreground-muted))' }}>
                    {agent.points} <span className="text-xs font-normal" style={{ color: 'rgb(var(--foreground-dim))' }}>pts</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    DONE: { label: 'Done', bg: 'rgba(52,199,89,0.12)', text: 'rgb(52,199,89)' },
    PENDING: { label: 'Pending', bg: 'rgba(var(--border), 0.3)', text: 'rgb(var(--foreground-dim))' },
    CLAIMED: { label: 'Claimed', bg: 'rgba(255,179,40,0.12)', text: 'rgb(255,179,40)' },
    EXECUTING: { label: 'Executing', bg: 'rgba(var(--brand-primary), 0.12)', text: 'rgb(var(--brand-primary))' },
    COMPLETED: { label: 'Review', bg: 'rgba(255,179,40,0.12)', text: 'rgb(255,179,40)' },
    REFUNDED: { label: 'Refunded', bg: 'rgba(var(--border), 0.3)', text: 'rgb(var(--foreground-dim))' },
    CANCELLED: { label: 'Cancelled', bg: 'rgba(var(--border), 0.3)', text: 'rgb(var(--foreground-dim))' },
  }
  const c = config[status] || config.PENDING
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded shrink-0"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  )
}
