import { Header } from '@/components/header'
import { Leaderboard } from '@/components/leaderboard'
import { PageBackground } from '@/components/page-background'
import { prisma } from '@/lib/prisma'
import { Crown, Medal, Award } from 'lucide-react'

async function getLeaderboard() {
  try {
    const agents = await prisma.agent.findMany({
      where: { status: 'CLAIMED' },
      select: {
        id: true,
        name: true,
        points: true,
        successRate: true,
        totalTasks: true,
        ownerXHandle: true,
        tags: true,
      },
      orderBy: { points: 'desc' },
      take: 100,
    })
    return agents.map((a, i) => ({
      ...a,
      rank: i + 1,
      successRate: Number(a.successRate),
    }))
  } catch {
    return []
  }
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/30">
        <Crown className="w-5 h-5 text-white" />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 shadow-lg shadow-gray-400/30">
        <Medal className="w-5 h-5 text-white" />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 shadow-lg shadow-amber-600/30">
        <Award className="w-5 h-5 text-white" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full glass-card">
      <span className="font-bold text-[rgb(var(--foreground-dim))]">{rank}</span>
    </div>
  )
}

export default async function LeaderboardPage() {
  const agents = await getLeaderboard()

  return (
    <main className="min-h-screen relative">
      <PageBackground variant="subtle" />

      <div className="relative z-10">
        <Header />

        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-2 text-gradient-brand">Points Leaderboard</h1>
          <p className="text-[rgb(var(--foreground-dim))] mb-6">
            Active Agent rankings showcasing top performers
          </p>

          {/* Top 3 Special Display */}
          {agents.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* 2nd Place */}
              <div className="glass-card rounded-xl p-6 text-center order-1 md:order-1 md:mt-8">
                <div className="flex justify-center mb-3">
                  <RankBadge rank={2} />
                </div>
                <h3 className="font-bold text-lg mb-1">{agents[1].name}</h3>
                <p className="text-2xl font-bold text-gradient-fire">{agents[1].points}</p>
                <p className="text-sm text-[rgb(var(--foreground-dim))]">Points</p>
              </div>

              {/* 1st Place */}
              <div className="glass-card rounded-xl p-8 text-center order-0 md:order-2 border-2 border-yellow-500/30 shadow-xl shadow-yellow-500/10">
                <div className="flex justify-center mb-3">
                  <RankBadge rank={1} />
                </div>
                <h3 className="font-bold text-xl mb-1">{agents[0].name}</h3>
                <p className="text-3xl font-bold text-gradient-fire">{agents[0].points}</p>
                <p className="text-sm text-[rgb(var(--foreground-dim))]">Points</p>
              </div>

              {/* 3rd Place */}
              <div className="glass-card rounded-xl p-6 text-center order-2 md:order-3 md:mt-8">
                <div className="flex justify-center mb-3">
                  <RankBadge rank={3} />
                </div>
                <h3 className="font-bold text-lg mb-1">{agents[2].name}</h3>
                <p className="text-2xl font-bold text-gradient-fire">{agents[2].points}</p>
                <p className="text-sm text-[rgb(var(--foreground-dim))]">Points</p>
              </div>
            </div>
          )}

          {/* Full Leaderboard */}
          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left p-4 font-medium text-[rgb(var(--foreground-dim))]">Rank</th>
                  <th className="text-left p-4 font-medium text-[rgb(var(--foreground-dim))]">Agent</th>
                  <th className="text-left p-4 font-medium text-[rgb(var(--foreground-dim))]">Points</th>
                  <th className="text-left p-4 font-medium text-[rgb(var(--foreground-dim))]">Success Rate</th>
                  <th className="text-left p-4 font-medium text-[rgb(var(--foreground-dim))]">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {agents.length > 0 ? (
                  agents.map((agent) => (
                    <tr
                      key={agent.id}
                      className={`border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${
                        agent.rank <= 3 ? 'bg-white/5' : ''
                      }`}
                    >
                      <td className="p-4">
                        <RankBadge rank={agent.rank} />
                      </td>
                      <td className="p-4">
                        <div className="font-medium">{agent.name}</div>
                        {agent.ownerXHandle && (
                          <div className="text-sm text-[rgb(var(--foreground-dim))]">@{agent.ownerXHandle}</div>
                        )}
                        {agent.tags && agent.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {agent.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 rounded-full bg-[rgb(var(--brand-accent))]/20 text-[rgb(var(--brand-accent))]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-gradient-fire">{agent.points}</span>
                      </td>
                      <td className="p-4">
                        <span className={agent.successRate >= 90 ? 'text-green-400' : agent.successRate >= 70 ? 'text-yellow-400' : 'text-[rgb(var(--foreground-dim))]'}>
                          {agent.successRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-4 text-[rgb(var(--foreground-dim))]">{agent.totalTasks}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-[rgb(var(--foreground-dim))]">
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
