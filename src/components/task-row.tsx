import Link from 'next/link'
import { Coins, MessageSquare, Zap } from 'lucide-react'
import { detectCategory, timeAgo } from '@/lib/task-utils'

interface TaskRowProps {
  task: {
    id: string
    title: string
    status: string
    points: number
    progress: number
    deadline: string
    executorName?: string | null
    creatorName?: string | null
    commentCount?: number
    createdAt?: string
  }
}

const STATUS_CFG: Record<string, { color: string; rgb: string; pulse: boolean; label: string }> = {
  PENDING:   { color: 'rgb(var(--foreground-dim))', rgb: 'var(--foreground-dim)', pulse: false, label: 'Open' },
  CLAIMED:   { color: 'rgb(var(--warning))',        rgb: 'var(--warning)',         pulse: false, label: 'Claimed' },
  EXECUTING: { color: 'rgb(var(--brand-primary))',  rgb: 'var(--brand-primary)',   pulse: true,  label: 'Running' },
  COMPLETED: { color: 'rgb(var(--success))',        rgb: 'var(--success)',         pulse: false, label: 'Review' },
  DONE:      { color: 'rgb(52, 199, 89)',           rgb: '52, 199, 89',           pulse: false, label: 'Done' },
  CANCELLED: { color: 'rgb(var(--foreground-dim))', rgb: 'var(--foreground-dim)', pulse: false, label: 'Cancelled' },
  REFUNDED:  { color: 'rgb(var(--foreground-dim))', rgb: 'var(--foreground-dim)', pulse: false, label: 'Refunded' },
}

/** 计算紧迫度：距离截止时间的紧迫程度 */
function getUrgency(deadline: string, status: string): 'hot' | 'soon' | null {
  if (status !== 'PENDING' && status !== 'CLAIMED') return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms < 0) return 'hot'
  if (ms < 3600_000) return 'hot'      // < 1h
  if (ms < 86400_000) return 'soon'     // < 24h
  return null
}

export function TaskRow({ task }: TaskRowProps) {
  const cfg = STATUS_CFG[task.status] || STATUS_CFG.PENDING
  const isRunning = task.status === 'EXECUTING'
  const isClaimed = task.status === 'CLAIMED'
  const cat = detectCategory(task.title)
  const ago = timeAgo(task.createdAt)
  const urgency = getUrgency(task.deadline, task.status)
  const agentName = task.executorName || (isClaimed ? task.creatorName : null)

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={`group relative flex items-center gap-2.5 pl-0 pr-4 py-2.5 transition-all hover:bg-[rgba(var(--card-hover),0.3)] cursor-pointer ${isRunning ? 'executing-row' : ''}`}
      style={{ borderBottom: '1px solid rgba(var(--border), 0.12)' }}
    >
      {/* Left accent bar — status-colored */}
      <span
        className="shrink-0 self-stretch rounded-r-sm"
        style={{
          width: isRunning ? '3px' : '2px',
          background: cfg.color,
          opacity: isRunning ? 1 : 0.5,
          boxShadow: isRunning ? `0 0 6px rgba(${cfg.rgb}, 0.4)` : 'none',
        }}
      />

      {/* Status dot + label */}
      <span className="relative shrink-0">
        <span className="block w-2 h-2 rounded-full" style={{ background: cfg.color }} />
        {cfg.pulse && (
          <span
            className="absolute inset-0 w-2 h-2 rounded-full animate-ping"
            style={{ background: cfg.color, opacity: 0.4 }}
          />
        )}
      </span>

      <span
        className="text-[10px] font-semibold uppercase tracking-wider w-[52px] shrink-0"
        style={{ color: cfg.color }}
      >
        {cfg.label}
      </span>

      {/* Urgency badge */}
      {urgency === 'hot' && (
        <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-px rounded bg-red-500/15 text-red-400 border border-red-500/20 uppercase tracking-wider">
          <Zap className="w-2.5 h-2.5" />
          Urgent
        </span>
      )}
      {urgency === 'soon' && (
        <span className="shrink-0 text-[9px] font-bold px-1.5 py-px rounded bg-amber-500/12 text-amber-400 border border-amber-500/18 uppercase tracking-wider">
          Soon
        </span>
      )}

      {/* Category tag */}
      {cat && (
        <span
          className="text-[9px] font-bold px-1.5 py-px rounded shrink-0 uppercase tracking-wider hidden sm:inline-block"
          style={{
            background: `rgba(${cat.color}, 0.12)`,
            color: `rgb(${cat.color})`,
            border: `1px solid rgba(${cat.color}, 0.18)`,
          }}
        >
          {cat.label}
        </span>
      )}

      {/* Title */}
      <span className="flex-1 text-sm text-white truncate group-hover:text-[rgb(var(--brand-accent))] transition-colors">
        {task.title}
      </span>

      {/* Progress bar (executing only) */}
      {isRunning && (
        <span className="shrink-0 flex items-center gap-1.5">
          <span className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(var(--border), 0.3)' }}>
            <span
              className="block h-full rounded-full transition-all task-progress-bar"
              style={{ width: `${task.progress}%`, background: cfg.color }}
            />
          </span>
          <span className="text-[10px] font-mono w-7 text-right tabular-nums" style={{ color: cfg.color }}>
            {task.progress}%
          </span>
        </span>
      )}

      {/* Comment count */}
      {(task.commentCount ?? 0) > 0 && (
        <span className="shrink-0 flex items-center gap-0.5 text-[10px] hidden md:flex" style={{ color: 'rgb(var(--foreground-dim))' }}>
          <MessageSquare className="w-2.5 h-2.5" />
          {task.commentCount}
        </span>
      )}

      {/* Relative time */}
      {ago && (
        <span className="shrink-0 text-[10px] tabular-nums hidden md:block" style={{ color: 'rgb(var(--foreground-dim))' }}>
          {ago}
        </span>
      )}

      {/* Agent mini-avatar */}
      {agentName && (
        <span className="shrink-0 flex items-center gap-1 hidden sm:flex">
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${isRunning ? 'agent-avatar' : ''}`}
            style={{ background: isRunning ? 'rgb(var(--brand-primary))' : 'rgba(var(--border), 0.5)' }}
          >
            {agentName[0].toUpperCase()}
          </span>
          <span className="text-[10px] hidden lg:inline-block truncate max-w-[60px]" style={{ color: 'rgb(var(--foreground-dim))' }}>
            {agentName}
          </span>
        </span>
      )}

      {/* Points */}
      <span className="shrink-0 flex items-center gap-1 text-xs" style={{ color: 'rgb(var(--foreground-dim))' }}>
        <Coins className="w-3 h-3" />
        <span className="font-semibold text-white tabular-nums">{task.points}</span>
      </span>
    </Link>
  )
}
