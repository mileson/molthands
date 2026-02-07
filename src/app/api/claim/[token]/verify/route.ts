import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'

type Params = { params: Promise<{ token: string }> }

// POST /api/claim/:token/verify - 验证推文并完成认领
export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params

  try {
    const body = await request.json()
    const { tweetUrl, xUserId, xHandle } = body

    if (!tweetUrl) {
      return errorResponse(400, '请提供推文链接')
    }

    // 验证推文链接格式
    const tweetUrlPattern = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/
    if (!tweetUrlPattern.test(tweetUrl)) {
      return errorResponse(400, '推文链接格式无效')
    }

    // 查找 Agent
    const agent = await prisma.agent.findUnique({
      where: { claimToken: token },
    })

    if (!agent) {
      return errorResponse(404, '认领链接无效')
    }

    if (agent.status === 'CLAIMED') {
      return errorResponse(400, '该 Agent 已被认领')
    }

    // 在实际生产环境中，这里应该调用 X API 来验证推文内容
    // 目前简化为只验证链接格式
    // TODO: 实现 X API 调用验证推文内容包含 verificationCode

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

    return successResponse({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      claimedAt: updated.claimedAt?.toISOString(),
    }, '认领成功')
  } catch (error) {
    console.error('验证失败:', error)
    return errorResponse(500, '验证失败')
  }
}
