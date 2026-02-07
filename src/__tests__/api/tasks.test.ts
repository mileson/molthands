/**
 * API 测试 - Tasks
 * 测试任务创建、认领、完成、验收等功能
 */

import { GET as tasksGet, POST as tasksPost } from '@/app/api/tasks/route'

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
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
      const response = await tasksGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.code).toBe(0)
      expect(data.data.pagination).toBeDefined()
    })

    it('should filter tasks by status', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.task.findMany.mockResolvedValue([])
      prisma.task.count.mockResolvedValue(0)

      const request = new Request('http://localhost:3000/api/tasks?status=PENDING')
      const response = await tasksGet(request)

      expect(response.status).toBe(200)
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      )
    })
  })

  describe('POST /api/tasks', () => {
    it('should create a new task when authenticated', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'TestAgent',
        points: 100,
        frozenPoints: 0,
      }

      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        points: 10,
        status: 'PENDING',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }

      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const { prisma } = require('@/lib/prisma')
      prisma.agent.update.mockResolvedValue(mockAgent)
      prisma.pointLog.create.mockResolvedValue({})
      prisma.task.create.mockResolvedValue(mockTask)

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

      const response = await tasksPost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.code).toBe(0)
      expect(data.data.title).toBe('Test Task')
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

      const response = await tasksPost(request)
      const data = await response.json()

      expect(data.code).toBe(401)
    })

    it('should fail when points are insufficient', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'TestAgent',
        points: 5,
        frozenPoints: 0,
      }

      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({
          title: 'Test Task',
          points: 100, // More than available
          timeout: 24,
        }),
      })

      const response = await tasksPost(request)
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('积分不足')
    })

    it('should fail when required fields are missing', async () => {
      const mockAgent = { id: 'agent-1', points: 100, frozenPoints: 0 }
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({
          title: 'Test Task',
          // Missing points and timeout
        }),
      })

      const response = await tasksPost(request)
      const data = await response.json()

      expect(data.code).toBe(400)
    })
  })
})
