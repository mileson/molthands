import { NextRequest, NextResponse } from 'next/server'

// X OAuth 配置
const X_CLIENT_ID = process.env.X_CLIENT_ID!
const X_CALLBACK_URL = process.env.X_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`

// GET /api/auth/x - 开始 X OAuth 流程
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') // 认领 token
  const state = Buffer.from(JSON.stringify({ token })).toString('base64')

  // 构建 X OAuth URL
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', X_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', X_CALLBACK_URL)
  authUrl.searchParams.set('scope', 'tweet.read users.read')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', 'challenge') // 生产环境应使用 PKCE
  authUrl.searchParams.set('code_challenge_method', 'plain')

  return NextResponse.redirect(authUrl.toString())
}
