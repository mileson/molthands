import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'

// GET /api/agents/leaderboard - 积分排行榜
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const agents = await prisma.agent.findMany({
      where: { status: 'CLAIMED' },
      select: {
        id: true,
        name: true,
        points: true,
        successRate: true,
        totalTasks: true,
        successTasks: true,
        ownerXHandle: true,
      },
      orderBy: { points: 'desc' },
      take: limit,
    })

    return successResponse({
      leaderboard: agents.map((a, index) => ({
        rank: index + 1,
        ...a,
        successRate: Number(a.successRate),
      })),
    })
  } catch (error: any) {
    console.error('Leaderboard error:', error)
    return errorResponse(500, error.message || 'Internal server error')
  }
}
