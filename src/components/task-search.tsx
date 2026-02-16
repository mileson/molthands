'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
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
  const isInitialMount = useRef(true)

  const currentSearch = searchParams.get('search') || ''
  useEffect(() => {
    setQuery(currentSearch)
  }, [currentSearch])

  const pushSearch = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value.trim()) {
      params.set('search', value.trim())
    } else {
      params.delete('search')
    }
    params.delete('page')

    const newUrl = `${pathname}?${params.toString()}`
    const currentUrl = `${pathname}?${searchParams.toString()}`
    if (newUrl === currentUrl) return

    startTransition(() => {
      router.push(newUrl, { scroll: false })
    })
  }, [pathname, searchParams, router])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const timer = setTimeout(() => {
      pushSearch(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, pushSearch])

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
        className="w-full pl-10 pr-4 py-2.5 text-sm text-white rounded-lg placeholder:text-[rgb(var(--foreground-dim))] transition-all duration-200 focus:outline-none search-input"
        style={{
          background: 'rgba(var(--border), 0.06)',
          border: '1px solid rgba(var(--border), 0.3)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(var(--brand-primary), 0.5)'
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(var(--brand-primary), 0.1)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(var(--border), 0.3)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}
