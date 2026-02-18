import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus, Prisma } from '@prisma/client'

/**
 * GET /api/tasks-board — 任务看板数据接口
 *
 * 完整模式（默认）：statusCounts + activityFeed + tasks + executingTasks
 * 轻量模式（?light=1）：只返回 tasks + total + totalPages（分页翻页用）
 *   - 跳过 statusCounts / activityFeed / executingTasks 查询
 *   - 数据库查询从 5 条降到 2 条，响应速度提升 2-3x
 *
 * CDN 缓存：s-maxage=60, stale-while-revalidate=300
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || undefined
  const search = searchParams.get('search') || undefined
  const page = searchParams.get('page') || undefined
  const light = searchParams.get('light') === '1'

  const pageNum = parseInt(page || '1')
  const limit = 36

  const where: Prisma.TaskWhereInput = {
    ...(status && { status: status as TaskStatus }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  try {
    // ── 轻量模式：仅 tasks + count（2 条查询）──
    if (light) {
      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          select: {
            id: true, title: true, status: true, points: true,
            progress: true, deadline: true, createdAt: true, deliveryMethod: true,
            executor: { select: { name: true } },
            creator: { select: { name: true } },
            _count: { select: { comments: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limit,
          take: limit,
        }),
        prisma.task.count({ where }),
      ])

      const taskList = tasks.map(t => ({
        id: t.id, title: t.title, status: t.status, points: t.points,
        progress: t.progress, deadline: t.deadline.toISOString(),
        executorName: t.executor?.name ?? null, creatorName: t.creator?.name ?? null,
        commentCount: t._count?.comments ?? 0, createdAt: t.createdAt.toISOString(),
        deliveryMethod: t.deliveryMethod,
      }))

      return Response.json(
        { tasks: taskList, total, totalPages: Math.ceil(total / limit) },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
      )
    }

    // ── 完整模式：全量数据（5 条并行查询）──
    const showExecuting = !status || status === 'EXECUTING'

    const [statusGroups, recentLogs, tasks, total, executingTasks] = await Promise.all([
      prisma.task.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.taskLog.findMany({
        select: {
          id: true, status: true, progress: true,
          task: {
            select: { title: true, executor: { select: { name: true } }, creator: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.task.findMany({
        where,
        select: {
          id: true, title: true, status: true, points: true,
          progress: true, deadline: true, createdAt: true, deliveryMethod: true,
          executor: { select: { name: true } },
          creator: { select: { name: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limit,
        take: limit,
      }),
      prisma.task.count({ where }),
      showExecuting
        ? prisma.task.findMany({
            where: { status: 'EXECUTING' },
            select: { id: true, title: true, points: true, progress: true, executor: { select: { name: true } } },
            orderBy: { claimedAt: 'desc' },
            take: 6,
          })
        : Promise.resolve([]),
    ])

    const statusCounts = { pending: 0, claimed: 0, executing: 0, completed: 0, done: 0, total: 0 }
    for (const g of statusGroups) {
      const c = g._count.status
      statusCounts.total += c
      switch (g.status) {
        case 'PENDING': statusCounts.pending = c; break
        case 'CLAIMED': statusCounts.claimed = c; break
        case 'EXECUTING': statusCounts.executing = c; break
        case 'COMPLETED': statusCounts.completed = c; break
        case 'DONE': statusCounts.done = c; break
      }
    }

    const activityFeed = recentLogs.map((log) => {
      const agentName = log.task.executor?.name || log.task.creator?.name || 'Agent'
      let type: string = 'executing'
      let detail: string | undefined
      if (log.status === 'COMPLETED' || log.status === 'DONE') type = 'completed'
      else if (log.status === 'CLAIMED') type = 'claimed'
      else if (log.status === 'EXECUTING') { type = 'executing'; if (log.progress) detail = `${log.progress}%` }
      else if (log.status === 'PENDING') type = 'posted'
      return { id: log.id, type, agentName, taskTitle: log.task.title, detail }
    })

    const taskList = tasks.map(t => ({
      id: t.id, title: t.title, status: t.status, points: t.points,
      progress: t.progress, deadline: t.deadline.toISOString(),
      executorName: t.executor?.name ?? null, creatorName: t.creator?.name ?? null,
      commentCount: t._count?.comments ?? 0, createdAt: t.createdAt.toISOString(),
      deliveryMethod: t.deliveryMethod,
    }))

    return Response.json(
      { statusCounts, activityFeed, tasks: taskList, total, totalPages: Math.ceil(total / limit), executingTasks },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch (error) {
    console.error('[tasks-board] Query error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
