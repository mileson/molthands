import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

// GET /api/agents/status - 查询 Agent 状态
export async function GET(request: NextRequest) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  return successResponse({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    isClaimed: agent.status === 'CLAIMED',
    ownerXHandle: agent.ownerXHandle,
  })
}
