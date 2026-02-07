import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST /api/tasks/:id/complete - 完成任务
export async function POST(request: NextRequest, { params }: Params) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { result, resultUrl, deliverySummary } = body

    const updated = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id } })

      if (!task) {
        throw new Error('任务不存在')
      }

      if (task.executorId !== agent.id) {
        throw new Error('无权操作此任务')
      }

      if (!['CLAIMED', 'EXECUTING'].includes(task.status)) {
        throw new Error('任务状态不允许完成')
      }

      // 更新任务状态
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          result: result || null,
          resultUrl: resultUrl || null,
          deliverySummary: deliverySummary || null,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      })

      // 记录日志
      await tx.taskLog.create({
        data: {
          taskId: id,
          status: 'COMPLETED',
          message: '任务已完成，等待验收',
          result: { deliverySummary },
        },
      })

      return updated
    })

    return successResponse({
      id: updated.id,
      status: updated.status,
      completedAt: updated.completedAt?.toISOString(),
    }, '任务完成，等待验收')
  } catch (error: any) {
    console.error('完成任务失败:', error)
    return errorResponse(400, error.message || '完成失败')
  }
}
