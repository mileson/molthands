/**
 * API 测试 - Cron Timeout
 * 测试超时检测定时任务：执行方超时退款、发起方超时自动通过
 */

// Mock next/server NextResponse & NextRequest
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => Response.json(data, init),
  },
  NextRequest: jest.fn().mockImplementation((input: any, init?: any) => {
    return new Request(input, init)
  }),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    agent: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pointLog: {
      create: jest.fn(),
    },
    taskLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

import { POST } from '@/app/api/cron/timeout/route'

describe('POST /api/cron/timeout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('should handle executor timeout and refund points', async () => {
    const { prisma } = require('@/lib/prisma')
    const now = new Date()
    const pastDeadline = new Date(now.getTime() - 60 * 60 * 1000)

    prisma.task.findMany
      .mockResolvedValueOnce([
        {
          id: 'task-1', status: 'CLAIMED', creatorId: 'creator-1', executorId: 'executor-1',
          points: 10, deadline: pastDeadline,
          creator: { id: 'creator-1', points: 90 },
          executor: { id: 'executor-1', points: 50 },
        },
      ])
      .mockResolvedValueOnce([])

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        agent: {
          findUnique: jest.fn().mockResolvedValue({ totalTasks: 1, successTasks: 1 }),
          update: jest.fn().mockResolvedValue({}),
        },
        task: { update: jest.fn().mockResolvedValue({}) },
        pointLog: { create: jest.fn().mockResolvedValue({}) },
        taskLog: { create: jest.fn().mockResolvedValue({}) },
      }
      return callback(tx)
    })

    const request = new Request('http://localhost:3000/api/cron/timeout', { method: 'POST' })
    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.summary.executorTimeout).toBe(1)
    expect(data.summary.refunded).toBe(1)
  })

  it('should handle verifier timeout and auto-approve', async () => {
    const { prisma } = require('@/lib/prisma')
    const now = new Date()
    const completedLongAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000)

    prisma.task.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'task-2', status: 'COMPLETED', creatorId: 'creator-1', executorId: 'executor-1',
          points: 15, completedAt: completedLongAgo,
          creator: { id: 'creator-1', points: 85 },
          executor: { id: 'executor-1', points: 50 },
        },
      ])

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        agent: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'executor-1', points: 50, totalTasks: 2, successTasks: 2,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        task: { update: jest.fn().mockResolvedValue({}) },
        pointLog: { create: jest.fn().mockResolvedValue({}) },
        taskLog: { create: jest.fn().mockResolvedValue({}) },
      }
      return callback(tx)
    })

    const request = new Request('http://localhost:3000/api/cron/timeout', { method: 'POST' })
    const response = await POST(request as any)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.summary.verifierTimeout).toBe(1)
    expect(data.summary.autoPassed).toBe(1)
  })

  it('should return empty summary when no timeouts', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.task.findMany.mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/cron/timeout', { method: 'POST' })
    const response = await POST(request as any)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.summary.executorTimeout).toBe(0)
    expect(data.summary.verifierTimeout).toBe(0)
  })

  it('should require auth when CRON_SECRET is set', async () => {
    process.env.CRON_SECRET = 'my-secret'

    const request = new Request('http://localhost:3000/api/cron/timeout', { method: 'POST' })
    const response = await POST(request as any)
    expect(response.status).toBe(401)

    delete process.env.CRON_SECRET
  })

  it('should allow access with correct CRON_SECRET', async () => {
    const { prisma } = require('@/lib/prisma')
    process.env.CRON_SECRET = 'my-secret'
    prisma.task.findMany
      .mockResolvedValueOnce([]) // executor timeout tasks
      .mockResolvedValueOnce([]) // verifier timeout tasks

    const request = new Request('http://localhost:3000/api/cron/timeout', {
      method: 'POST',
      headers: { 'authorization': 'Bearer my-secret' },
    })

    const response = await POST(request as any)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.summary).toBeDefined()

    delete process.env.CRON_SECRET
  })

  it('should reject wrong CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'my-secret'

    const request = new Request('http://localhost:3000/api/cron/timeout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer wrong-secret' },
    })

    const response = await POST(request as any)
    expect(response.status).toBe(401)

    delete process.env.CRON_SECRET
  })

  it('should handle errors gracefully in individual tasks', async () => {
    const { prisma } = require('@/lib/prisma')

    prisma.task.findMany
      .mockResolvedValueOnce([
        {
          id: 'task-err', status: 'CLAIMED', creatorId: 'creator-1', executorId: 'executor-1',
          points: 10,
          creator: { id: 'creator-1', points: 90 },
          executor: { id: 'executor-1', points: 50 },
        },
      ])
      .mockResolvedValueOnce([])

    prisma.$transaction.mockImplementation(async () => {
      throw new Error('DB error')
    })

    const request = new Request('http://localhost:3000/api/cron/timeout', { method: 'POST' })
    const response = await POST(request as any)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.summary.executorTimeout).toBe(1)
    expect(data.summary.refunded).toBe(0)
    expect(data.summary.errors).toBeDefined()
    expect(data.summary.errors.length).toBeGreaterThan(0)
  })
})
