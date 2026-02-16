'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { TaskCard, type TaskCardData } from '@/components/task-card'
import { detectCategory } from '@/lib/task-utils'
import { Bot, ListChecks, Filter, Search, Loader2 } from 'lucide-react'
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
// TasksInteractive — 纯客户端状态驱动
// ★ 不使用 <Link> 导航 → 零服务端往返
// ★ 筛选/分页/搜索全部用 useState + pushState
// ★ 每次交互只有 1 次 API 调用（~100ms CDN 缓存）
// ═══════════════════════════════════════════════════

export function TasksInteractive({ defaultData }: { defaultData: TasksBoardData }) {
  const searchParams = useSearchParams()

  // ── 本地状态（初始化自 URL，之后完全由客户端管理）──
  const [activeStatus, setActiveStatus] = useState(() => searchParams.get('status') || 'ALL')
  const [activeSearch, setActiveSearch] = useState(() => searchParams.get('search') || '')
  const [activePage, setActivePage] = useState(() => parseInt(searchParams.get('page') || '1'))
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')

  const isDefault = activeStatus === 'ALL' && !activeSearch && activePage === 1

  const [data, setData] = useState<TasksBoardData>(() => isDefault ? defaultData : defaultData)
  const [loading, setLoading] = useState(() => !isDefault)
  const fetchIdRef = useRef(0)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const isInitialMount = useRef(true)

  // ── URL 更新（不触发 Next.js 导航）──
  const updateURL = useCallback((status: string, search: string, page: number) => {
    const params = new URLSearchParams()
    if (status && status !== 'ALL') params.set('status', status)
    if (search) params.set('search', search)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    const url = qs ? `/tasks?${qs}` : '/tasks'
    window.history.pushState({}, '', url)
  }, [])

  // ── 数据获取 ──
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (isDefault) return
    }

    if (isDefault) {
      setData(defaultData)
      setLoading(false)
      return
    }

    const id = ++fetchIdRef.current
    setLoading(true)

    const params = new URLSearchParams()
    if (activeStatus !== 'ALL') params.set('status', activeStatus)
    if (activeSearch) params.set('search', activeSearch)
    if (activePage > 1) params.set('page', String(activePage))

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
  }, [activeStatus, activeSearch, activePage, isDefault, defaultData])

  // ── 浏览器前进/后退支持 ──
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      setActiveStatus(params.get('status') || 'ALL')
      setActiveSearch(params.get('search') || '')
      setSearchInput(params.get('search') || '')
      setActivePage(parseInt(params.get('page') || '1'))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // ── 交互处理函数 ──
  const handleFilterClick = useCallback((status: string) => {
    setActiveStatus(status)
    setActivePage(1)
    updateURL(status, activeSearch, 1)
  }, [activeSearch, updateURL])

  const handlePageClick = useCallback((page: number) => {
    setActivePage(page)
    updateURL(activeStatus, activeSearch, page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeStatus, activeSearch, updateURL])

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setActiveSearch(value.trim())
      setActivePage(1)
      updateURL(activeStatus, value.trim(), 1)
    }, 300)
  }, [activeStatus, updateURL])

  const showExecutingSection = activeStatus === 'ALL' || activeStatus === 'EXECUTING'

  return (
    <>
      {/* ── Filter Bar + Search ── */}
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          {/* 内联搜索（不依赖 router.push）*/}
          <div className="relative flex-1 max-w-md">
            {loading ? (
              <Loader2
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
                style={{ color: 'rgb(var(--brand-primary))' }}
              />
            ) : (
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'rgb(var(--foreground-dim))' }}
              />
            )}
            <input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[rgb(var(--foreground-dim))] search-input"
            />
          </div>
          {/* 筛选按钮（button，不是 Link）*/}
          <div className="flex gap-1.5 flex-wrap items-center">
            <Filter className="w-3.5 h-3.5 mr-1" style={{ color: 'rgb(var(--foreground-dim))' }} />
            {STATUS_FILTERS.map(({ key, label }) => {
              const isActive = activeStatus === key
              const count = key === 'PENDING' ? data.statusCounts.pending
                : key === 'CLAIMED' ? data.statusCounts.claimed
                : key === 'EXECUTING' ? data.statusCounts.executing
                : key === 'COMPLETED' ? data.statusCounts.completed
                : key === 'DONE' ? data.statusCounts.done
                : null
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleFilterClick(key)}
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
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Content Area ── */}
      {loading ? (
        <TasksGridSkeleton />
      ) : (
        <div className="container mx-auto px-4 pb-8">
          {/* ── NOW EXECUTING ── */}
          {showExecutingSection && data.executingTasks.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="live-dot" />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--brand-primary))' }}>
                  Now Executing
                </span>
                <span className="text-[10px]" style={{ color: 'rgb(var(--foreground-dim))' }}>
                  {data.executingTasks.length} tasks
                </span>
              </div>
              <div className={`grid gap-3 ${
                data.executingTasks.length <= 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : data.executingTasks.length <= 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              }`}>
                {data.executingTasks.map((task) => {
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
                {data.total}
              </span>
            </div>
            {data.tasks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {data.tasks.map((task) => (
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

          {/* ── Pagination（button，不是 Link）── */}
          {data.totalPages > 1 && (
            <div className="flex justify-center items-center gap-1.5 mt-6">
              {activePage > 1 && (
                <button
                  type="button"
                  onClick={() => handlePageClick(activePage - 1)}
                  className="px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer"
                  style={{ background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))', border: '1px solid rgba(var(--border), 0.3)' }}
                >
                  Prev
                </button>
              )}
              {generatePageNumbers(activePage, data.totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-xs" style={{ color: 'rgb(var(--foreground-dim))' }}>…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePageClick(p as number)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
                    style={
                      p === activePage
                        ? { background: 'rgb(var(--brand-primary))', color: 'white' }
                        : { background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))', border: '1px solid rgba(var(--border), 0.3)' }
                    }
                  >
                    {p}
                  </button>
                )
              )}
              {activePage < data.totalPages && (
                <button
                  type="button"
                  onClick={() => handlePageClick(activePage + 1)}
                  className="px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer"
                  style={{ background: 'rgba(var(--card), 0.4)', color: 'rgb(var(--foreground-muted))', border: '1px solid rgba(var(--border), 0.3)' }}
                >
                  Next
                </button>
              )}
            </div>
          )}
        </div>
      )}
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
