'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push('/admin')
      } else {
        setError('密码错误')
      }
    } catch {
      setError('登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--background))' }}>
      <div
        className="w-full max-w-sm rounded-xl border p-8"
        style={{
          background: 'rgb(var(--background-secondary))',
          borderColor: 'rgba(var(--border), 0.4)',
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <Lock className="w-5 h-5" style={{ color: 'rgb(var(--brand-primary))' }} />
          <h1 className="text-lg font-bold text-white">管理后台登录</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'rgb(var(--foreground-dim))' }}>
              管理员密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all"
              style={{
                background: 'rgba(var(--border), 0.2)',
                border: '1px solid rgba(var(--border), 0.4)',
              }}
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'rgb(var(--error))' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: 'rgb(var(--brand-primary))' }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
