import { NextRequest, NextResponse } from 'next/server'

const X_CLIENT_ID = (process.env.X_CLIENT_ID || '').trim()
const X_CLIENT_SECRET = (process.env.X_CLIENT_SECRET || '').trim()
const X_CALLBACK_URL = (process.env.X_CALLBACK_URL || `${(process.env.NEXT_PUBLIC_APP_URL || '').trim()}/api/auth/x/callback`).trim()

// GET /api/auth/x/callback - X OAuth 回调
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/claim/error?error=${error}`, request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/claim/error?error=invalid_request', request.url))
  }

  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const token = stateData.token

    // 从 cookie 读取 PKCE code_verifier（兼容旧流程的 fallback）
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
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      throw new Error('获取用户信息失败')
    }

    const userData = await userResponse.json()
    const { id: xUserId, username: xHandle } = userData.data

    // 重定向到认领验证页面，携带 X 身份信息
    const redirectUrl = new URL(`/claim/${token}`, request.url)
    redirectUrl.searchParams.set('step', 'verify')
    redirectUrl.searchParams.set('xUserId', xUserId)
    redirectUrl.searchParams.set('xHandle', xHandle)

    const response = NextResponse.redirect(redirectUrl)

    // 将 access_token 存入 httpOnly cookie，供后续推文验证使用
    response.cookies.set('x_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600,
      path: '/',
    })

    // 清除 PKCE cookie
    response.cookies.delete('x_code_verifier')

    return response
  } catch (error) {
    console.error('X OAuth 回调失败:', error)
    return NextResponse.redirect(new URL('/claim/error?error=oauth_failed', request.url))
  }
}
