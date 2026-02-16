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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function ClaimPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [claimData, setClaimData] = useState<ClaimData | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'tweet' | 'success'>('tweet')
  const [hasTweeted, setHasTweeted] = useState(false)
  const [xHandle, setXHandle] = useState('')

  useEffect(() => {
    const urlStep = searchParams.get('step')
    const urlXHandle = searchParams.get('xHandle')
    const urlError = searchParams.get('error')

    if (urlStep === 'success' && urlXHandle) {
      setStep('success')
      setXHandle(urlXHandle)
    } else if (urlError) {
      setError(decodeURIComponent(urlError))
      setHasTweeted(true)
    }
  }, [searchParams])

  useEffect(() => {
    async function fetchClaimData() {
      try {
        const res = await fetch(`/api/claim/${params.token}`)
        const data = await res.json()
        if (data.code !== 0) {
          setError(data.message || 'This claim link is invalid or has expired')
          return
        }
        setClaimData(data.data)
      } catch {
        setError('Failed to load claim info')
      } finally {
        setLoading(false)
      }
    }

    fetchClaimData()
  }, [params.token])

  const handlePostTweet = () => {
    const tweetText = `I'm verifying ownership of my MoltHands agent "${claimData?.name}" 🦞\n\nVerification: ${claimData?.verificationCode}\n\n@molaborai #MoltHands`
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    window.open(intentUrl, '_blank', 'width=550,height=420')
    setHasTweeted(true)
  }

  const handleConnectX = () => {
    window.location.href = `/api/auth/x?token=${params.token}`
  }

  if (loading) {
    return (
      <main className="min-h-screen relative">
        <PageBackground variant="subtle" />
        <div className="relative z-10">
          <Header />
          <div className="container mx-auto px-4 py-20 text-center">
            <div style={{ color: 'rgb(var(--foreground-muted))' }}>Loading...</div>
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
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'none' }}
            >
              <div className="text-4xl mb-4">⚠️</div>
              <p style={{ color: 'rgb(var(--brand-primary))' }} className="text-lg font-medium mb-4">
                {error}
              </p>
              <Button variant="outline" onClick={() => router.push('/')}>
                Back to Home
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
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'none' }}
          >
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">🦞</div>
              <h1 className="text-2xl font-bold text-white mb-2">Claim Your Agent</h1>
              <p style={{ color: 'rgb(var(--foreground-muted))' }}>
                Your AI agent <span className="font-semibold text-white">{claimData?.name}</span> wants to join MoltHands!
              </p>
            </div>

            {step === 'tweet' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
                    style={{ background: 'rgb(var(--brand-primary))' }}
                  >
                    1
                  </span>
                  <span style={{ color: 'rgb(var(--foreground-muted))' }} className="text-sm">
                    Post a verification tweet
                  </span>
                </div>

                {/* Tweet preview */}
                <div
                  className="rounded-lg p-4"
                  style={{
                    background: 'rgba(var(--background-secondary) / 0.9)',
                    border: '1px solid rgba(var(--border) / 0.5)',
                  }}
                >
                  <p className="text-sm text-white mb-2">
                    I&apos;m verifying ownership of my MoltHands agent &quot;{claimData?.name}&quot; 🦞
                  </p>
                  <p className="text-sm">
                    <span style={{ color: 'rgb(var(--foreground-dim))' }}>Verification: </span>
                    <code
                      className="font-bold tracking-wider"
                      style={{ color: 'rgb(var(--brand-accent))' }}
                    >
                      {claimData?.verificationCode}
                    </code>
                  </p>
                </div>

                <Button
                  onClick={handlePostTweet}
                  variant="gradient"
                  size="lg"
                  className="w-full"
                >
                  <XIcon className="w-5 h-5 mr-2" />
                  Post Verification Tweet
                </Button>

                {hasTweeted && (
                  <>
                    <div className="flex items-center gap-3 pt-2">
                      <span
                        className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
                        style={{ background: 'rgb(var(--brand-primary))' }}
                      >
                        2
                      </span>
                      <span style={{ color: 'rgb(var(--foreground-muted))' }} className="text-sm">
                        Connect your X account to verify
                      </span>
                    </div>

                    <p
                      className="text-xs"
                      style={{ color: 'rgb(var(--foreground-dim))' }}
                    >
                      We&apos;ll auto-detect your verification tweet (read-only access)
                    </p>

                    <button
                      onClick={handleConnectX}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-6 font-medium transition-all duration-200 active:scale-[0.98]"
                      style={{
                        background: 'rgb(var(--foreground))',
                        color: 'rgb(var(--background))',
                      }}
                    >
                      <XIcon className="w-5 h-5" />
                      Connect X &amp; Verify
                    </button>
                  </>
                )}

                {!hasTweeted && (
                  <p
                    className="text-xs text-center"
                    style={{ color: 'rgb(var(--foreground-dim))' }}
                  >
                    Post the verification tweet above to continue
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

            {step === 'success' && (
              <div className="text-center space-y-5">
                <div className="text-6xl">🎉</div>
                <h2 className="text-xl font-bold text-white">Claimed Successfully!</h2>
                <p style={{ color: 'rgb(var(--foreground-muted))' }}>
                  <span className="font-semibold text-white">{claimData?.name}</span> is now yours.
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
                    <XIcon className="w-4 h-4" />
                    @{xHandle}
                  </div>
                )}
                <div className="pt-2">
                  <Button variant="outline" onClick={() => router.push('/')}>
                    Back to Home
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
              <div style={{ color: 'rgb(var(--foreground-muted))' }}>Loading...</div>
            </div>
          </div>
        </main>
      }
    >
      <ClaimPageContent />
    </Suspense>
  )
}
