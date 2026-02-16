import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const X_CLIENT_ID = (process.env.X_CLIENT_ID || '').trim()
const X_CLIENT_SECRET = (process.env.X_CLIENT_SECRET || '').trim()
const X_CALLBACK_URL = (process.env.X_CALLBACK_URL || `${(process.env.NEXT_PUBLIC_APP_URL || '').trim()}/api/auth/x/callback`).trim()

/** 通过 X API 检索用户近期推文，查找包含验证码的推文 */
async function findVerificationTweet(
  xUserId: string,
  verificationCode: string,
  accessToken: string
): Promise<{ found: boolean; tweetUrl?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.twitter.com/2/users/${xUserId}/tweets?max_results=10&tweet.fields=text`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('X API search error:', response.status, errorData)
      return { found: false, error: `X API 错误 (${response.status})` }
    }

    const data = await response.json()
    const tweets = data.data || []

    for (const tweet of tweets) {
      if (tweet.text && tweet.text.includes(verificationCode)) {
        return { found: true, tweetUrl: `https://x.com/i/status/${tweet.id}` }
      }
    }

    return { found: false, error: '未找到包含验证码的推文，请确认已发布后重试' }
  } catch (error) {
    console.error('Tweet search failed:', error)
    return { found: false, error: '无法连接 X API' }
  }
}

// GET /api/auth/x/callback - X OAuth 回调 + 自动验证推文
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    // 解析 state 尝试获取 token 以重定向回认领页
    let token = ''
    try {
      if (state) {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
        token = stateData.token
      }
    } catch { /* ignore */ }

    if (token) {
      const errMsg = encodeURIComponent('X 授权被取消或失败，请重试')
      return NextResponse.redirect(new URL(`/claim/${token}?error=${errMsg}`, request.url))
    }
    return NextResponse.redirect(new URL('/claim/error?error=oauth_cancelled', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/claim/error?error=invalid_request', request.url))
  }

  let token = ''

  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    token = stateData.token

    // 从 cookie 读取 PKCE code_verifier
    const codeVerifier = request.cookies.get('x_code_verifier')?.value || 'challenge'

    // 用授权码换取访问令牌
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: X_CALLBACK_URL,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text().catch(() => '')
      console.error('X token exchange failed:', tokenResponse.status, errorBody)
      throw new Error('获取令牌失败')
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // 获取用户信息
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!userResponse.ok) {
      throw new Error('获取用户信息失败')
    }

    const userData = await userResponse.json()
    const { id: xUserId, username: xHandle } = userData.data

    // 查找 Agent
    const agent = await prisma.agent.findUnique({
      where: { claimToken: token },
    })

    if (!agent) {
      const errMsg = encodeURIComponent('认领链接无效')
      return NextResponse.redirect(new URL(`/claim/${token}?error=${errMsg}`, request.url))
    }

    if (agent.status === 'CLAIMED') {
      const errMsg = encodeURIComponent('该 Agent 已被认领')
      return NextResponse.redirect(new URL(`/claim/${token}?error=${errMsg}`, request.url))
    }

    // 检查 X 账号是否已被其他 Agent 使用（一号一绑）
    const existingAgent = await prisma.agent.findFirst({
      where: {
        ownerXId: xUserId,
        status: 'CLAIMED',
        id: { not: agent.id },
      },
    })

    if (existingAgent) {
      const errMsg = encodeURIComponent('该 X 账号已绑定其他 Agent')
      return NextResponse.redirect(new URL(`/claim/${token}?error=${errMsg}`, request.url))
    }

    // 自动检索近期推文验证
    let verifiedTweetUrl: string | null = null

    if (agent.verificationCode) {
      const result = await findVerificationTweet(xUserId, agent.verificationCode, accessToken)

      if (!result.found) {
        // 推文未找到 — 重定向回认领页，显示错误
        const errMsg = encodeURIComponent(result.error || '未找到验证推文，请确认已发布后重试')
        const response = NextResponse.redirect(
          new URL(`/claim/${token}?error=${errMsg}`, request.url)
        )
        // 清除 cookie
        response.cookies.delete('x_code_verifier')
        return response
      }

      verifiedTweetUrl = result.tweetUrl || null
    }

    // 验证通过 — 更新 Agent 认领状态
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        status: 'CLAIMED',
        ownerXId: xUserId,
        ownerXHandle: xHandle,
        verificationTweetUrl: verifiedTweetUrl,
        claimedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // 认领成功 — 重定向到成功页面
    const response = NextResponse.redirect(
      new URL(`/claim/${token}?step=success&xHandle=${xHandle}`, request.url)
    )

    // 清除 cookies
    response.cookies.delete('x_code_verifier')
    response.cookies.delete('x_access_token')

    return response
  } catch (err) {
    console.error('X OAuth 回调失败:', err)
    const errMsg = encodeURIComponent('OAuth 验证失败，请重试')
    if (token) {
      return NextResponse.redirect(new URL(`/claim/${token}?error=${errMsg}`, request.url))
    }
    return NextResponse.redirect(new URL('/claim/error?error=oauth_failed', request.url))
  }
}
