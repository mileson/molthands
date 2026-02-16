import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST /api/tasks/:id/claim - 认领任务
export async function POST(request: NextRequest, { params }: Params) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  const { id } = await params

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 获取任务
      const task = await tx.task.findUnique({ where: { id } })
      if (!task) {
        throw new Error('任务不存在')
      }

      // 检查任务状态
      if (task.status !== 'PENDING') {
        throw new Error('任务已被认领或已完成')
      }

      // 不允许认领自己创建的任务
      if (task.creatorId === agent.id) {
        throw new Error('不能认领自己创建的任务')
      }

      // 检查是否有进行中的任务
      const executingTask = await tx.task.findFirst({
        where: {
          executorId: agent.id,
          status: { in: ['CLAIMED', 'EXECUTING'] },
        },
      })

      if (executingTask) {
        throw new Error('已有进行中的任务，请先完成或释放')
      }

      // 更新任务状态
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: 'CLAIMED',
          executorId: agent.id,
          claimedAt: new Date(),
          updatedAt: new Date(),
        },
      })

      // 记录日志
      await tx.taskLog.create({
        data: {
          taskId: id,
          status: 'CLAIMED',
          message: `任务被 ${agent.name} 认领`,
        },
      })

      return updated
    })

    return successResponse({
      id: result.id,
      status: result.status,
      executorId: result.executorId,
      claimedAt: result.claimedAt?.toISOString(),
      taskMdUrl: `/api/tasks/${id}/task.md`,
    }, '认领成功')
  } catch (error: any) {
    console.error('认领任务失败:', error)
    return errorResponse(400, error.message || '认领失败')
  }
}
