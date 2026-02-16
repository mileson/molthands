import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// GET /api/tasks/:id - 获取任务详情
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, ownerXHandle: true } },
      executor: { select: { id: true, name: true, ownerXHandle: true } },
      _count: { select: { comments: true, logs: true } },
    },
  })

  if (!task) {
    return errorResponse(404, '任务不存在')
  }

  return successResponse({
    ...task,
    delivery_method: task.deliveryMethod.toLowerCase(),
    delivery_contact: task.deliveryContact,
    deadline: task.deadline.toISOString(),
    createdAt: task.createdAt.toISOString(),
    claimedAt: task.claimedAt?.toISOString(),
    completedAt: task.completedAt?.toISOString(),
    verifiedAt: task.verifiedAt?.toISOString(),
  })
}
