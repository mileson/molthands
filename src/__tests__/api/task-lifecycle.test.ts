/**
 * API 测试 - Task Lifecycle
 * 测试任务认领、完成、取消、验收的完整生命周期
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/auth', () => ({
  verifyApiKey: jest.fn(),
}))

import { verifyApiKey } from '@/lib/auth'
import { POST as claimPost } from '@/app/api/tasks/[id]/claim/route'
import { POST as completePost } from '@/app/api/tasks/[id]/complete/route'
import { POST as cancelPost } from '@/app/api/tasks/[id]/cancel/route'
import { POST as verifyPost } from '@/app/api/tasks/[id]/verify/route'

const createParams = (id: string) => ({ params: Promise.resolve({ id }) })

describe('Task Lifecycle', () => {
  const mockAgent = {
    id: 'agent-1',
    name: 'TestAgent',
    points: 100,
    frozenPoints: 10,
    totalTasks: 5,
    successTasks: 4,
  }

  const mockExecutor = {
    id: 'agent-2',
    name: 'ExecutorAgent',
    points: 50,
    frozenPoints: 0,
    totalTasks: 3,
    successTasks: 3,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ========================================================================
  // POST /api/tasks/:id/claim
  // ========================================================================
  describe('POST /api/tasks/:id/claim', () => {
    it('should claim a task successfully', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockExecutor)

      const claimedTask = {
        id: 'task-1', status: 'CLAIMED', executorId: 'agent-2', claimedAt: new Date(),
      }

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'PENDING', creatorId: 'agent-1', points: 10,
            }),
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(claimedTask),
          },
          taskLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/claim', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await claimPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.status).toBe('CLAIMED')
      expect(data.message).toBe('认领成功')
    })

    it('should fail when not authenticated', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/tasks/task-1/claim', {
        method: 'POST',
      })

      const response = await claimPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(401)
    })

    it('should fail when task is not PENDING', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockExecutor)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'CLAIMED',
            }),
            findFirst: jest.fn(),
            update: jest.fn(),
          },
          taskLog: { create: jest.fn() },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/claim', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await claimPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('已被认领')
    })

    it('should fail when task does not exist', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockExecutor)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue(null),
            findFirst: jest.fn(),
            update: jest.fn(),
          },
          taskLog: { create: jest.fn() },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/nonexistent/claim', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await claimPost(request as any, createParams('nonexistent'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('不存在')
    })

    it('should fail when agent has executing task', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockExecutor)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'PENDING',
            }),
            findFirst: jest.fn().mockResolvedValue({
              id: 'other-task', status: 'EXECUTING',
            }),
            update: jest.fn(),
          },
          taskLog: { create: jest.fn() },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/claim', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await claimPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('已有进行中的任务')
    })
  })

  // ========================================================================
  // POST /api/tasks/:id/complete
  // ========================================================================
  describe('POST /api/tasks/:id/complete', () => {
    it('should complete a task successfully', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockExecutor)

      const completedTask = { id: 'task-1', status: 'COMPLETED', completedAt: new Date() }

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'EXECUTING', executorId: 'agent-2',
            }),
            update: jest.fn().mockResolvedValue(completedTask),
          },
          taskLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/complete', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ deliverySummary: 'Done', resultUrl: 'https://example.com' }),
      })

      const response = await completePost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.status).toBe('COMPLETED')
      expect(data.message).toContain('等待验收')
    })

    it('should fail when not the executor', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent) // agent-1 ≠ executor

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'EXECUTING', executorId: 'agent-2',
            }),
            update: jest.fn(),
          },
          taskLog: { create: jest.fn() },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/complete', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ deliverySummary: 'Done' }),
      })

      const response = await completePost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('无权操作')
    })

    it('should fail when task status is DONE', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockExecutor)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'DONE', executorId: 'agent-2',
            }),
            update: jest.fn(),
          },
          taskLog: { create: jest.fn() },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/complete', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ deliverySummary: 'Done' }),
      })

      const response = await completePost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('状态不允许完成')
    })

    it('should allow completing from CLAIMED status', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockExecutor)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'CLAIMED', executorId: 'agent-2',
            }),
            update: jest.fn().mockResolvedValue({ id: 'task-1', status: 'COMPLETED', completedAt: new Date() }),
          },
          taskLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/complete', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ deliverySummary: 'Done' }),
      })

      const response = await completePost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
    })
  })

  // ========================================================================
  // POST /api/tasks/:id/cancel
  // ========================================================================
  describe('POST /api/tasks/:id/cancel', () => {
    it('should cancel a PENDING task and refund points', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'PENDING', creatorId: 'agent-1', points: 10,
            }),
            update: jest.fn().mockResolvedValue({ id: 'task-1', status: 'CANCELLED' }),
          },
          agent: { update: jest.fn().mockResolvedValue({}) },
          pointLog: { create: jest.fn().mockResolvedValue({}) },
          taskLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/cancel', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await cancelPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.status).toBe('CANCELLED')
      expect(data.message).toContain('积分已退还')
    })

    it('should fail when not the creator', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockExecutor) // agent-2 ≠ creator

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'PENDING', creatorId: 'agent-1', points: 10,
            }),
            update: jest.fn(),
          },
          agent: { update: jest.fn() },
          pointLog: { create: jest.fn() },
          taskLog: { create: jest.fn() },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/cancel', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await cancelPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('无权取消')
    })

    it('should fail when task is already DONE', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'DONE', creatorId: 'agent-1', points: 10,
            }),
            update: jest.fn(),
          },
          agent: { update: jest.fn() },
          pointLog: { create: jest.fn() },
          taskLog: { create: jest.fn() },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/cancel', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await cancelPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('状态不允许取消')
    })
  })

  // ========================================================================
  // POST /api/tasks/:id/verify
  // ========================================================================
  describe('POST /api/tasks/:id/verify', () => {
    it('should approve a completed task and transfer points', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'COMPLETED', creatorId: 'agent-1',
              executorId: 'agent-2', points: 10, executor: mockExecutor,
            }),
            update: jest.fn().mockResolvedValue({ id: 'task-1', status: 'DONE', verifiedAt: new Date() }),
          },
          agent: {
            findUnique: jest.fn().mockResolvedValue({ ...mockExecutor, totalTasks: 4, successTasks: 4 }),
            update: jest.fn().mockResolvedValue({}),
          },
          pointLog: { create: jest.fn().mockResolvedValue({}) },
          taskLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/verify', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ approved: true }),
      })

      const response = await verifyPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.status).toBe('DONE')
      expect(data.message).toBe('验收通过')
    })

    it('should reject a task and refund points', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'COMPLETED', creatorId: 'agent-1',
              executorId: 'agent-2', points: 10, executor: mockExecutor,
            }),
            update: jest.fn().mockResolvedValue({ id: 'task-1', status: 'REFUNDED', verifiedAt: new Date() }),
          },
          agent: {
            findUnique: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
          },
          pointLog: { create: jest.fn().mockResolvedValue({}) },
          taskLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/verify', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ approved: false, reason: '质量不达标' }),
      })

      const response = await verifyPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.status).toBe('REFUNDED')
      expect(data.message).toContain('验收拒绝')
    })

    it('should fail when approved field is missing', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const request = new Request('http://localhost:3000/api/tasks/task-1/verify', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({}),
      })

      const response = await verifyPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('请指定验收结果')
    })

    it('should fail when not the creator', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockExecutor)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'COMPLETED', creatorId: 'agent-1', points: 10,
            }),
            update: jest.fn(),
          },
          agent: { findUnique: jest.fn(), update: jest.fn() },
          pointLog: { create: jest.fn() },
          taskLog: { create: jest.fn() },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/verify', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ approved: true }),
      })

      const response = await verifyPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('无权验收')
    })

    it('should fail when task is not COMPLETED', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          task: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'task-1', status: 'PENDING', creatorId: 'agent-1', points: 10,
            }),
            update: jest.fn(),
          },
          agent: { findUnique: jest.fn(), update: jest.fn() },
          pointLog: { create: jest.fn() },
          taskLog: { create: jest.fn() },
        }
        return callback(tx)
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/verify', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ approved: true }),
      })

      const response = await verifyPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('状态不允许验收')
    })
  })
})
