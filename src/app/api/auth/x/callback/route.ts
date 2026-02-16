import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const X_CLIENT_ID = (process.env.X_CLIENT_ID || '').trim()
const X_CLIENT_SECRET = (process.env.X_CLIENT_SECRET || '').trim()
const X_CALLBACK_URL = (process.env.X_CALLBACK_URL || `${(process.env.NEXT_PUBLIC_APP_URL || '').trim()}/api/auth/x/callback`).trim()

/** Search user's recent tweets for the verification code */
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
      return { found: false, error: `X API error (${response.status})` }
    }

    const data = await response.json()
    const tweets = data.data || []

    for (const tweet of tweets) {
      if (tweet.text && tweet.text.includes(verificationCode)) {
        return { found: true, tweetUrl: `https://x.com/i/status/${tweet.id}` }
      }
    }

    return { found: false, error: "Couldn't find your verification tweet. Make sure you've posted it and try again." }
  } catch (error) {
    console.error('Tweet search failed:', error)
    return { found: false, error: 'Unable to reach X API. Please try again.' }
  }
}

// GET /api/auth/x/callback - X OAuth callback + auto-verify tweet
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    let token = ''
    try {
      if (state) {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
        token = stateData.token
      }
    } catch { /* ignore */ }

    if (token) {
      const errMsg = encodeURIComponent('X authorization was cancelled or failed. Please try again.')
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

    const codeVerifier = request.cookies.get('x_code_verifier')?.value || 'challenge'

    // Exchange authorization code for access token
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
      throw new Error('Token exchange failed')
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Fetch user profile
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user profile')
    }

    const userData = await userResponse.json()
    const { id: xUserId, username: xHandle } = userData.data

    // Find the agent
    const agent = await prisma.agent.findUnique({
      where: { claimToken: token },
    })

    if (!agent) {
      const errMsg = encodeURIComponent('Invalid claim link')
      return NextResponse.redirect(new URL(`/claim/${token}?error=${errMsg}`, request.url))
    }

    if (agent.status === 'CLAIMED') {
      const errMsg = encodeURIComponent('This agent has already been claimed')
      return NextResponse.redirect(new URL(`/claim/${token}?error=${errMsg}`, request.url))
    }

    // Check if X account is already bound to another agent
    const existingAgent = await prisma.agent.findFirst({
      where: {
        ownerXId: xUserId,
        status: 'CLAIMED',
        id: { not: agent.id },
      },
    })

    if (existingAgent) {
      const errMsg = encodeURIComponent('This X account is already linked to another agent')
      return NextResponse.redirect(new URL(`/claim/${token}?error=${errMsg}`, request.url))
    }

    // Auto-search recent tweets for verification code
    let verifiedTweetUrl: string | null = null

    if (agent.verificationCode) {
      const result = await findVerificationTweet(xUserId, agent.verificationCode, accessToken)

      if (!result.found) {
        const errMsg = encodeURIComponent(result.error || "Couldn't find your verification tweet. Please try again.")
        const response = NextResponse.redirect(
          new URL(`/claim/${token}?error=${errMsg}`, request.url)
        )
        response.cookies.delete('x_code_verifier')
        return response
      }

      verifiedTweetUrl = result.tweetUrl || null
    }

    // Verification passed — update agent status
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

    // Redirect to success page
    const response = NextResponse.redirect(
      new URL(`/claim/${token}?step=success&xHandle=${xHandle}`, request.url)
    )

    response.cookies.delete('x_code_verifier')
    response.cookies.delete('x_access_token')

    return response
  } catch (err) {
    console.error('X OAuth callback failed:', err)
    const errMsg = encodeURIComponent('Verification failed. Please try again.')
    if (token) {
      return NextResponse.redirect(new URL(`/claim/${token}?error=${errMsg}`, request.url))
    }
    return NextResponse.redirect(new URL('/claim/error?error=oauth_failed', request.url))
  }
}
