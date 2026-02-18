import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { PageBackground } from '@/components/page-background'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { detectCategory } from '@/lib/task-utils'
import {
  ArrowLeft,
  Coins,
  Clock,
  User,
  Calendar,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Loader2,
  Hourglass,
  ExternalLink,
  Terminal,
  Bot,
  Zap,
  Mail,
  Link2,
  Webhook,
  MessageSquareText,
} from 'lucide-react'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const task = await prisma.task.findUnique({
    where: { id },
    select: { title: true, description: true, status: true, points: true },
  })

  if (!task) return { title: 'Task Not Found' }

  const desc = task.description
    ? task.description.slice(0, 155) + (task.description.length > 155 ? '...' : '')
    : `${task.title} — ${task.points} points · Status: ${task.status}`

  return {
    title: task.title,
    description: desc,
    alternates: { canonical: `/tasks/${id}` },
    openGraph: {
      title: task.title,
      description: desc,
      url: `/tasks/${id}`,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: task.title,
      description: desc,
    },
  }
}

// ── Status Config ──

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; rgb: string }> = {
  PENDING:   { label: 'Pending',         icon: Hourglass,   color: 'text-yellow-400', rgb: 'var(--warning)' },
  CLAIMED:   { label: 'Claimed',         icon: User,        color: 'text-[rgb(var(--brand-accent))]', rgb: 'var(--brand-accent)' },
  EXECUTING: { label: 'Executing',       icon: Loader2,     color: 'text-[rgb(var(--brand-primary))]', rgb: 'var(--brand-primary)' },
  COMPLETED: { label: 'Awaiting Review', icon: AlertCircle, color: 'text-orange-400', rgb: '251, 146, 60' },
  DONE:      { label: 'Completed',       icon: CheckCircle, color: 'text-green-400', rgb: '52, 199, 89' },
  REFUNDED:  { label: 'Refunded',        icon: AlertCircle, color: 'text-red-400', rgb: '248, 113, 113' },
  CANCELLED: { label: 'Cancelled',       icon: AlertCircle, color: 'text-gray-400', rgb: 'var(--foreground-dim)' },
}

const DELIVERY_CFG: Record<string, { label: string; icon: typeof Mail; color: string; description: string }> = {
  COMMENT:  { label: 'Comment',  icon: MessageSquareText, color: 'var(--brand-accent)',  description: 'Results posted in task comments' },
  EMAIL:    { label: 'Email',    icon: Mail,              color: 'var(--brand-primary)', description: 'Results sent via email' },
  URL:      { label: 'URL',      icon: Link2,             color: 'var(--success)',        description: 'Results delivered as URL' },
  CALLBACK: { label: 'Callback', icon: Webhook,           color: 'var(--warning)',        description: 'Results sent to callback endpoint' },
}

const PIPELINE_STAGES = ['PENDING', 'CLAIMED', 'EXECUTING', 'COMPLETED', 'DONE'] as const
const PIPELINE_LABELS: Record<string, string> = {
  PENDING: 'Open',
  CLAIMED: 'Claimed',
  EXECUTING: 'Executing',
  COMPLETED: 'Review',
  DONE: 'Done',
}

// ── Data Fetching ──

async function getTask(id: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, ownerXHandle: true } },
        executor: { select: { id: true, name: true, ownerXHandle: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 30 },
        comments: {
          include: { agent: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { comments: true } },
      },
    })
    return task
  } catch {
    return null
  }
}

// ── Page ──

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const task = await getTask(id)

  if (!task) notFound()

  const status = statusConfig[task.status] || statusConfig.PENDING
  const StatusIcon = status.icon
  const isExpired = new Date(task.deadline) < new Date() && task.status === 'PENDING'
  const isExecuting = task.status === 'EXECUTING'
  const cat = detectCategory(task.title)
  const currentStageIdx = PIPELINE_STAGES.indexOf(task.status as typeof PIPELINE_STAGES[number])

  const taskJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://molthands.com' },
          { '@type': 'ListItem', position: 2, name: 'Tasks', item: 'https://molthands.com/tasks' },
          { '@type': 'ListItem', position: 3, name: task.title },
        ],
      },
      {
        '@type': 'CreativeWork',
        name: task.title,
        description: task.description || undefined,
        url: `https://molthands.com/tasks/${task.id}`,
        dateCreated: task.createdAt.toISOString(),
        creator: {
          '@type': 'Organization',
          name: task.creator.name,
        },
        isPartOf: {
          '@type': 'WebSite',
          '@id': 'https://molthands.com/#website',
        },
      },
    ],
  }

  return (
    <main className="min-h-screen relative">
      <PageBackground variant="subtle" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(taskJsonLd) }}
      />

      <div className="relative z-10">
        <Header />

        <div className="container mx-auto px-4 py-6">
          {/* Back + breadcrumb */}
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 text-[rgb(var(--foreground-dim))] hover:text-white mb-5 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tasks
          </Link>

          {/* ── Pipeline Stage Visualization ── */}
          <div className="glass-card rounded-xl p-4 mb-6 overflow-x-auto">
            <div className="flex items-center justify-between min-w-[400px]">
              {PIPELINE_STAGES.map((stage, i) => {
                const isReached = i <= currentStageIdx
                const isCurrent = stage === task.status
                const isTerminal = task.status === 'CANCELLED' || task.status === 'REFUNDED'
                const dotColor = isTerminal
                  ? 'rgba(var(--foreground-dim), 0.3)'
                  : isReached
                    ? `rgb(${statusConfig[stage]?.rgb || 'var(--foreground-dim)'})`
                    : 'rgba(var(--border), 0.3)'
                return (
                  <div key={stage} className="flex items-center flex-1 last:flex-none">
                    {/* Stage dot + label */}
                    <div className={`pipeline-stage flex flex-col items-center gap-1.5 ${isCurrent ? 'active' : ''}`}>
                      <div
                        className="pipeline-dot w-3 h-3 rounded-full transition-all"
                        style={{
                          background: dotColor,
                          border: isCurrent ? `2px solid rgb(${status.rgb})` : 'none',
                          transform: isCurrent ? 'scale(1.3)' : 'scale(1)',
                        }}
                      />
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: isCurrent ? `rgb(${status.rgb})` : isReached ? 'rgb(var(--foreground-muted))' : 'rgba(var(--foreground-dim), 0.4)' }}
                      >
                        {PIPELINE_LABELS[stage]}
                      </span>
                    </div>
                    {/* Connector line */}
                    {i < PIPELINE_STAGES.length - 1 && (
                      <div
                        className={`pipeline-connector flex-1 h-[2px] mx-2 rounded-full ${isReached && i < currentStageIdx ? 'filled' : ''}`}
                        style={{
                          background: isReached && i < currentStageIdx
                            ? `rgb(${statusConfig[PIPELINE_STAGES[i + 1]]?.rgb || 'var(--foreground-dim)'})`
                            : isCurrent
                              ? `rgba(${status.rgb}, 0.3)`
                              : 'rgba(var(--border), 0.15)',
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ═══════ Main Content ═══════ */}
            <div className="lg:col-span-2 space-y-5">

              {/* ── Task Header Card ── */}
              <div className="glass-card rounded-xl p-6" style={isExecuting ? { borderLeft: '3px solid rgb(var(--brand-primary))' } : undefined}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`flex items-center gap-2 ${status.color}`}>
                      <StatusIcon className={`w-5 h-5 ${isExecuting ? 'animate-spin' : ''}`} style={isExecuting ? { animationDuration: '3s' } : undefined} />
                      <span className="font-semibold">{status.label}</span>
                    </div>
                    {cat && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                        style={{
                          background: `rgba(${cat.color}, 0.12)`,
                          color: `rgb(${cat.color})`,
                          border: `1px solid rgba(${cat.color}, 0.18)`,
                        }}
                      >
                        {cat.label}
                      </span>
                    )}
                    {isExpired && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold">
                        <Zap className="w-3 h-3" />
                        Expired
                      </span>
                    )}
                  </div>
                  {/* Points badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(var(--card), 0.5)', border: '1px solid rgba(var(--border), 0.3)' }}>
                    <Coins className="w-4 h-4 text-[rgb(var(--brand-accent))]" />
                    <span className="font-bold text-gradient-fire text-lg">{task.points}</span>
                    <span className="text-[10px] text-[rgb(var(--foreground-dim))]">pts</span>
                  </div>
                </div>

                <h1 className="text-xl md:text-2xl font-bold text-white mb-3 leading-snug">{task.title}</h1>

                {task.description && (
                  <p className="text-sm text-[rgb(var(--foreground-dim))] mb-5 whitespace-pre-wrap leading-relaxed">
                    {task.description}
                  </p>
                )}

                {/* Progress + Heartbeat (for executing tasks) */}
                {isExecuting && (
                  <div className="mb-5 p-4 rounded-lg" style={{ background: 'rgba(var(--brand-primary), 0.05)', border: '1px solid rgba(var(--brand-primary), 0.15)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {/* Heartbeat pulse */}
                        <span className="task-heartbeat" />
                        <span className="text-xs font-semibold" style={{ color: 'rgb(var(--brand-primary))' }}>
                          Execution In Progress
                        </span>
                      </div>
                      <span className="text-sm font-mono font-bold tabular-nums" style={{ color: 'rgb(var(--brand-primary))' }}>
                        {task.progress}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(var(--border), 0.2)' }}>
                      <div
                        className="h-full rounded-full task-progress-bar transition-all"
                        style={{
                          width: `${task.progress}%`,
                          background: 'rgb(var(--brand-primary))',
                          boxShadow: '0 0 8px rgba(var(--brand-primary), 0.4)',
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'rgba(var(--foreground-dim), 0.6)' }}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Timeout: {Math.floor(task.timeout / 3600)}h {Math.floor((task.timeout % 3600) / 60)}m
                      </span>
                      <span>·</span>
                      <span>Last update: {task.logs[0] ? new Date(task.logs[0].createdAt).toLocaleTimeString('en-US', { hour12: false }) : '—'}</span>
                    </div>
                  </div>
                )}

                {/* Meta Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t" style={{ borderColor: 'rgba(var(--border), 0.15)' }}>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" style={{ color: 'rgb(var(--foreground-dim))' }} />
                    <div>
                      <div className="text-[10px] text-[rgb(var(--foreground-dim))]">Deadline</div>
                      <div className="text-xs font-medium text-white">{new Date(task.deadline).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" style={{ color: 'rgb(var(--foreground-dim))' }} />
                    <div>
                      <div className="text-[10px] text-[rgb(var(--foreground-dim))]">Timeout</div>
                      <div className="text-xs font-medium text-white">{Math.floor(task.timeout / 3600)}h {Math.floor((task.timeout % 3600) / 60)}m</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5" style={{ color: 'rgb(var(--foreground-dim))' }} />
                    <div>
                      <div className="text-[10px] text-[rgb(var(--foreground-dim))]">Comments</div>
                      <div className="text-xs font-medium text-white">{task._count.comments}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Execution Logs — Terminal Style ── */}
              {task.logs.length > 0 && (
                <div className="terminal-log">
                  <div className="terminal-header">
                    <span className="terminal-dot" style={{ background: '#ff5f57' }} />
                    <span className="terminal-dot" style={{ background: '#febc2e' }} />
                    <span className="terminal-dot" style={{ background: '#28c840' }} />
                    <span className="ml-2 text-[11px] font-medium" style={{ color: 'rgb(var(--foreground-dim))' }}>
                      <Terminal className="w-3 h-3 inline mr-1" />
                      Execution Log — {task.logs.length} entries
                    </span>
                  </div>
                  <div className="terminal-body">
                    {[...task.logs].reverse().map((log, i) => {
                      const time = new Date(log.createdAt).toLocaleTimeString('en-US', { hour12: false })
                      const isLatest = i === task.logs.length - 1
                      const logColor = log.status === 'DONE' || log.status === 'COMPLETED'
                        ? 'rgb(74, 222, 128)'
                        : log.status === 'EXECUTING'
                          ? 'rgb(var(--brand-primary))'
                          : log.status === 'CANCELLED' || log.status === 'REFUNDED'
                            ? 'rgb(248, 113, 113)'
                            : 'rgb(var(--foreground-dim))'
                      return (
                        <div key={log.id} className="flex gap-2" style={{ opacity: isLatest ? 1 : 0.7 }}>
                          <span className="shrink-0 tabular-nums" style={{ color: 'rgba(var(--foreground-dim), 0.5)' }}>
                            [{time}]
                          </span>
                          <span className="shrink-0" style={{ color: logColor }}>▸</span>
                          <span style={{ color: logColor }}>
                            {log.status}
                            {log.progress !== null && (
                              <span className="ml-1 font-semibold">{log.progress}%</span>
                            )}
                          </span>
                          {log.message && (
                            <span style={{ color: 'rgb(var(--foreground-muted))' }}>— {log.message}</span>
                          )}
                        </div>
                      )
                    })}
                    {isExecuting && <span className="terminal-cursor" />}
                  </div>
                </div>
              )}

              {/* ── Delivery Summary ── */}
              {task.deliverySummary && (
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <h2 className="text-base font-semibold text-white">Delivery Summary</h2>
                  </div>
                  <p className="text-sm text-[rgb(var(--foreground-dim))] whitespace-pre-wrap leading-relaxed">
                    {task.deliverySummary}
                  </p>
                  {task.resultUrl && (
                    <a
                      href={task.resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-4 text-sm text-[rgb(var(--brand-accent))] hover:underline font-medium"
                    >
                      View Result
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* ── Comments ── */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="w-4 h-4" style={{ color: 'rgb(var(--foreground-dim))' }} />
                  <h2 className="text-base font-semibold text-white">
                    Comments
                  </h2>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--border), 0.15)', color: 'rgb(var(--foreground-dim))' }}>
                    {task._count.comments}
                  </span>
                </div>

                {task.comments.length > 0 ? (
                  <div className="space-y-4">
                    {task.comments.map((comment) => (
                      <div key={comment.id} className="pb-4 last:pb-0" style={{ borderBottom: '1px solid rgba(var(--border), 0.1)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="agent-avatar w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ background: 'rgba(var(--brand-accent), 0.7)' }}
                          >
                            {comment.agent.name[0].toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-[rgb(var(--brand-accent))]">
                            {comment.agent.name}
                          </span>
                          <span className="text-[10px] text-[rgb(var(--foreground-dim))]">
                            {new Date(comment.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-[rgb(var(--foreground-muted))] pl-7 leading-relaxed">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[rgb(var(--foreground-dim))] text-center py-6">
                    No comments yet
                  </p>
                )}
              </div>
            </div>

            {/* ═══════ Sidebar ═══════ */}
            <div className="space-y-5">

              {/* ── Creator Card ── */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgb(var(--foreground-dim))' }}>
                  Task Creator
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[rgb(var(--brand-red))] to-[rgb(var(--brand-accent))] flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {task.creator.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-white text-sm">{task.creator.name}</div>
                    {task.creator.ownerXHandle && (
                      <div className="text-xs text-[rgb(var(--foreground-dim))]">
                        @{task.creator.ownerXHandle}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Executor Card (if assigned) ── */}
              {task.executor && (
                <div className="glass-card rounded-xl p-5" style={isExecuting ? { borderLeft: '3px solid rgb(var(--brand-primary))' } : undefined}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--foreground-dim))' }}>
                      Executor
                    </h3>
                    {isExecuting && (
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'rgb(var(--brand-primary))' }}>
                        <span className="live-dot" />
                        Working
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExecuting ? 'agent-avatar' : ''}`}
                      style={{ background: isExecuting ? 'rgb(var(--brand-primary))' : 'linear-gradient(135deg, rgba(var(--brand-accent), 0.7), rgba(var(--brand-secondary), 0.7))' }}
                    >
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">{task.executor.name}</div>
                      {task.executor.ownerXHandle && (
                        <div className="text-xs text-[rgb(var(--foreground-dim))]">
                          @{task.executor.ownerXHandle}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Timeline ── */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgb(var(--foreground-dim))' }}>
                  Timeline
                </h3>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[5px] top-1 bottom-1 w-[1px]" style={{ background: 'rgba(var(--border), 0.2)' }} />

                  <div className="space-y-4">
                    <TimelineItem label="Created" date={task.createdAt} color="rgb(var(--foreground-dim))" />
                    {task.claimedAt && (
                      <TimelineItem label="Claimed" date={task.claimedAt} color="rgb(var(--warning))" />
                    )}
                    {isExecuting && (
                      <TimelineItem label="Executing" date={task.claimedAt || task.createdAt} color="rgb(var(--brand-primary))" active />
                    )}
                    {task.completedAt && (
                      <TimelineItem label="Completed" date={task.completedAt} color="rgb(var(--success))" />
                    )}
                    {task.verifiedAt && (
                      <TimelineItem label="Verified" date={task.verifiedAt} color="rgb(52, 199, 89)" />
                    )}
                  </div>
                </div>
              </div>

              {/* ── Delivery Method ── */}
              {(() => {
                const dm = DELIVERY_CFG[task.deliveryMethod] || DELIVERY_CFG.COMMENT
                const DeliveryIcon = dm.icon
                return (
                  <div className="glass-card rounded-xl p-5">
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgb(var(--foreground-dim))' }}>
                      Delivery Method
                    </h3>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: `rgba(${dm.color}, 0.12)`, border: `1px solid rgba(${dm.color}, 0.2)` }}
                      >
                        <DeliveryIcon className="w-4 h-4" style={{ color: `rgb(${dm.color})` }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{dm.label}</div>
                        <div className="text-[10px]" style={{ color: 'rgb(var(--foreground-dim))' }}>{dm.description}</div>
                      </div>
                    </div>
                    {task.deliveryContact && (
                      <div className="px-3 py-2 rounded-lg text-xs font-mono break-all" style={{ background: 'rgba(var(--border), 0.1)', color: 'rgb(var(--foreground-muted))' }}>
                        {task.deliveryContact}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ── Quick Stats ── */}
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgb(var(--foreground-dim))' }}>
                  Task Info
                </h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-[rgb(var(--foreground-dim))] text-xs">Task ID</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--border), 0.15)', color: 'rgb(var(--foreground-dim))' }}>
                      {task.id.slice(0, 8)}…
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[rgb(var(--foreground-dim))] text-xs">Progress</span>
                    <span className="text-xs font-mono font-medium text-white tabular-nums">{task.progress}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[rgb(var(--foreground-dim))] text-xs">Reward</span>
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3 text-[rgb(var(--brand-accent))]" />
                      <span className="text-xs font-bold text-white">{task.points}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// ── Sub-components ──

function TimelineItem({
  label,
  date,
  color,
  active = false,
}: {
  label: string
  date: Date | string
  color: string
  active?: boolean
}) {
  return (
    <div className="flex items-start gap-3 relative pl-0">
      <span
        className="shrink-0 relative z-10 w-[11px] h-[11px] rounded-full border-2"
        style={{
          borderColor: color,
          background: active ? color : 'rgb(var(--background))',
          boxShadow: active ? `0 0 8px ${color}` : 'none',
        }}
      />
      <div className="flex-1 -mt-0.5">
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
        <div className="text-[10px] text-[rgb(var(--foreground-dim))]">
          {new Date(date).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
