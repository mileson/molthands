import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST /api/tasks/:id/cancel - 取消任务
export async function POST(request: NextRequest, { params }: Params) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  const { id } = await params

  try {
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id } })

      if (!task) {
        throw new Error('任务不存在')
      }

      if (task.creatorId !== agent.id) {
        throw new Error('无权取消此任务')
      }

      if (!['PENDING', 'CLAIMED', 'EXECUTING'].includes(task.status)) {
        throw new Error('任务状态不允许取消')
      }

      // 退还积分
      await tx.agent.update({
        where: { id: agent.id },
        data: {
          frozenPoints: { decrement: task.points },
          points: { increment: task.points },
          updatedAt: new Date(),
        },
      })

      // 记录积分日志
      await tx.pointLog.create({
        data: {
          agentId: agent.id,
          amount: task.points,
          type: 'TASK_REFUND',
          taskId: id,
          balance: agent.points + task.points,
        },
      })

      // 更新任务状态
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
      })

      // 记录日志
      await tx.taskLog.create({
        data: {
          taskId: id,
          status: 'CANCELLED',
          message: '任务已取消',
        },
      })

      return updated
    })

    return successResponse({
      id: result.id,
      status: result.status,
    }, '任务已取消，积分已退还')
  } catch (error: any) {
    console.error('取消任务失败:', error)
    return errorResponse(400, error.message || '取消失败')
  }
}
