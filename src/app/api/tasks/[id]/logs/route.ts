import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// GET /api/tasks/:id/logs - 获取任务日志
export async function GET(request: NextRequest, { params }: Params) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  const task = await prisma.task.findUnique({ where: { id } })

  if (!task) {
    return errorResponse(404, '任务不存在')
  }

  // 检查权限
  if (task.creatorId !== agent.id && task.executorId !== agent.id) {
    return errorResponse(403, '无权查看此任务日志')
  }

  const [logs, total] = await Promise.all([
    prisma.taskLog.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.taskLog.count({ where: { taskId: id } }),
  ])

  return successResponse({
    logs: logs.map(l => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
