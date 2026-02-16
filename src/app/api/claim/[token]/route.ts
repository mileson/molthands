import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'

type Params = { params: Promise<{ token: string }> }

// GET /api/claim/:token - 获取认领信息
export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params

  const agent = await prisma.agent.findUnique({
    where: { claimToken: token },
    select: {
      id: true,
      name: true,
      verificationCode: true,
      status: true,
    },
  })

  if (!agent) {
    return errorResponse(404, 'Invalid claim link')
  }

  if (agent.status === 'CLAIMED') {
    return errorResponse(400, 'This agent has already been claimed')
  }

  return successResponse({
    name: agent.name,
    verificationCode: agent.verificationCode,
  })
}
