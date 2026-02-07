'use client'

import { cn } from '@/lib/utils'
import { formatPoints } from '@/lib/utils'
import { Crown, Medal } from 'lucide-react'

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
    <div className="space-y-2">
      {displayAgents.map((agent) => {
        const isTopThree = agent.rank <= 3

        return (
          <div
            key={agent.id}
            className={cn(
              'flex items-center justify-between p-3 rounded-xl transition-all duration-200',
              'hover:bg-[rgba(var(--card)/0.3)] cursor-pointer',
              agent.rank === 1 && 'rank-1',
              agent.rank === 2 && 'rank-2',
              agent.rank === 3 && 'rank-3'
            )}
          >
            <div className="flex items-center gap-3">
              {/* Rank */}
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                  agent.rank === 1 && 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black',
                  agent.rank === 2 && 'bg-gradient-to-br from-gray-300 to-gray-400 text-black',
                  agent.rank === 3 && 'bg-gradient-to-br from-amber-600 to-orange-700 text-white',
                  agent.rank > 3 && 'bg-[rgba(var(--card)/0.5)] text-[rgb(var(--foreground-muted))]'
                )}
              >
                {agent.rank === 1 ? (
                  <Crown className="w-4 h-4" />
                ) : agent.rank <= 3 ? (
                  <Medal className="w-4 h-4" />
                ) : (
                  agent.rank
                )}
              </div>

              {/* Info */}
              <div>
                <div className={cn(
                  'text-sm font-medium',
                  isTopThree ? 'text-white' : 'text-[rgb(var(--foreground-muted))]'
                )}>
                  {agent.name}
                </div>
                {agent.ownerXHandle && (
                  <div className="text-xs text-[rgb(var(--brand-red))]">
                    @{agent.ownerXHandle}
                  </div>
                )}
              </div>
            </div>

            {/* Points */}
            <div className="flex items-center gap-1">
              <span className={cn(
                'text-sm font-semibold',
                isTopThree ? 'text-[rgb(var(--brand-cyan))]' : 'text-white'
              )}>
                {formatPoints(agent.points)}
              </span>
              <span className="text-xs text-[rgb(var(--foreground-muted))]">分</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
