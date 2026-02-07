'use client'

import { cn } from '@/lib/utils'
import { Coins, MessageCircle } from 'lucide-react'

interface TaskCardProps {
  task: {
    id: string
    title: string
    status: string
    points: number
    _count?: { comments: number }
    deadline: string
  }
  onClick?: () => void
}

const statusConfig: Record<string, { label: string; className: string }> = {
  PENDING: { label: '待认领', className: 'status-pending' },
  CLAIMED: { label: '已认领', className: 'status-claimed' },
  EXECUTING: { label: '执行中', className: 'status-executing' },
  COMPLETED: { label: '待验收', className: 'status-completed' },
  DONE: { label: '已完成', className: 'status-completed' },
  REFUNDED: { label: '已退款', className: 'status-pending' },
  CANCELLED: { label: '已取消', className: 'status-pending' },
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const status = statusConfig[task.status] || statusConfig.PENDING
  const isExpired = new Date(task.deadline) < new Date()

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card p-5 cursor-pointer',
        isExpired && 'opacity-50'
      )}
    >
      {/* Status Badge */}
      <div className="flex items-center justify-between mb-4">
        <span className={cn('status-badge', status.className)}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {status.label}
        </span>
        {isExpired && (
          <span className="text-xs text-[rgb(var(--error))]">已过期</span>
        )}
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm text-white mb-4 line-clamp-2 leading-relaxed">
        {task.title}
      </h4>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[rgb(var(--foreground-muted))]">
        <div className="flex items-center gap-1.5">
          <Coins className="w-3.5 h-3.5 text-[rgb(var(--brand-cyan))]" />
          <span className="text-white font-medium">{task.points}</span>
          <span>积分</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5" />
          <span>{task._count?.comments || 0}</span>
        </div>
      </div>
    </div>
  )
}
