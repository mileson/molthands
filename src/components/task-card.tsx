import Link from 'next/link'
import { Coins, MessageSquare, Zap, Bot, Clock, Mail, Link2, Webhook, MessageSquareText } from 'lucide-react'
import { detectCategory, timeAgo } from '@/lib/task-utils'

export interface TaskCardData {
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
  deliveryMethod?: string
}

const DELIVERY_MINI: Record<string, { icon: typeof Mail; label: string; color: string }> = {
  COMMENT:  { icon: MessageSquareText, label: 'Comment',  color: 'var(--brand-accent)' },
  EMAIL:    { icon: Mail,              label: 'Email',    color: 'var(--brand-primary)' },
  URL:      { icon: Link2,             label: 'URL',      color: 'var(--success)' },
  CALLBACK: { icon: Webhook,           label: 'Callback', color: 'var(--warning)' },
}

const STATUS_CFG: Record<string, { color: string; rgb: string; label: string; glow: boolean }> = {
  PENDING:   { color: 'rgb(var(--foreground-dim))', rgb: 'var(--foreground-dim)', label: 'Open',      glow: false },
  CLAIMED:   { color: 'rgb(var(--warning))',        rgb: 'var(--warning)',         label: 'Claimed',   glow: false },
  EXECUTING: { color: 'rgb(var(--brand-primary))',  rgb: 'var(--brand-primary)',   label: 'Running',   glow: true },
  COMPLETED: { color: 'rgb(var(--success))',        rgb: 'var(--success)',         label: 'Review',    glow: false },
  DONE:      { color: 'rgb(52, 199, 89)',           rgb: '52, 199, 89',           label: 'Done',      glow: false },
  CANCELLED: { color: 'rgb(var(--foreground-dim))', rgb: 'var(--foreground-dim)', label: 'Cancelled', glow: false },
  REFUNDED:  { color: 'rgb(var(--foreground-dim))', rgb: 'var(--foreground-dim)', label: 'Refunded',  glow: false },
}

function getUrgency(deadline: string, status: string): 'hot' | 'soon' | null {
  if (status !== 'PENDING' && status !== 'CLAIMED') return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms < 3600_000) return 'hot'
  if (ms < 86400_000) return 'soon'
  return null
}

export function TaskCard({ task }: { task: TaskCardData }) {
  const cfg = STATUS_CFG[task.status] || STATUS_CFG.PENDING
  const isRunning = task.status === 'EXECUTING'
  const cat = detectCategory(task.title)
  const ago = timeAgo(task.createdAt)
  const urgency = getUrgency(task.deadline, task.status)
  const agentName = task.executorName || (task.status === 'CLAIMED' ? task.creatorName : null)
  const dm = DELIVERY_MINI[task.deliveryMethod || 'COMMENT']
  const DeliveryIcon = dm?.icon || MessageSquareText

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={`group relative block rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer ${isRunning ? 'executing-card' : ''}`}
      style={{
        background: 'rgba(var(--card), 0.55)',
        backdropFilter: 'blur(16px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
        border: `1px solid rgba(var(--border), 0.22)`,
        borderTop: `2px solid ${cfg.color}`,
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      }}
    >
      {/* Running shimmer overlay */}
      {isRunning && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, transparent 60%, rgba(${cfg.rgb}, 0.04) 100%)`,
          }}
        />
      )}

      <div className="relative p-3.5">
        {/* Top row: status + category + time */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="relative shrink-0">
              <span className="block w-[6px] h-[6px] rounded-full" style={{ background: cfg.color }} />
              {cfg.glow && (
                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: cfg.color, opacity: 0.4 }} />
              )}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
            {cat && (
              <span
                className="text-[8px] font-bold px-1.5 py-px rounded uppercase tracking-wider"
                style={{
                  background: `rgba(${cat.color}, 0.1)`,
                  color: `rgb(${cat.color})`,
                  border: `1px solid rgba(${cat.color}, 0.15)`,
                }}
              >
                {cat.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {urgency === 'hot' && (
              <Zap className="w-3 h-3 text-red-400" />
            )}
            {ago && (
              <span className="text-[9px] tabular-nums" style={{ color: 'rgb(var(--foreground-dim))' }}>
                {ago}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-[13px] font-medium text-white leading-snug mb-2.5 line-clamp-2 group-hover:text-[rgb(var(--brand-accent))] transition-colors min-h-[36px]">
          {task.title}
        </h4>

        {/* Progress bar (executing) */}
        {isRunning && (
          <div className="mb-2.5">
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(var(--border), 0.25)' }}>
              <div
                className="h-full rounded-full task-progress-bar"
                style={{
                  width: `${task.progress}%`,
                  background: cfg.color,
                  boxShadow: `0 0 6px rgba(${cfg.rgb}, 0.3)`,
                }}
              />
            </div>
            <div className="flex justify-end mt-0.5">
              <span className="text-[9px] font-mono font-semibold tabular-nums" style={{ color: cfg.color }}>
                {task.progress}%
              </span>
            </div>
          </div>
        )}

        {/* Bottom row: agent + comments + points */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {agentName ? (
              <span className="flex items-center gap-1">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white ${isRunning ? 'agent-avatar' : ''}`}
                  style={{ background: isRunning ? `rgb(${cfg.rgb})` : 'rgba(var(--border), 0.4)' }}
                >
                  {agentName[0].toUpperCase()}
                </span>
                <span className="text-[10px] truncate max-w-[70px]" style={{ color: 'rgb(var(--foreground-dim))' }}>
                  {agentName}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(var(--foreground-dim), 0.5)' }}>
                <Bot className="w-3 h-3" />
                Available
              </span>
            )}
            {dm && (
              <span className="flex items-center gap-0.5 text-[8px] font-semibold px-1 py-px rounded uppercase tracking-wider"
                style={{ background: `rgba(${dm.color}, 0.08)`, color: `rgb(${dm.color})`, border: `1px solid rgba(${dm.color}, 0.12)` }}>
                <DeliveryIcon className="w-2.5 h-2.5" />
                {dm.label}
              </span>
            )}
            {(task.commentCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[9px]" style={{ color: 'rgb(var(--foreground-dim))' }}>
                <MessageSquare className="w-2.5 h-2.5" />
                {task.commentCount}
              </span>
            )}
          </div>
          <span className="flex items-center gap-0.5 text-[10px]" style={{ color: 'rgb(var(--foreground-dim))' }}>
            <Coins className="w-3 h-3" />
            <span className="font-bold text-white tabular-nums">{task.points}</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
