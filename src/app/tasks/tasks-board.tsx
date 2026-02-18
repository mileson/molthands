'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
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

const CACHE_TTL = 5 * 60 * 1000

function makeCacheKey(status: string, search: string, page: number) {
  return `${status}|${search}|${page}`
}

function buildApiUrl(status: string, search: string, page: number, light = false) {
  const params = new URLSearchParams()
  if (status !== 'ALL') params.set('status', status)
  if (search) params.set('search', search)
  if (page > 1) params.set('page', String(page))
  if (light) params.set('light', '1')
  return `/api/tasks-board?${params.toString()}`
}

// ═══════════════════════════════════════════════════
// TasksInteractive — 纯客户端状态驱动
// ★ 三级缓存策略：cache hit → stale data → skeleton
// ★ 预取相邻页面，翻页接近 0ms
// ★ 轻量 API 模式：翻页只查 tasks 不重复查全局数据
// ═══════════════════════════════════════════════════

export function TasksInteractive({ defaultData }: { defaultData: TasksBoardData }) {
  const searchParams = useSearchParams()

  const [activeStatus, setActiveStatus] = useState(() => searchParams.get('status') || 'ALL')
  const [activeSearch, setActiveSearch] = useState(() => searchParams.get('search') || '')
  const [activePage, setActivePage] = useState(() => parseInt(searchParams.get('page') || '1'))
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')

  const isDefault = activeStatus === 'ALL' && !activeSearch && activePage === 1

  const [data, setData] = useState<TasksBoardData>(() => defaultData)
  const [loading, setLoading] = useState(() => !isDefault)
  const [refreshing, setRefreshing] = useState(false)
  const fetchIdRef = useRef(0)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isInitialMount = useRef(true)

  // ── 客户端页面缓存 ──
  const cacheRef = useRef(new Map<string, { data: TasksBoardData; ts: number }>())
  const prefetchingRef = useRef(new Set<string>())
  const globalDataRef = useRef(defaultData)

  // 初始化：把默认数据存入缓存
  useEffect(() => {
    const key = makeCacheKey('ALL', '', 1)
    cacheRef.current.set(key, { data: defaultData, ts: Date.now() })
    globalDataRef.current = defaultData
  }, [defaultData])

  const updateURL = useCallback((status: string, search: string, page: number) => {
    const params = new URLSearchParams()
    if (status && status !== 'ALL') params.set('status', status)
    if (search) params.set('search', search)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    window.history.pushState({}, '', qs ? `/tasks?${qs}` : '/tasks')
  }, [])

  // ── 预取函数 ──
  const prefetch = useCallback((status: string, search: string, page: number) => {
    if (page < 1) return
    const key = makeCacheKey(status, search, page)
    if (cacheRef.current.has(key) || prefetchingRef.current.has(key)) return
    prefetchingRef.current.add(key)

    fetch(buildApiUrl(status, search, page, true))
      .then(r => r.json())
      .then((d: TasksBoardData | { tasks: TaskCardData[]; total: number; totalPages: number }) => {
        const full: TasksBoardData = 'statusCounts' in d
          ? d as TasksBoardData
          : { ...globalDataRef.current, tasks: d.tasks, total: d.total, totalPages: d.totalPages }
        cacheRef.current.set(key, { data: full, ts: Date.now() })
      })
      .catch(() => {})
      .finally(() => prefetchingRef.current.delete(key))
  }, [])

  // ── 预取相邻页 ──
  const prefetchAdjacent = useCallback((status: string, search: string, page: number, totalPages: number) => {
    if (page > 1) prefetch(status, search, page - 1)
    if (page < totalPages) prefetch(status, search, page + 1)
    if (page + 2 <= totalPages) prefetch(status, search, page + 2)
  }, [prefetch])

  // ── 数据获取（三级策略）──
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (isDefault) {
        prefetchAdjacent('ALL', '', 1, defaultData.totalPages)
        return
      }
    }

    if (isDefault) {
      setData(defaultData)
      setLoading(false)
      setRefreshing(false)
      prefetchAdjacent('ALL', '', 1, defaultData.totalPages)
      return
    }

    const key = makeCacheKey(activeStatus, activeSearch, activePage)
    const cached = cacheRef.current.get(key)

    // Level 1: 缓存命中（< 5min）→ 瞬间显示
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setData(cached.data)
      setLoading(false)
      setRefreshing(false)
      prefetchAdjacent(activeStatus, activeSearch, activePage, cached.data.totalPages)
      return
    }

    const id = ++fetchIdRef.current

    // Level 2: 有旧数据 → 显示旧数据 + 顶部进度条（stale-while-revalidate）
    if (cached) {
      setData(cached.data)
      setLoading(false)
      setRefreshing(true)
    } else {
      // Level 3: 无任何数据 → 骨架屏
      setLoading(true)
      setRefreshing(false)
    }

    const useLight = !activeSearch
    fetch(buildApiUrl(activeStatus, activeSearch, activePage, useLight))
      .then(r => r.json())
      .then((d: TasksBoardData | { tasks: TaskCardData[]; total: number; totalPages: number }) => {
        if (id !== fetchIdRef.current) return
        const full: TasksBoardData = 'statusCounts' in d
          ? d as TasksBoardData
          : { ...globalDataRef.current, tasks: d.tasks, total: d.total, totalPages: d.totalPages }

        if ('statusCounts' in d) globalDataRef.current = d as TasksBoardData

        cacheRef.current.set(key, { data: full, ts: Date.now() })
        setData(full)
        setLoading(false)
        setRefreshing(false)
        prefetchAdjacent(activeStatus, activeSearch, activePage, full.totalPages)
      })
      .catch(() => {
        if (id === fetchIdRef.current) {
          if (!cached) setData(defaultData)
          setLoading(false)
          setRefreshing(false)
        }
      })
  }, [activeStatus, activeSearch, activePage, isDefault, defaultData, prefetchAdjacent])

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

  // ── 交互处理 ──
  const handleFilterClick = useCallback((status: string) => {
    setActiveStatus(status)
    setActivePage(1)
    updateURL(status, activeSearch, 1)
  }, [activeSearch, updateURL])

  const taskGridRef = useRef<HTMLDivElement>(null)

  const handlePageClick = useCallback((page: number) => {
    setActivePage(page)
    updateURL(activeStatus, activeSearch, page)
    taskGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      {/* ── Refresh 进度条 ── */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
          <div
            className="h-full rounded-r-full animate-[progress_1.5s_ease-in-out_infinite]"
            style={{ background: 'rgb(var(--brand-primary))' }}
          />
        </div>
      )}

      {/* ── Filter Bar + Search ── */}
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
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
        <div className={`container mx-auto px-4 pb-8 transition-opacity duration-150 ${refreshing ? 'opacity-70' : ''}`}>
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
          <div ref={taskGridRef} className="mb-6 scroll-mt-20">
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

          {/* ── Pagination ── */}
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
                    onMouseEnter={() => prefetch(activeStatus, activeSearch, p as number)}
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
