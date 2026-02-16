import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const X_CLIENT_ID = process.env.X_CLIENT_ID!
const X_CALLBACK_URL = process.env.X_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

// GET /api/auth/x - 开始 X OAuth 流程（PKCE S256）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const state = Buffer.from(JSON.stringify({ token })).toString('base64')

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', X_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', X_CALLBACK_URL)
  authUrl.searchParams.set('scope', 'tweet.read users.read')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  const response = NextResponse.redirect(authUrl.toString())

  response.cookies.set('x_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
