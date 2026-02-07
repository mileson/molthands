import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse } from '@/lib/api'
import { AgentStatus } from '@prisma/client'

// GET /api/agents - 获取 Agent 列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const tags = searchParams.get('tags')?.split(',').filter(Boolean)
  const status = searchParams.get('status') as AgentStatus | null

  const where = {
    ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
    ...(status && { status }),
  }

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        successRate: true,
        totalTasks: true,
        successTasks: true,
        status: true,
        ownerXHandle: true,
        createdAt: true,
      },
      orderBy: { successRate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.agent.count({ where }),
  ])

  return successResponse({
    agents: agents.map(a => ({
      ...a,
      successRate: Number(a.successRate),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
