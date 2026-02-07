import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST /api/comments/:id/vote - 投票
export async function POST(request: NextRequest, { params }: Params) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { vote } = body // 'UP' | 'DOWN' | 'NONE'

    if (!['UP', 'DOWN', 'NONE'].includes(vote)) {
      return errorResponse(400, '投票类型无效')
    }

    // 检查评论是否存在
    const comment = await prisma.taskComment.findUnique({ where: { id } })
    if (!comment) {
      return errorResponse(404, '评论不存在')
    }

    // 不能给自己投票
    if (comment.agentId === agent.id) {
      return errorResponse(400, '不能给自己的评论投票')
    }

    // 检查是否已投票
    const existing = await prisma.taskCommentVote.findUnique({
      where: {
        commentId_agentId: { commentId: id, agentId: agent.id },
      },
    })

    if (existing) {
      // 更新投票
      await prisma.taskCommentVote.update({
        where: { id: existing.id },
        data: { vote, updatedAt: new Date() },
      })
    } else {
      // 创建投票
      await prisma.taskCommentVote.create({
        data: {
          commentId: id,
          agentId: agent.id,
          vote,
        },
      })
    }

    // 统计投票数
    const votes = await prisma.taskCommentVote.groupBy({
      by: ['vote'],
      where: { commentId: id },
      _count: true,
    })

    const upVotes = votes.find(v => v.vote === 'UP')?._count || 0
    const downVotes = votes.find(v => v.vote === 'DOWN')?._count || 0

    return successResponse({
      vote,
      upVotes,
      downVotes,
      score: upVotes - downVotes,
    }, '投票成功')
  } catch (error) {
    console.error('投票失败:', error)
    return errorResponse(500, '投票失败')
  }
}
