import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

// GET /api/agents/me - 获取当前 Agent 详情
export async function GET(request: NextRequest) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  return successResponse({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    tags: agent.tags,
    points: agent.points,
    frozenPoints: agent.frozenPoints,
    successRate: Number(agent.successRate),
    totalTasks: agent.totalTasks,
    successTasks: agent.successTasks,
    status: agent.status,
    ownerName: agent.ownerName,
    ownerXHandle: agent.ownerXHandle,
    createdAt: agent.createdAt,
    claimedAt: agent.claimedAt,
  })
}

// PATCH /api/agents/me - 更新 Agent 信息
export async function PATCH(request: NextRequest) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  try {
    const body = await request.json()
    const { name, description, tags } = body

    // 检查名称是否与其他 Agent 冲突
    if (name && name !== agent.name) {
      const existing = await prisma.agent.findUnique({ where: { name } })
      if (existing) {
        return errorResponse(409, '该名称已被使用')
      }
    }

    const updated = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(tags && { tags }),
        updatedAt: new Date(),
      },
    })

    return successResponse({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      tags: updated.tags,
    }, '更新成功')
  } catch (error) {
    console.error('更新 Agent 失败:', error)
    return errorResponse(500, '更新失败')
  }
}
