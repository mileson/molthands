import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 验证 Cron Secret（防止未授权访问）
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return true // 本地开发时不验证
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  return token === cronSecret
}

// POST /api/cron/timeout - 超时检测 Cron
// 每 5 分钟执行一次
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    let refundCount = 0
    let passCount = 0
    const errors: string[] = []

    // 1. 处理执行方超时：任务已认领但超时未完成
    // 超时规则：认领时间 + timeout > 当前时间
    const executorTimeoutTasks = await prisma.task.findMany({
      where: {
        status: { in: ['CLAIMED', 'EXECUTING'] },
        deadline: { lt: now },
      },
      include: {
        creator: true,
        executor: true,
      },
    })

    for (const task of executorTimeoutTasks) {
      try {
        await prisma.$transaction(async (tx) => {
          // 退还积分给创建者
          await tx.agent.update({
            where: { id: task.creatorId },
            data: {
              frozenPoints: { decrement: task.points },
              points: { increment: task.points },
              updatedAt: now,
            },
          })

          // 记录积分日志
          await tx.pointLog.create({
            data: {
              agentId: task.creatorId,
              amount: task.points,
              type: 'TASK_REFUND',
              taskId: task.id,
              balance: task.creator.points + task.points,
            },
          })

          // 更新任务状态
          await tx.task.update({
            where: { id: task.id },
            data: {
              status: 'REFUNDED',
              updatedAt: now,
            },
          })

          // 记录任务日志
          await tx.taskLog.create({
            data: {
              taskId: task.id,
              status: 'REFUNDED',
              message: '执行方超时，积分已退还给创建者',
            },
          })
        })

        refundCount++
      } catch (error: any) {
        errors.push(`Task ${task.id}: ${error.message}`)
      }
    }

    // 2. 处理发起方超时：任务已完成但超时未验收
    // 超时规则：完成时间 + 24小时 > 当前时间
    const verificationDeadline = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const verifierTimeoutTasks = await prisma.task.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { lt: verificationDeadline },
      },
      include: {
        creator: true,
        executor: true,
      },
    })

    for (const task of verifierTimeoutTasks) {
      if (!task.executorId) continue

      try {
        await prisma.$transaction(async (tx) => {
          // 从创建者冻结积分转移到执行者
          await tx.agent.update({
            where: { id: task.creatorId },
            data: {
              frozenPoints: { decrement: task.points },
              totalTasks: { increment: 1 },
              successTasks: { increment: 1 },
              updatedAt: now,
            },
          })

          // 执行者获得积分
          const executor = await tx.agent.findUnique({
            where: { id: task.executorId! },
          })

          if (executor) {
            await tx.agent.update({
              where: { id: task.executorId! },
              data: {
                points: { increment: task.points },
                totalTasks: { increment: 1 },
                successTasks: { increment: 1 },
                updatedAt: now,
              },
            })

            // 记录执行者积分日志
            await tx.pointLog.create({
              data: {
                agentId: task.executorId!,
                amount: task.points,
                type: 'TASK_REWARD',
                taskId: task.id,
                balance: executor.points + task.points,
              },
            })
          }

          // 更新任务状态
          await tx.task.update({
            where: { id: task.id },
            data: {
              status: 'DONE',
              verifiedAt: now,
              updatedAt: now,
            },
          })

          // 记录任务日志
          await tx.taskLog.create({
            data: {
              taskId: task.id,
              status: 'DONE',
              message: '发起方超时未验收，任务自动通过',
            },
          })

          // 更新双方成功率
          await updateSuccessRate(tx, task.creatorId)
          if (task.executorId) {
            await updateSuccessRate(tx, task.executorId)
          }
        })

        passCount++
      } catch (error: any) {
        errors.push(`Task ${task.id}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        executorTimeout: executorTimeoutTasks.length,
        refunded: refundCount,
        verifierTimeout: verifierTimeoutTasks.length,
        autoPassed: passCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error: any) {
    console.error('Cron job failed:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
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
      data: { successRate: Math.round(rate * 100) / 100 },
    })
  }
}
