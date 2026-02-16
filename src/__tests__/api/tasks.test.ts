/**
 * API 测试 - Tasks
 * 测试任务列表查询、任务创建功能
 */

import { GET as tasksGet, POST as tasksPost } from '@/app/api/tasks/route'

// Mock prisma with $transaction support
jest.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    agent: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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

// Mock auth
jest.mock('@/lib/auth', () => ({
  verifyApiKey: jest.fn(),
}))

import { verifyApiKey } from '@/lib/auth'

describe('/api/tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/tasks', () => {
    it('should return tasks list with pagination', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.task.findMany.mockResolvedValue([])
      prisma.task.count.mockResolvedValue(0)

      const request = new Request('http://localhost:3000/api/tasks?page=1&limit=20')
      const response = await tasksGet(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.code).toBe(0)
      expect(data.data.pagination).toBeDefined()
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.limit).toBe(20)
      expect(data.data.pagination.total).toBe(0)
    })

    it('should filter tasks by status', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.task.findMany.mockResolvedValue([])
      prisma.task.count.mockResolvedValue(0)

      const request = new Request('http://localhost:3000/api/tasks?status=PENDING')
      const response = await tasksGet(request as any)

      expect(response.status).toBe(200)
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      )
    })

    it('should filter tasks by creatorId', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.task.findMany.mockResolvedValue([])
      prisma.task.count.mockResolvedValue(0)

      const request = new Request('http://localhost:3000/api/tasks?creatorId=agent-1')
      const response = await tasksGet(request as any)

      expect(response.status).toBe(200)
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            creatorId: 'agent-1',
          }),
        })
      )
    })

    it('should support search by title or description', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.task.findMany.mockResolvedValue([])
      prisma.task.count.mockResolvedValue(0)

      const request = new Request('http://localhost:3000/api/tasks?search=test')
      const response = await tasksGet(request as any)

      expect(response.status).toBe(200)
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'test' } },
              { description: { contains: 'test' } },
            ],
          }),
        })
      )
    })

    it('should return tasks with correct date formatting', async () => {
      const { prisma } = require('@/lib/prisma')
      const mockDate = new Date('2026-01-15T10:00:00Z')
      prisma.task.findMany.mockResolvedValue([{
        id: 'task-1',
        title: 'Test Task',
        status: 'PENDING',
        points: 10,
        deadline: mockDate,
        createdAt: mockDate,
        claimedAt: null,
        completedAt: null,
        verifiedAt: null,
        creator: { id: 'agent-1', name: 'Agent1', ownerXHandle: null },
        executor: null,
        _count: { comments: 0 },
      }])
      prisma.task.count.mockResolvedValue(1)

      const request = new Request('http://localhost:3000/api/tasks')
      const response = await tasksGet(request as any)
      const data = await response.json()

      expect(data.data.tasks[0].deadline).toBe(mockDate.toISOString())
      expect(data.data.tasks[0].createdAt).toBe(mockDate.toISOString())
    })
  })

  describe('POST /api/tasks', () => {
    const mockAgent = {
      id: 'agent-1',
      name: 'TestAgent',
      points: 100,
      frozenPoints: 0,
    }

    it('should create a new task when authenticated', async () => {
      const { prisma } = require('@/lib/prisma')
      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        points: 10,
        status: 'PENDING',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }

      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          agent: { update: jest.fn().mockResolvedValue(mockAgent) },
          pointLog: { create: jest.fn().mockResolvedValue({}) },
          task: { create: jest.fn().mockResolvedValue(mockTask) },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({
          title: 'Test Task',
          description: 'Test description',
          points: 10,
          timeout: 24,
        }),
      })

      const response = await tasksPost(request as any)
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.title).toBe('Test Task')
      expect(data.data.taskMdUrl).toContain('/api/tasks/')
      expect(data.message).toBe('任务创建成功')
    })

    it('should fail when not authenticated', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer invalid-key' },
        body: JSON.stringify({
          title: 'Test Task',
          points: 10,
          timeout: 24,
        }),
      })

      const response = await tasksPost(request as any)
      const data = await response.json()

      expect(data.code).toBe(401)
      expect(data.message).toBe('未授权')
    })

    it('should fail when points are insufficient', async () => {
      const poorAgent = { ...mockAgent, points: 5, frozenPoints: 0 }
      ;(verifyApiKey as jest.Mock).mockResolvedValue(poorAgent)

      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({
          title: 'Test Task',
          points: 100,
          timeout: 24,
        }),
      })

      const response = await tasksPost(request as any)
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('积分不足')
    })

    it('should consider frozen points when checking balance', async () => {
      const agentWithFrozen = { ...mockAgent, points: 100, frozenPoints: 95 }
      ;(verifyApiKey as jest.Mock).mockResolvedValue(agentWithFrozen)

      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({
          title: 'Test Task',
          points: 10,
          timeout: 24,
        }),
      })

      const response = await tasksPost(request as any)
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('积分不足')
    })

    it('should fail when required fields are missing', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({
          title: 'Test Task',
        }),
      })

      const response = await tasksPost(request as any)
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toBe('缺少必填字段')
    })

    it('should fail when title is missing', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({
          points: 10,
          timeout: 24,
        }),
      })

      const response = await tasksPost(request as any)
      const data = await response.json()

      expect(data.code).toBe(400)
    })

    it('should handle transaction failure gracefully', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      prisma.$transaction.mockRejectedValue(new Error('DB Error'))

      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({
          title: 'Test Task',
          description: 'Test',
          points: 10,
          timeout: 24,
        }),
      })

      const response = await tasksPost(request as any)
      const data = await response.json()

      expect(data.code).toBe(500)
      expect(data.message).toBe('创建任务失败')
    })
  })
})
