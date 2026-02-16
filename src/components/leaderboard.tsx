'use client'

import { cn } from '@/lib/utils'
import { formatPoints } from '@/lib/utils'
import { Crown, Medal, TrendingUp } from 'lucide-react'

interface LeaderboardEntry {
  rank: number
  id: string
  name: string
  points: number
  ownerXHandle?: string | null
}

interface LeaderboardProps {
  agents: LeaderboardEntry[]
  expanded?: boolean
}

export function Leaderboard({ agents, expanded = false }: LeaderboardProps) {
  const displayAgents = expanded ? agents : agents.slice(0, 5)

  return (
    <div className="space-y-1.5">
      {displayAgents.map((agent) => {
        const isTopThree = agent.rank <= 3

        return (
          <div
            key={agent.id}
            className={cn(
              'flex items-center justify-between p-3 rounded-xl transition-all duration-300',
              'hover:bg-[rgba(var(--card-hover)/0.5)] cursor-pointer group',
              agent.rank === 1 && 'rank-1',
              agent.rank === 2 && 'rank-2',
              agent.rank === 3 && 'rank-3'
            )}
          >
            <div className="flex items-center gap-3">
              {/* Rank Badge */}
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-transform duration-300 group-hover:scale-110',
                  agent.rank === 1 && 'bg-gradient-to-br from-yellow-300 to-amber-500 text-black shadow-lg shadow-amber-500/20',
                  agent.rank === 2 && 'bg-gradient-to-br from-slate-300 to-slate-400 text-black',
                  agent.rank === 3 && 'bg-gradient-to-br from-amber-600 to-orange-700 text-white',
                  agent.rank > 3 && 'bg-[rgba(var(--card)/0.6)] text-[rgb(var(--foreground-dim))] border border-[rgba(var(--border)/0.5)]'
                )}
              >
                {agent.rank === 1 ? (
                  <Crown className="w-4 h-4" />
                ) : agent.rank <= 3 ? (
                  <Medal className="w-3.5 h-3.5" />
                ) : (
                  agent.rank
                )}
              </div>

              {/* Name & Handle */}
              <div className="min-w-0">
                <div className={cn(
                  'text-sm font-medium truncate transition-colors duration-200',
                  isTopThree ? 'text-white' : 'text-[rgb(var(--foreground-muted))]',
                  'group-hover:text-white'
                )}>
                  {agent.name}
                </div>
                {agent.ownerXHandle && (
                  <div className="text-[10px] text-[rgb(var(--foreground-dim))] truncate">
                    @{agent.ownerXHandle}
                  </div>
                )}
              </div>
            </div>

            {/* Points */}
            <div className="flex items-center gap-1.5 shrink-0">
              <TrendingUp className={cn(
                'w-3 h-3 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0',
                isTopThree ? 'text-[rgb(var(--brand-accent))]' : 'text-[rgb(var(--foreground-dim))]'
              )} />
              <span className={cn(
                'text-sm font-semibold stat-value',
                agent.rank === 1 ? 'text-amber-400' : isTopThree ? 'text-[rgb(var(--brand-accent))]' : 'text-white'
              )}>
                {formatPoints(agent.points)}
              </span>
              <span className="text-[10px] text-[rgb(var(--foreground-dim))]">pts</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
