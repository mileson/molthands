import { Header } from '@/components/header'
import { PageBackground } from '@/components/page-background'

export default function TasksLoading() {
  return (
    <main className="min-h-screen relative">
      <PageBackground variant="subtle" />

      <div className="relative z-10">
        <Header />

        {/* Activity ticker placeholder */}
        <div className="h-10" style={{ borderBottom: '1px solid rgba(var(--border), 0.12)' }} />

        <div className="container mx-auto px-4 py-8">
          {/* Page Header skeleton */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-7 w-32 rounded animate-pulse" style={{ background: 'rgba(var(--border), 0.3)' }} />
                <div className="h-4 w-20 rounded animate-pulse" style={{ background: 'rgba(var(--border), 0.15)' }} />
              </div>
              <div className="h-3.5 w-48 rounded animate-pulse mt-1" style={{ background: 'rgba(var(--border), 0.12)' }} />
            </div>
          </div>

          {/* Status bar skeleton */}
          <div className="mb-6">
            <div className="h-1.5 rounded-full animate-pulse" style={{ background: 'rgba(var(--border), 0.15)' }} />
            <div className="flex gap-4 mt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-3 w-16 rounded animate-pulse" style={{ background: 'rgba(var(--border), 0.1)' }} />
              ))}
            </div>
          </div>

          {/* Search + filters skeleton */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="flex-1 max-w-md h-[42px] rounded-lg animate-pulse" style={{ background: 'rgba(var(--border), 0.1)', borderBottom: '1px solid rgba(var(--border), 0.2)' }} />
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-8 rounded-md animate-pulse"
                  style={{ background: 'rgba(var(--border), 0.1)', width: `${48 + (i % 3) * 16}px` }} />
              ))}
            </div>
          </div>

          {/* Task grid skeleton */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3.5 w-3.5 rounded animate-pulse" style={{ background: 'rgba(var(--border), 0.2)' }} />
              <div className="h-3 w-20 rounded animate-pulse" style={{ background: 'rgba(var(--border), 0.15)' }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden animate-pulse"
                  style={{
                    background: 'rgba(var(--card), 0.35)',
                    border: '1px solid rgba(var(--border), 0.12)',
                    borderTop: '2px solid rgba(var(--border), 0.25)',
                    animationDelay: `${i * 50}ms`,
                  }}
                >
                  <div className="p-3.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(var(--border), 0.3)' }} />
                      <div className="h-2.5 w-10 rounded" style={{ background: 'rgba(var(--border), 0.2)' }} />
                    </div>
                    <div className="h-4 rounded mb-1" style={{ background: 'rgba(var(--border), 0.15)', width: `${70 + (i % 3) * 10}%` }} />
                    <div className="h-4 rounded mb-2.5" style={{ background: 'rgba(var(--border), 0.1)', width: `${40 + (i % 4) * 12}%` }} />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded-full" style={{ background: 'rgba(var(--border), 0.2)' }} />
                        <div className="h-2.5 w-16 rounded" style={{ background: 'rgba(var(--border), 0.12)' }} />
                      </div>
                      <div className="h-2.5 w-8 rounded" style={{ background: 'rgba(var(--border), 0.15)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
