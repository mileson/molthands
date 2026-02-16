import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ token: string }> }

/** Extract tweet ID from a tweet URL */
function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/)
  return match ? match[1] : null
}

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

      if (response.status === 401) {
        return { found: false, error: 'X authorization expired. Please reconnect your X account.' }
      }
      if (response.status === 429) {
        return { found: false, error: 'X API rate limit reached. Please wait a moment and try again.' }
      }
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
    return { found: false, error: 'Unable to reach X API. Please try again later.' }
  }
}

/** Verify a specific tweet contains the verification code */
async function verifySpecificTweet(
  tweetId: string,
  verificationCode: string,
  accessToken: string
): Promise<{ verified: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        return { verified: false, error: 'X authorization expired. Please reconnect your X account.' }
      }
      if (response.status === 404) {
        return { verified: false, error: 'Tweet not found. Please check the URL and try again.' }
      }
      return { verified: false, error: `X API error (${response.status})` }
    }

    const data = await response.json()
    const tweetText = data.data?.text || ''

    if (!tweetText.includes(verificationCode)) {
      return {
        verified: false,
        error: `Tweet doesn't contain the verification code "${verificationCode}"`,
      }
    }

    return { verified: true }
  } catch (error) {
    console.error('Tweet verification failed:', error)
    return { verified: false, error: 'Unable to reach X API. Please try again later.' }
  }
}

// POST /api/claim/:token/verify - Verify tweet and complete claim
export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params

  try {
    const body = await request.json()
    const { tweetUrl, xUserId, xHandle } = body

    const agent = await prisma.agent.findUnique({
      where: { claimToken: token },
    })

    if (!agent) {
      return NextResponse.json(
        { code: 404, message: 'Invalid claim link', data: null },
        { status: 404 }
      )
    }

    if (agent.status === 'CLAIMED') {
      return NextResponse.json(
        { code: 400, message: 'This agent has already been claimed', data: null },
        { status: 400 }
      )
    }

    const accessToken = request.cookies.get('x_access_token')?.value

    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: 'Session expired. Please reconnect your X account.', data: null },
        { status: 401 }
      )
    }

    if (!agent.verificationCode) {
      return NextResponse.json(
        { code: 400, message: 'Agent is missing a verification code', data: null },
        { status: 400 }
      )
    }

    let verifiedTweetUrl: string | null = null

    if (tweetUrl) {
      const tweetUrlPattern = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/
      if (!tweetUrlPattern.test(tweetUrl)) {
        return NextResponse.json(
          { code: 400, message: 'Invalid tweet URL format', data: null },
          { status: 400 }
        )
      }

      const tweetId = extractTweetId(tweetUrl)
      if (!tweetId) {
        return NextResponse.json(
          { code: 400, message: "Couldn't extract tweet ID from URL", data: null },
          { status: 400 }
        )
      }

      const result = await verifySpecificTweet(tweetId, agent.verificationCode, accessToken)
      if (!result.verified) {
        return NextResponse.json(
          { code: 400, message: result.error || 'Tweet verification failed', data: null },
          { status: 400 }
        )
      }

      verifiedTweetUrl = tweetUrl
    } else if (xUserId) {
      const result = await findVerificationTweet(xUserId, agent.verificationCode, accessToken)
      if (!result.found) {
        return NextResponse.json(
          { code: 400, message: result.error || 'Verification tweet not found', data: null },
          { status: 400 }
        )
      }

      verifiedTweetUrl = result.tweetUrl || null
    } else {
      return NextResponse.json(
        { code: 400, message: 'Please provide a tweet URL or X user ID', data: null },
        { status: 400 }
      )
    }

    if (xUserId) {
      const existingAgent = await prisma.agent.findFirst({
        where: {
          ownerXId: xUserId,
          status: 'CLAIMED',
          id: { not: agent.id },
        },
      })

      if (existingAgent) {
        return NextResponse.json(
          { code: 400, message: 'This X account is already linked to another agent', data: null },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        status: 'CLAIMED',
        ownerXId: xUserId || null,
        ownerXHandle: xHandle || null,
        verificationTweetUrl: verifiedTweetUrl,
        claimedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    const response = NextResponse.json({
      code: 0,
      message: 'Claimed successfully',
      data: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        ownerXHandle: updated.ownerXHandle,
        claimedAt: updated.claimedAt?.toISOString(),
      },
    })

    response.cookies.delete('x_access_token')

    return response
  } catch (error) {
    console.error('Verification failed:', error)
    return NextResponse.json(
      { code: 500, message: 'Verification failed', data: null },
      { status: 500 }
    )
  }
}
