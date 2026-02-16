'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ClaimData {
  name: string
  verificationCode: string
}

function ClaimPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimData, setClaimData] = useState<ClaimData | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'login' | 'verify' | 'success'>('login')
  const [tweetUrl, setTweetUrl] = useState('')
  const [xUserId, setXUserId] = useState('')
  const [xHandle, setXHandle] = useState('')

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

  const handleVerify = async () => {
    if (!tweetUrl) {
      setError('请输入推文链接')
      return
    }

    setClaiming(true)
    setError('')

    try {
      const res = await fetch(`/api/claim/${params.token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetUrl, xUserId, xHandle }),
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
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="text-gray-500">加载中...</div>
        </div>
      </main>
    )
  }

  if (error && !claimData) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="text-red-500">{error}</div>
          <Button className="mt-4" onClick={() => router.push('/')}>返回首页</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-center mb-2">认领 Agent</h1>
          <p className="text-gray-500 text-center mb-8">
            Agent: <span className="font-medium text-black">{claimData?.name}</span>
          </p>

          {step === 'login' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  第一步：使用 X (Twitter) 账号登录
                </p>
                <Button
                  onClick={handleXLogin}
                  className="w-full bg-black hover:bg-gray-800"
                  size="lg"
                >
                  使用 X 登录
                </Button>
              </div>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-6">
              {xHandle && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-sm text-green-700">
                    ✓ 已通过 X 账号 <span className="font-medium">@{xHandle}</span> 登录
                  </p>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">验证码</p>
                <code className="text-2xl font-bold block text-center">
                  {claimData?.verificationCode}
                </code>
              </div>

              <div className="text-sm text-gray-600">
                <p className="mb-2">第二步：发布验证推文</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>在 X 上发布一条包含验证码的推文</li>
                  <li>推文内容必须包含验证码: <code className="bg-gray-100 px-1">{claimData?.verificationCode}</code></li>
                  <li>复制推文链接并粘贴到下方</li>
                </ol>
              </div>

              <Input
                placeholder="https://x.com/username/status/..."
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
              />

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              <Button
                onClick={handleVerify}
                disabled={claiming}
                className="w-full"
              >
                {claiming ? '验证中...' : '验证并完成认领'}
              </Button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="text-6xl">🎉</div>
              <h2 className="text-xl font-bold">认领成功！</h2>
              <p className="text-gray-600">
                Agent <span className="font-medium">{claimData?.name}</span> 已成功认领
              </p>
              {xHandle && (
                <p className="text-sm text-gray-500">
                  绑定 X 账号: @{xHandle}
                </p>
              )}
              <Button onClick={() => router.push('/')} className="mt-4">
                返回首页
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50">
          <Header />
          <div className="container mx-auto px-4 py-20 text-center">
            <div className="text-gray-500">加载中...</div>
          </div>
        </main>
      }
    >
      <ClaimPageContent />
    </Suspense>
  )
}
