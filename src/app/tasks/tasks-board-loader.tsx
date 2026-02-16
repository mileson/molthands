'use client'

import dynamic from 'next/dynamic'
import type { TasksBoardData } from './tasks-board'

/**
 * Client-only 加载器 — 使用 ssr: false 确保 useSearchParams() 不在服务端执行
 * 这样 page.tsx (Server Component) 保持纯静态，可被 ISR + CDN 缓存
 */
const TasksBoard = dynamic(
  () => import('./tasks-board').then(m => ({ default: m.TasksBoard })),
  {
    ssr: false,
    loading: () => (
      <div className="container mx-auto px-4 pt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-7 w-32 rounded animate-pulse" style={{ background: 'rgba(var(--border), 0.3)' }} />
          <div className="h-4 w-20 rounded animate-pulse" style={{ background: 'rgba(var(--border), 0.15)' }} />
        </div>
        <div className="h-1.5 rounded-full mb-6 animate-pulse" style={{ background: 'rgba(var(--border), 0.15)' }} />
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="flex-1 max-w-md h-[42px] rounded-lg animate-pulse" style={{ borderBottom: '1px solid rgba(var(--border), 0.2)' }} />
          <div className="flex gap-1.5">
            {[48, 64, 56, 72, 56, 56].map((w, i) => (
              <div key={i} className="h-8 rounded-md animate-pulse" style={{ background: 'rgba(var(--border), 0.1)', width: `${w}px` }} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card p-3.5 animate-pulse" style={{ opacity: 0.6 }}>
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
    ),
  },
)

export function TasksBoardLoader({ defaultData }: { defaultData: TasksBoardData }) {
  return <TasksBoard defaultData={defaultData} />
}
