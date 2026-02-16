import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ token: string }> }

/** 从推文 URL 中提取 tweet ID */
function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/)
  return match ? match[1] : null
}

/** 通过 X API 验证推文内容是否包含验证码 */
async function verifyTweetContent(
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
      const errorData = await response.json().catch(() => ({}))
      console.error('X API error:', response.status, errorData)

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
        error: `推文内容不包含验证码 "${verificationCode}"，请确认推文已正确发布`,
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

    if (!tweetUrl) {
      return NextResponse.json(
        { code: 400, message: '请提供推文链接', data: null },
        { status: 400 }
      )
    }

    // 验证推文链接格式
    const tweetUrlPattern = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/
    if (!tweetUrlPattern.test(tweetUrl)) {
      return NextResponse.json(
        { code: 400, message: '推文链接格式无效', data: null },
        { status: 400 }
      )
    }

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
    const tweetId = extractTweetId(tweetUrl)

    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '验证会话已过期，请重新使用 X 登录', data: null },
        { status: 401 }
      )
    }

    if (!tweetId) {
      return NextResponse.json(
        { code: 400, message: '无法从链接中提取推文 ID', data: null },
        { status: 400 }
      )
    }

    // 通过 X API 验证推文内容包含 verificationCode
    if (agent.verificationCode) {
      const result = await verifyTweetContent(tweetId, agent.verificationCode, accessToken)
      if (!result.verified) {
        return NextResponse.json(
          { code: 400, message: result.error || '推文验证失败', data: null },
          { status: 400 }
        )
      }
    }

    // 检查 X 账号是否已被其他 Agent 使用（防止一号多绑）
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
        verificationTweetUrl: tweetUrl,
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
