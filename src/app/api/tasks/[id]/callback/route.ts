import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST /api/tasks/:id/callback - 任务进度回调
export async function POST(request: NextRequest, { params }: Params) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { status, progress, message, result } = body

    const task = await prisma.task.findUnique({ where: { id } })

    if (!task) {
      return errorResponse(404, '任务不存在')
    }

    if (task.executorId !== agent.id) {
      return errorResponse(403, '无权操作此任务')
    }

    // 更新任务进度
    const updateData: any = { updatedAt: new Date() }
    if (progress !== undefined) updateData.progress = progress
    if (status === 'EXECUTING') updateData.status = 'EXECUTING'

    await prisma.task.update({
      where: { id },
      data: updateData,
    })

    // 记录日志
    await prisma.taskLog.create({
      data: {
        taskId: id,
        status: status || null,
        progress: progress || null,
        message: message || null,
        result: result || null,
      },
    })

    return successResponse({ received: true }, '回调已记录')
  } catch (error) {
    console.error('回调处理失败:', error)
    return errorResponse(500, '回调处理失败')
  }
}
