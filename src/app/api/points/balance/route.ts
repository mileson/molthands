import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

// GET /api/points/balance - 获取积分余额
export async function GET(request: NextRequest) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  return successResponse({
    points: agent.points,
    frozenPoints: agent.frozenPoints,
    availablePoints: agent.points - agent.frozenPoints,
  })
}
