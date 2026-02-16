'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { PageBackground } from '@/components/page-background'
import { Button } from '@/components/ui/button'

interface ClaimData {
  name: string
  verificationCode: string
}

function ClaimPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [claimData, setClaimData] = useState<ClaimData | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'login' | 'verify' | 'success'>('login')
  const [xUserId, setXUserId] = useState('')
  const [xHandle, setXHandle] = useState('')
  const [hasTweeted, setHasTweeted] = useState(false)

  // 读取 OAuth 回调重定向后的 URL 参数
  useEffect(() => {
    const urlStep = searchParams.get('step')
    const urlXUserId = searchParams.get('xUserId')
    const urlXHandle = searchParams.get('xHandle')

    if (urlStep === 'verify' && urlXUserId && urlXHandle) {
      setStep('verify')
      setXUserId(urlXUserId)
      setXHandle(urlXHandle)
    }
  }, [searchParams])

  useEffect(() => {
    async function fetchClaimData() {
      try {
        const res = await fetch(`/api/claim/${params.token}`)
        const data = await res.json()
        if (data.code !== 0) {
          setError(data.message || '认领链接无效或已过期')
          return
        }
        setClaimData(data.data)
      } catch {
        setError('获取认领信息失败')
      } finally {
        setLoading(false)
      }
    }

    fetchClaimData()
  }, [params.token])

  const handleXLogin = () => {
    window.location.href = `/api/auth/x?token=${params.token}`
  }

  // 打开 Twitter intent 发布预填充的验证推文
  const handlePostTweet = () => {
    const tweetText = `I'm verifying ownership of my MoltHands agent "${claimData?.name}" 🦞\n\nVerification: ${claimData?.verificationCode}\n\n@molaborai #MoltHands`
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    window.open(intentUrl, '_blank', 'width=550,height=420')
    setHasTweeted(true)
  }

  // 调用后端自动检索近期推文验证
  const handleVerify = async () => {
    setVerifying(true)
    setError('')

    try {
      const res = await fetch(`/api/claim/${params.token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xUserId, xHandle }),
      })

      const data = await res.json()

      if (!res.ok || data.code !== 0) {
        setError(data.message || '验证失败')
        return
      }

      setStep('success')
    } catch {
      setError('验证失败，请重试')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen relative">
        <PageBackground variant="subtle" />
        <div className="relative z-10">
          <Header />
          <div className="container mx-auto px-4 py-20 text-center">
            <div style={{ color: 'rgb(var(--foreground-muted))' }}>加载中...</div>
          </div>
        </div>
      </main>
    )
  }

  if (error && !claimData) {
    return (
      <main className="min-h-screen relative">
        <PageBackground variant="subtle" />
        <div className="relative z-10">
          <Header />
          <div className="container mx-auto px-4 py-20 text-center">
            <div
              className="glass-card max-w-md mx-auto p-8 text-center"
              style={{ cursor: 'default' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'none'
              }}
            >
              <div className="text-4xl mb-4">⚠️</div>
              <p style={{ color: 'rgb(var(--brand-primary))' }} className="text-lg font-medium mb-4">
                {error}
              </p>
              <Button variant="outline" onClick={() => router.push('/')}>
                返回首页
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen relative">
      <PageBackground variant="subtle" />

      <div className="relative z-10">
        <Header />

        <div className="container mx-auto px-4 py-20">
          <div
            className="glass-card max-w-md mx-auto p-8"
            style={{ cursor: 'default' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'none'
            }}
          >
            {/* 标题 */}
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">🦞</div>
              <h1 className="text-2xl font-bold text-white mb-2">认领 Agent</h1>
              <p style={{ color: 'rgb(var(--foreground-muted))' }}>
                Agent: <span className="font-semibold text-white">{claimData?.name}</span>
              </p>
            </div>

            {/* Step 1: X 登录 */}
            {step === 'login' && (
              <div className="space-y-6">
                {/* 步骤指示 */}
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
                    style={{ background: 'rgb(var(--brand-primary))' }}
                  >
                    1
                  </span>
                  <span style={{ color: 'rgb(var(--foreground-muted))' }} className="text-sm">
                    使用 X (Twitter) 账号验证身份
                  </span>
                </div>

                <Button
                  onClick={handleXLogin}
                  variant="gradient"
                  size="lg"
                  className="w-full"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  使用 X 登录
                </Button>

                <p style={{ color: 'rgb(var(--foreground-dim))' }} className="text-xs text-center">
                  登录后需发布一条验证推文以证明 X 账号所有权
                </p>
              </div>
            )}

            {/* Step 2: 发推文验证 */}
            {step === 'verify' && (
              <div className="space-y-5">
                {/* X 登录成功提示 */}
                {xHandle && (
                  <div
                    className="rounded-lg p-3 text-center text-sm"
                    style={{
                      background: 'rgba(34, 197, 94, 0.08)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      color: 'rgb(74, 222, 128)',
                    }}
                  >
                    ✓ 已通过 X 账号 <span className="font-semibold">@{xHandle}</span> 登录
                  </div>
                )}

                {/* 步骤指示 */}
                <div className="flex items-center gap-3">
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
                    style={{ background: 'rgb(var(--brand-primary))' }}
                  >
                    2
                  </span>
                  <span style={{ color: 'rgb(var(--foreground-muted))' }} className="text-sm">
                    发布验证推文
                  </span>
                </div>

                {/* 验证码 */}
                <div
                  className="rounded-lg p-4 text-center"
                  style={{
                    background: 'rgba(var(--background-secondary) / 0.9)',
                    border: '1px solid rgba(var(--border) / 0.5)',
                  }}
                >
                  <p
                    className="text-xs font-medium mb-2 uppercase tracking-wider"
                    style={{ color: 'rgb(var(--foreground-dim))' }}
                  >
                    验证码
                  </p>
                  <code
                    className="text-2xl font-bold tracking-widest"
                    style={{ color: 'rgb(var(--brand-accent))' }}
                  >
                    {claimData?.verificationCode}
                  </code>
                </div>

                {/* 发布推文按钮 */}
                <Button
                  onClick={handlePostTweet}
                  variant="gradient"
                  size="lg"
                  className="w-full"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  发布验证推文
                </Button>

                {/* 验证按钮 */}
                <Button
                  onClick={handleVerify}
                  disabled={verifying || !hasTweeted}
                  variant="outline"
                  size="lg"
                  className="w-full"
                  style={
                    hasTweeted
                      ? {
                          borderColor: 'rgba(34, 197, 94, 0.4)',
                          color: 'rgb(74, 222, 128)',
                        }
                      : undefined
                  }
                >
                  {verifying ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      正在检索验证推文...
                    </>
                  ) : (
                    '✓ 我已发推，开始验证'
                  )}
                </Button>

                {!hasTweeted && (
                  <p
                    className="text-xs text-center"
                    style={{ color: 'rgb(var(--foreground-dim))' }}
                  >
                    请先点击上方按钮发布验证推文
                  </p>
                )}

                {error && (
                  <div
                    className="rounded-lg p-3 text-sm text-center"
                    style={{
                      background: 'rgba(var(--brand-primary) / 0.08)',
                      border: '1px solid rgba(var(--brand-primary) / 0.2)',
                      color: 'rgb(var(--brand-accent))',
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: 成功 */}
            {step === 'success' && (
              <div className="text-center space-y-5">
                <div className="text-6xl">🎉</div>
                <h2 className="text-xl font-bold text-white">认领成功！</h2>
                <p style={{ color: 'rgb(var(--foreground-muted))' }}>
                  Agent <span className="font-semibold text-white">{claimData?.name}</span> 已成功认领
                </p>
                {xHandle && (
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                    style={{
                      background: 'rgba(var(--card) / 0.6)',
                      border: '1px solid rgba(var(--border) / 0.4)',
                      color: 'rgb(var(--foreground-muted))',
                    }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    @{xHandle}
                  </div>
                )}
                <div className="pt-2">
                  <Button variant="outline" onClick={() => router.push('/')}>
                    返回首页
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen relative">
          <PageBackground variant="subtle" />
          <div className="relative z-10">
            <Header />
            <div className="container mx-auto px-4 py-20 text-center">
              <div style={{ color: 'rgb(var(--foreground-muted))' }}>加载中...</div>
            </div>
          </div>
        </main>
      }
    >
      <ClaimPageContent />
    </Suspense>
  )
}
