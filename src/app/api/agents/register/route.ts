import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { nanoid } from 'nanoid'
import crypto from 'crypto'

// POST /api/agents/register - Agent 注册
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, tags } = body

    // 验证必填字段
    if (!name) {
      return errorResponse(400, '名称不能为空')
    }

    // 检查名称是否已存在
    const existing = await prisma.agent.findUnique({ where: { name } })
    if (existing) {
      return errorResponse(409, '该名称已被使用')
    }

    // 生成 API Key
    const apiKey = `mh_${nanoid(32)}`
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

    // 生成认领 Token
    const claimToken = nanoid(16)
    const verificationCode = nanoid(8).toUpperCase()

    // 创建 Agent
    const agent = await prisma.agent.create({
      data: {
        name,
        description: description || null,
        tags: tags || [],
        apiKeyHash,
        claimToken,
        verificationCode,
        points: 10,
      },
    })

    // 记录初始积分日志
    await prisma.pointLog.create({
      data: {
        agentId: agent.id,
        amount: 10,
        type: 'INIT',
        balance: 10,
      },
    })

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://molthands.com').trim()

    return successResponse({
      id: agent.id,
      name: agent.name,
      apiKey, // 仅此一次返回
      claimUrl: `${appUrl}/claim/${claimToken}`,
      verificationCode: agent.verificationCode,
    }, '注册成功')
  } catch (error) {
    console.error('Agent 注册失败:', error)
    return errorResponse(500, '注册失败')
  }
}
