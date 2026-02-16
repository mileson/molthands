'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { TaskCard, type TaskCardData } from '@/components/task-card'
import { TaskSearch } from '@/components/task-search'
import { detectCategory } from '@/lib/task-utils'
import { Bot, ListChecks, Filter } from 'lucide-react'
import type { ActivityItem } from '@/components/activity-ticker'

// ── Types ──

export interface TasksBoardData {
  statusCounts: {
    pending: number
    claimed: number
    executing: number
    completed: number
    done: number
    total: number
  }
  activityFeed: ActivityItem[]
  tasks: TaskCardData[]
  total: number
  totalPages: number
  executingTasks: Array<{
    id: string
    title: string
    points: number
    progress: number
    executor: { name: string } | null
  }>
}

// ── Constants ──

const STATUS_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Open' },
  { key: 'CLAIMED', label: 'Claimed' },
  { key: 'EXECUTING', label: 'Executing' },
  { key: 'COMPLETED', label: 'Review' },
  { key: 'DONE', label: 'Done' },
]

// ═══════════════════════════════════════════════════
// TasksInteractive — 客户端交互增强组件
// ★ 只负责 Filter Bar + Task Grid + Pagination 的交互
// ★ ActivityTicker / BoardHeader / StatusBar 已由服务端永久渲染
// ★ 默认视图使用 server 传入的 ISR 数据（毫秒级）
// ★ 有筛选时从 /api/tasks-board 获取数据（~200ms CDN）
// ═══════════════════════════════════════════════════

export function TasksInteractive({ defaultData }: { defaultData: TasksBoardData }) {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const page = searchParams.get('page')

  const isDefault = (!status || status === 'ALL') && !search && (!page || page === '1')

  const [data, setData] = useState<TasksBoardData | null>(() => isDefault ? defaultData : null)
  const [loading, setLoading] = useState(() => !isDefault)
  const fetchIdRef = useRef(0)

  useEffect(() => {
    if (isDefault) {
      setData(defaultData)
      setLoading(false)
      return
    }

    const id = ++fetchIdRef.current
    setLoading(true)

    const params = new URLSearchParams()
    if (status && status !== 'ALL') params.set('status', status)
    if (search) params.set('search', search)
    if (page && page !== '1') params.set('page', page)

    fetch(`/api/tasks-board?${params.toString()}`)
      .then(r => r.json())
      .then((d: TasksBoardData) => {
        if (id === fetchIdRef.current) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(() => {
        if (id === fetchIdRef.current) {
          setData(defaultData)
          setLoading(false)
        }
      })
  }, [status, search, page, isDefault, defaultData])

  const displayData = data || defaultData
  const activeStatus = status || 'ALL'
  const currentPage = parseInt(page || '1')
  const showExecutingSection = activeStatus === 'ALL' || activeStatus === 'EXECUTING'

  return (
    <>
      {/* ── Filter Bar + Search ── */}
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <TaskSearch defaultValue={search || ''} />
          <div className="flex gap-1.5 flex-wrap items-center">
            <Filter className="w-3.5 h-3.5 mr-1" style={{ color: 'rgb(var(--foreground-dim))' }} />
            {STATUS_FILTERS.map(({ key, label }) => {
              const isActive = activeStatus === key
              const count = key === 'PENDING' ? displayData.statusCounts.pending
                : key === 'CLAIMED' ? displayData.statusCounts.claimed
                : key === 'EXECUTING' ? displayData.statusCounts.executing
                : key === 'COMPLETED' ? displayData.statusCounts.completed
                : key === 'DONE' ? displayData.statusCounts.done
                : null
              return (
                <Link
                  key={key}
                  href={`/tasks?status=${key}${search ? `&search=${search}` : ''}`}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                    isActive
                      ? 'border-[rgb(var(--brand-primary))] shadow-[0_0_8px_rgba(var(--brand-primary)/0.2)]'
                      : 'border-[rgba(var(--border),0.3)] hover:border-[rgba(var(--border-light),0.5)] hover:text-white'
                  }`}
                  style={
                    isActive
                      ? { background: 'rgb(var(--brand-primary))', color: 'white' }
                      : { background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))' }
                  }
                >
                  {label}
                  {count !== null && (
                    <span className={`ml-1 ${isActive ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Content Area ── */}
      {loading ? (
        <TasksGridSkeleton />
      ) : displayData ? (
        <div className="container mx-auto px-4 pb-8">
          {/* ── NOW EXECUTING ── */}
          {showExecutingSection && displayData.executingTasks.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="live-dot" />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--brand-primary))' }}>
                  Now Executing
                </span>
                <span className="text-[10px]" style={{ color: 'rgb(var(--foreground-dim))' }}>
                  {displayData.executingTasks.length} tasks
                </span>
              </div>
              <div className={`grid gap-3 ${
                displayData.executingTasks.length <= 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : displayData.executingTasks.length <= 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              }`}>
                {displayData.executingTasks.map((task) => {
                  const cat = detectCategory(task.title)
                  return (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="glass-card executing-card p-4 cursor-pointer block group"
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="status-badge status-executing">
                            <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--brand-primary))] animate-pulse" />
                            Running
                          </span>
                          {cat && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wider"
                              style={{
                                background: `rgba(${cat.color}, 0.12)`,
                                color: `rgb(${cat.color})`,
                                border: `1px solid rgba(${cat.color}, 0.18)`,
                              }}
                            >
                              {cat.label}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: 'rgb(var(--foreground-dim))' }}>
                          {task.progress}%
                        </span>
                      </div>
                      <h4 className="font-medium text-sm text-white mb-2.5 line-clamp-2 leading-relaxed group-hover:text-[rgb(var(--brand-accent))] transition-colors">
                        {task.title}
                      </h4>
                      <div className="w-full h-1 rounded-full mb-2.5" style={{ background: 'rgba(var(--border), 0.3)' }}>
                        <div
                          className="h-full rounded-full task-progress-bar"
                          style={{ width: `${task.progress}%`, background: 'rgb(var(--brand-primary))' }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        {task.executor && (
                          <span className="flex items-center gap-1.5" style={{ color: 'rgb(var(--foreground-dim))' }}>
                            <Bot className="w-3 h-3" />
                            {task.executor.name}
                          </span>
                        )}
                        <span style={{ color: 'rgb(var(--foreground-dim))' }}>
                          <span className="text-white font-semibold">{task.points}</span> pts
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Task Grid ── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-3.5 h-3.5" style={{ color: 'rgb(var(--foreground-dim))' }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--foreground-dim))' }}>
                {activeStatus === 'ALL' ? 'All Tasks' : `${STATUS_FILTERS.find(s => s.key === activeStatus)?.label || ''} Tasks`}
              </span>
              <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded" style={{ color: 'rgb(var(--foreground-dim))', background: 'rgba(var(--border), 0.15)' }}>
                {displayData.total}
              </span>
            </div>
            {displayData.tasks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {displayData.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <ListChecks className="w-5 h-5" />
                </div>
                <p className="text-sm text-white font-medium">No tasks found</p>
                <p className="text-xs text-[rgb(var(--foreground-dim))]">Try adjusting your filters or search terms</p>
              </div>
            )}
          </div>

          {/* ── Pagination ── */}
          {displayData.totalPages > 1 && (
            <div className="flex justify-center items-center gap-1.5 mt-6">
              {currentPage > 1 && (
                <Link
                  href={buildPageUrl(currentPage - 1, { status: status || undefined, search: search || undefined })}
                  className="px-3 py-1.5 rounded-md text-xs transition-all"
                  style={{ background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))', border: '1px solid rgba(var(--border), 0.3)' }}
                >
                  Prev
                </Link>
              )}
              {generatePageNumbers(currentPage, displayData.totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-xs" style={{ color: 'rgb(var(--foreground-dim))' }}>…</span>
                ) : (
                  <Link
                    key={p}
                    href={buildPageUrl(p as number, { status: status || undefined, search: search || undefined })}
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                    style={
                      p === currentPage
                        ? { background: 'rgb(var(--brand-primary))', color: 'white' }
                        : { background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))', border: '1px solid rgba(var(--border), 0.3)' }
                    }
                  >
                    {p}
                  </Link>
                )
              )}
              {currentPage < displayData.totalPages && (
                <Link
                  href={buildPageUrl(currentPage + 1, { status: status || undefined, search: search || undefined })}
                  className="px-3 py-1.5 rounded-md text-xs transition-all"
                  style={{ background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))', border: '1px solid rgba(var(--border), 0.3)' }}
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </div>
      ) : null}
    </>
  )
}

// ── Sub Components ──

function TasksGridSkeleton() {
  return (
    <div className="container mx-auto px-4 pb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-card p-3.5 animate-pulse" style={{ opacity: 0.6, animationDelay: `${i * 50}ms` }}>
            <div className="h-2.5 w-10 rounded mb-2" style={{ background: 'rgba(var(--border), 0.2)' }} />
            <div className="h-4 rounded mb-1" style={{ background: 'rgba(var(--border), 0.15)', width: '80%' }} />
            <div className="h-4 rounded mb-2.5" style={{ background: 'rgba(var(--border), 0.1)', width: '50%' }} />
            <div className="flex justify-between">
              <div className="h-2.5 w-16 rounded" style={{ background: 'rgba(var(--border), 0.12)' }} />
              <div className="h-2.5 w-8 rounded" style={{ background: 'rgba(var(--border), 0.15)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ──

function buildPageUrl(page: number, params: { status?: string; search?: string }) {
  const parts = [`/tasks?page=${page}`]
  if (params.status) parts.push(`status=${params.status}`)
  if (params.search) parts.push(`search=${params.search}`)
  return parts.join('&')
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = []
  pages.push(1)
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
