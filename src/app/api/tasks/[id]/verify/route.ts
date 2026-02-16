import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST /api/tasks/:id/verify - 验收任务
export async function POST(request: NextRequest, { params }: Params) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { approved, reason } = body

    if (approved === undefined) {
      return errorResponse(400, '请指定验收结果')
    }

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { id },
        include: { executor: true },
      })

      if (!task) {
        throw new Error('任务不存在')
      }

      if (task.creatorId !== agent.id) {
        throw new Error('无权验收此任务')
      }

      if (task.status !== 'COMPLETED') {
        throw new Error('任务状态不允许验收')
      }

      if (approved) {
        // 通过：转移积分给执行者
        // 创建任务时只冻结了积分（frozenPoints += cost），points 未变
        // 验收通过时需要同时扣减 points 和 frozenPoints，积分真正离开创建者
        await tx.agent.update({
          where: { id: agent.id },
          data: {
            points: { decrement: task.points },
            frozenPoints: { decrement: task.points },
            totalTasks: { increment: 1 },
            successTasks: { increment: 1 },
            updatedAt: new Date(),
          },
        })

        // 更新执行者积分
        if (task.executorId) {
          const executor = await tx.agent.findUnique({
            where: { id: task.executorId },
          })

          if (executor) {
            await tx.agent.update({
              where: { id: task.executorId },
              data: {
                points: { increment: task.points },
                totalTasks: { increment: 1 },
                successTasks: { increment: 1 },
                updatedAt: new Date(),
              },
            })

            // 记录积分日志
            await tx.pointLog.create({
              data: {
                agentId: task.executorId,
                amount: task.points,
                type: 'TASK_REWARD',
                taskId: id,
                balance: executor.points + task.points,
              },
            })
          }
        }

        // 更新双方成功率
        await updateSuccessRate(tx, agent.id)
        if (task.executorId) {
          await updateSuccessRate(tx, task.executorId)
        }

        // 更新任务状态
        const updated = await tx.task.update({
          where: { id },
          data: {
            status: 'DONE',
            verifiedAt: new Date(),
            updatedAt: new Date(),
          },
        })

        // 记录日志
        await tx.taskLog.create({
          data: {
            taskId: id,
            status: 'DONE',
            message: '验收通过',
          },
        })

        return updated
      } else {
        // 拒绝：退还积分给创建者
        // 创建时只增加了 frozenPoints，points 未变
        // 拒绝时只需要减少 frozenPoints（解冻），points 不变（因为从未扣减过）
        await tx.agent.update({
          where: { id: agent.id },
          data: {
            frozenPoints: { decrement: task.points },
            totalTasks: { increment: 1 },
            updatedAt: new Date(),
          },
        })

        // 记录积分日志 — 记录解冻，余额 = points - (frozenPoints - cost)
        await tx.pointLog.create({
          data: {
            agentId: agent.id,
            amount: task.points,
            type: 'TASK_REFUND',
            taskId: id,
            balance: agent.points - agent.frozenPoints + task.points,
          },
        })

        // 更新任务状态
        const updated = await tx.task.update({
          where: { id },
          data: {
            status: 'REFUNDED',
            verifiedAt: new Date(),
            updatedAt: new Date(),
          },
        })

        // 记录日志
        await tx.taskLog.create({
          data: {
            taskId: id,
            status: 'REFUNDED',
            message: `验收拒绝: ${reason || '无理由'}`,
          },
        })

        return updated
      }
    })

    return successResponse({
      id: result.id,
      status: result.status,
      verifiedAt: result.verifiedAt?.toISOString(),
    }, approved ? '验收通过' : '验收拒绝，积分已退还')
  } catch (error: any) {
    console.error('验收任务失败:', error)
    return errorResponse(400, error.message || '验收失败')
  }
}

// 更新成功率
async function updateSuccessRate(tx: any, agentId: string) {
  const agent = await tx.agent.findUnique({
    where: { id: agentId },
    select: { totalTasks: true, successTasks: true },
  })

  if (agent && agent.totalTasks > 0) {
    const rate = (agent.successTasks / agent.totalTasks) * 100
    await tx.agent.update({
      where: { id: agentId },
      data: { successRate: rate },
    })
  }
}
