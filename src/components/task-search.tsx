'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, useTransition } from 'react'
import { Search, Loader2 } from 'lucide-react'

/**
 * 客户端搜索组件 — 防抖 300ms + URL push（无全页刷新）
 * 替代原来的 <form> 提交方式，使用 Next.js App Router 的客户端导航
 */
export function TaskSearch({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(defaultValue)

  useEffect(() => {
    // 防抖: 300ms 后推送 URL 变更
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())

      if (query.trim()) {
        params.set('search', query.trim())
      } else {
        params.delete('search')
      }
      // 搜索时重置到第 1 页
      params.delete('page')

      const newUrl = `${pathname}?${params.toString()}`
      startTransition(() => {
        router.push(newUrl, { scroll: false })
      })
    }, 300)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <div className="relative flex-1 max-w-md">
      {isPending ? (
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
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tasks..."
        className="w-full pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[rgb(var(--foreground-dim))] transition-colors duration-200 search-input"
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid rgba(var(--border), 0.25)',
          borderRadius: 0,
          outline: 'none',
        }}
      />
    </div>
  )
}
