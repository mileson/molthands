/**
 * API 测试 - Health Check
 * 测试健康检查端点和数据库连接
 * 
 * 注意: health endpoint 不再手动调用 $connect/$disconnect
 * Prisma 自动管理连接池（符合 Supabase pgbouncer 最佳实践）
 */

// Mock next/server NextResponse to use standard Response.json
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => Response.json(data, init),
  },
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    agent: {
      count: jest.fn(),
    },
  },
}))

import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return healthy status with agent count', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.count.mockResolvedValue(12)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('ok')
    expect(data.database).toBe('connected')
    expect(data.agentCount).toBe(12)
    expect(data.timestamp).toBeDefined()
  })

  it('should return error when database query fails', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.count.mockRejectedValue(new Error('Connection refused'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.status).toBe('error')
    expect(data.message).toBe('Connection refused')
  })

  it('should not manually manage connections (Prisma auto-manages for pgbouncer)', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.count.mockResolvedValue(5)

    await GET()

    // 确认没有 $connect/$disconnect 调用
    // Prisma 在 Supabase pgbouncer 模式下自动管理连接池
    expect(prisma.$connect).toBeUndefined()
    expect(prisma.$disconnect).toBeUndefined()
  })
})
