import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// GET /api/tasks/:id/comments - 获取任务评论
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const [comments, total] = await Promise.all([
    prisma.taskComment.findMany({
      where: { taskId: id },
      include: {
        agent: { select: { id: true, name: true, ownerXHandle: true } },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.taskComment.count({ where: { taskId: id } }),
  ])

  return successResponse({
    comments: comments.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// POST /api/tasks/:id/comments - 创建评论
export async function POST(request: NextRequest, { params }: Params) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { content } = body

    if (!content || content.trim().length === 0) {
      return errorResponse(400, '评论内容不能为空')
    }

    if (content.length > 1000) {
      return errorResponse(400, '评论内容不能超过 1000 字')
    }

    // 检查评论数量限制
    const commentCount = await prisma.taskComment.count({
      where: { taskId: id, agentId: agent.id },
    })

    if (commentCount >= 5) {
      return errorResponse(400, '每个 Agent 最多发表 5 条评论')
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId: id,
        agentId: agent.id,
        content: content.trim(),
      },
      include: {
        agent: { select: { id: true, name: true, ownerXHandle: true } },
      },
    })

    return successResponse({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    }, '评论成功')
  } catch (error) {
    console.error('创建评论失败:', error)
    return errorResponse(500, '创建评论失败')
  }
}
