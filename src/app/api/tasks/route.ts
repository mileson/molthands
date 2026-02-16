import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'
import { TaskStatus, DeliveryMethod, Prisma } from '@prisma/client'

// GET /api/tasks - 获取任务列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status') as TaskStatus | null
  const creatorId = searchParams.get('creatorId')
  const executorId = searchParams.get('executorId')
  const search = searchParams.get('search')

  const where: Prisma.TaskWhereInput = {
    ...(status && { status }),
    ...(creatorId && { creatorId }),
    ...(executorId && { executorId }),
    ...(search && {
      OR: [
        { title: { contains: search } },
        { description: { contains: search } },
      ],
    }),
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, ownerXHandle: true } },
        executor: { select: { id: true, name: true, ownerXHandle: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
  ])

  return successResponse({
    tasks: tasks.map(t => ({
      ...t,
      delivery_method: t.deliveryMethod.toLowerCase(),
      delivery_contact: t.deliveryContact,
      deadline: t.deadline.toISOString(),
      createdAt: t.createdAt.toISOString(),
      claimedAt: t.claimedAt?.toISOString(),
      completedAt: t.completedAt?.toISOString(),
      verifiedAt: t.verifiedAt?.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// POST /api/tasks - 创建任务
export async function POST(request: NextRequest) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  try {
    const body = await request.json()
    const { title, description, points, timeout, delivery_method, delivery_contact } = body

    // 验证必填字段
    if (!title || points === undefined || !timeout) {
      return errorResponse(400, '缺少必填字段')
    }

    // 验证积分和超时有效性
    if (typeof points !== 'number' || points < 1) {
      return errorResponse(400, '积分必须为大于 0 的整数')
    }
    if (typeof timeout !== 'number' || timeout < 1) {
      return errorResponse(400, '超时时间必须大于 0')
    }

    // 验证交付方式
    const VALID_DELIVERY_METHODS = ['comment', 'email', 'url', 'callback'] as const
    const deliveryMethodInput = (delivery_method || 'comment').toLowerCase()
    if (!VALID_DELIVERY_METHODS.includes(deliveryMethodInput as typeof VALID_DELIVERY_METHODS[number])) {
      return errorResponse(400, `delivery_method 必须为以下之一: ${VALID_DELIVERY_METHODS.join(', ')}`)
    }

    // email 类型时 delivery_contact 必须是合法邮箱
    if (deliveryMethodInput === 'email') {
      if (!delivery_contact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(delivery_contact)) {
        return errorResponse(400, 'delivery_method 为 email 时，delivery_contact 必须提供合法邮箱地址')
      }
    }
    // callback 类型时 delivery_contact 必须是合法 URL
    if (deliveryMethodInput === 'callback') {
      if (!delivery_contact || !/^https?:\/\/.+/.test(delivery_contact)) {
        return errorResponse(400, 'delivery_method 为 callback 时，delivery_contact 必须提供合法 URL')
      }
    }

    const deliveryMethodEnum = deliveryMethodInput.toUpperCase() as DeliveryMethod

    // 检查积分是否足够
    const availablePoints = agent.points - agent.frozenPoints
    if (availablePoints < points) {
      return errorResponse(400, `积分不足，可用积分: ${availablePoints}`)
    }

    // 计算截止时间
    const deadline = new Date(Date.now() + timeout * 60 * 60 * 1000)

    // 创建任务并冻结积分
    const task = await prisma.$transaction(async (tx) => {
      // 冻结积分
      await tx.agent.update({
        where: { id: agent.id },
        data: {
          frozenPoints: { increment: points },
          updatedAt: new Date(),
        },
      })

      // 记录积分日志
      await tx.pointLog.create({
        data: {
          agentId: agent.id,
          amount: -points,
          type: 'TASK_SPEND',
          balance: agent.points - points,
        },
      })

      // 创建任务
      return tx.task.create({
        data: {
          title,
          description,
          points,
          timeout,
          deadline,
          deliveryMethod: deliveryMethodEnum,
          deliveryContact: delivery_contact || null,
          creatorId: agent.id,
          status: 'PENDING',
        },
      })
    })

    return successResponse({
      id: task.id,
      title: task.title,
      points: task.points,
      status: task.status,
      delivery_method: task.deliveryMethod.toLowerCase(),
      delivery_contact: task.deliveryContact,
      deadline: task.deadline.toISOString(),
      taskMdUrl: `/api/tasks/${task.id}/task.md`,
    }, '任务创建成功')
  } catch (error) {
    console.error('创建任务失败:', error)
    return errorResponse(500, '创建任务失败')
  }
}
