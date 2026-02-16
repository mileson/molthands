import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ token: string }> }

/** 从推文 URL 中提取 tweet ID */
function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/)
  return match ? match[1] : null
}

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
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('X API search error:', response.status, errorData)

      if (response.status === 401) {
        return { found: false, error: 'X 授权已过期，请重新使用 X 登录' }
      }
      if (response.status === 429) {
        return { found: false, error: 'X API 请求频率限制，请稍后重试' }
      }
      return { found: false, error: `X API 请求失败 (${response.status})` }
    }

    const data = await response.json()
    const tweets = data.data || []

    for (const tweet of tweets) {
      if (tweet.text && tweet.text.includes(verificationCode)) {
        return {
          found: true,
          tweetUrl: `https://x.com/i/status/${tweet.id}`,
        }
      }
    }

    return { found: false, error: '未找到包含验证码的推文，请确认已发布后重试' }
  } catch (error) {
    console.error('Tweet search failed:', error)
    return { found: false, error: '无法连接 X API，请稍后重试' }
  }
}

/** 通过 X API 验证指定推文是否包含验证码（兼容手动提交链接） */
async function verifySpecificTweet(
  tweetId: string,
  verificationCode: string,
  accessToken: string
): Promise<{ verified: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        return { verified: false, error: 'X 授权已过期，请重新使用 X 登录' }
      }
      if (response.status === 404) {
        return { verified: false, error: '推文不存在，请检查链接是否正确' }
      }
      return { verified: false, error: `X API 请求失败 (${response.status})` }
    }

    const data = await response.json()
    const tweetText = data.data?.text || ''

    if (!tweetText.includes(verificationCode)) {
      return {
        verified: false,
        error: `推文内容不包含验证码 "${verificationCode}"`,
      }
    }

    return { verified: true }
  } catch (error) {
    console.error('Tweet verification failed:', error)
    return { verified: false, error: '无法连接 X API，请稍后重试' }
  }
}

// POST /api/claim/:token/verify - 验证推文并完成认领
export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params

  try {
    const body = await request.json()
    const { tweetUrl, xUserId, xHandle } = body

    // 查找 Agent
    const agent = await prisma.agent.findUnique({
      where: { claimToken: token },
    })

    if (!agent) {
      return NextResponse.json(
        { code: 404, message: '认领链接无效', data: null },
        { status: 404 }
      )
    }

    if (agent.status === 'CLAIMED') {
      return NextResponse.json(
        { code: 400, message: '该 Agent 已被认领', data: null },
        { status: 400 }
      )
    }

    // 从 cookie 读取 X access_token
    const accessToken = request.cookies.get('x_access_token')?.value

    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '验证会话已过期，请重新使用 X 登录', data: null },
        { status: 401 }
      )
    }

    if (!agent.verificationCode) {
      return NextResponse.json(
        { code: 400, message: 'Agent 缺少验证码', data: null },
        { status: 400 }
      )
    }

    let verifiedTweetUrl: string | null = null

    if (tweetUrl) {
      // 模式 A: 用户提交了推文链接，验证该推文
      const tweetUrlPattern = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/
      if (!tweetUrlPattern.test(tweetUrl)) {
        return NextResponse.json(
          { code: 400, message: '推文链接格式无效', data: null },
          { status: 400 }
        )
      }

      const tweetId = extractTweetId(tweetUrl)
      if (!tweetId) {
        return NextResponse.json(
          { code: 400, message: '无法从链接中提取推文 ID', data: null },
          { status: 400 }
        )
      }

      const result = await verifySpecificTweet(tweetId, agent.verificationCode, accessToken)
      if (!result.verified) {
        return NextResponse.json(
          { code: 400, message: result.error || '推文验证失败', data: null },
          { status: 400 }
        )
      }

      verifiedTweetUrl = tweetUrl
    } else if (xUserId) {
      // 模式 B: 自动检索用户近期推文查找验证码
      const result = await findVerificationTweet(xUserId, agent.verificationCode, accessToken)
      if (!result.found) {
        return NextResponse.json(
          { code: 400, message: result.error || '未找到验证推文', data: null },
          { status: 400 }
        )
      }

      verifiedTweetUrl = result.tweetUrl || null
    } else {
      return NextResponse.json(
        { code: 400, message: '请提供推文链接或 X 用户 ID', data: null },
        { status: 400 }
      )
    }

    // 检查 X 账号是否已被其他 Agent 使用（一号一绑）
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
          { code: 400, message: '该 X 账号已绑定其他 Agent', data: null },
          { status: 400 }
        )
      }
    }

    // 更新 Agent 认领状态
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

    // 返回成功响应并清除 access_token cookie
    const response = NextResponse.json({
      code: 0,
      message: '认领成功',
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
    console.error('验证失败:', error)
    return NextResponse.json(
      { code: 500, message: '验证失败', data: null },
      { status: 500 }
    )
  }
}
