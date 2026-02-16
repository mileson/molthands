/**
 * API 测试 - Task Details, Callback, Logs, Comments
 * 测试任务详情、进度回调、日志查询、评论功能
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    taskLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    taskComment: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  verifyApiKey: jest.fn(),
}))

import { verifyApiKey } from '@/lib/auth'
import { GET as taskDetailGet } from '@/app/api/tasks/[id]/route'
import { POST as callbackPost } from '@/app/api/tasks/[id]/callback/route'
import { GET as logsGet } from '@/app/api/tasks/[id]/logs/route'
import { GET as commentsGet, POST as commentsPost } from '@/app/api/tasks/[id]/comments/route'

const createParams = (id: string) => ({ params: Promise.resolve({ id }) })

describe('Task Details API', () => {
  const mockAgent = {
    id: 'agent-1',
    name: 'TestAgent',
    points: 100,
    frozenPoints: 10,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ========================================================================
  // GET /api/tasks/:id
  // ========================================================================
  describe('GET /api/tasks/:id', () => {
    it('should return task details', async () => {
      const { prisma } = require('@/lib/prisma')
      const mockDate = new Date('2026-01-15T10:00:00Z')
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        title: 'Test Task',
        description: 'Description',
        status: 'PENDING',
        points: 10,
        deadline: mockDate,
        createdAt: mockDate,
        claimedAt: null,
        completedAt: null,
        verifiedAt: null,
        creator: { id: 'agent-1', name: 'Creator', ownerXHandle: null },
        executor: null,
        _count: { comments: 2, logs: 3 },
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1')
      const response = await taskDetailGet(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.id).toBe('task-1')
      expect(data.data.title).toBe('Test Task')
      expect(data.data.deadline).toBe(mockDate.toISOString())
    })

    it('should return 404 when task not found', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.task.findUnique.mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/tasks/nonexistent')
      const response = await taskDetailGet(request as any, createParams('nonexistent'))
      const data = await response.json()

      expect(data.code).toBe(404)
      expect(data.message).toBe('任务不存在')
    })
  })

  // ========================================================================
  // POST /api/tasks/:id/callback
  // ========================================================================
  describe('POST /api/tasks/:id/callback', () => {
    it('should record progress callback', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue({ ...mockAgent, id: 'agent-2' })

      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1', status: 'EXECUTING', executorId: 'agent-2',
      })
      prisma.task.update.mockResolvedValue({})
      prisma.taskLog.create.mockResolvedValue({})

      const request = new Request('http://localhost:3000/api/tasks/task-1/callback', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ status: 'EXECUTING', progress: 50, message: 'Half done' }),
      })

      const response = await callbackPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.received).toBe(true)
    })

    it('should fail when not the executor', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1', status: 'EXECUTING', executorId: 'agent-2',
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/callback', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ progress: 50 }),
      })

      const response = await callbackPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(403)
    })

    it('should fail when task not found', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)
      prisma.task.findUnique.mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/tasks/nonexistent/callback', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ progress: 50 }),
      })

      const response = await callbackPost(request as any, createParams('nonexistent'))
      const data = await response.json()

      expect(data.code).toBe(404)
    })

    it('should fail when not authenticated', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/tasks/task-1/callback', {
        method: 'POST',
        body: JSON.stringify({ progress: 50 }),
      })

      const response = await callbackPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(401)
    })
  })

  // ========================================================================
  // GET /api/tasks/:id/logs
  // ========================================================================
  describe('GET /api/tasks/:id/logs', () => {
    it('should return task logs for creator', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1', creatorId: 'agent-1', executorId: 'agent-2',
      })

      const mockDate = new Date()
      prisma.taskLog.findMany.mockResolvedValue([
        { id: 'log-1', taskId: 'task-1', status: 'CLAIMED', message: 'Claimed', createdAt: mockDate },
      ])
      prisma.taskLog.count.mockResolvedValue(1)

      const request = new Request('http://localhost:3000/api/tasks/task-1/logs', {
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await logsGet(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.logs).toHaveLength(1)
      expect(data.data.pagination.total).toBe(1)
    })

    it('should deny access to non-related agent', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue({ ...mockAgent, id: 'agent-3' })

      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1', creatorId: 'agent-1', executorId: 'agent-2',
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/logs', {
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await logsGet(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(403)
    })

    it('should return 404 when task not found', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)
      prisma.task.findUnique.mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/tasks/nonexistent/logs', {
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await logsGet(request as any, createParams('nonexistent'))
      const data = await response.json()

      expect(data.code).toBe(404)
    })
  })

  // ========================================================================
  // GET/POST /api/tasks/:id/comments
  // ========================================================================
  describe('GET /api/tasks/:id/comments', () => {
    it('should return comments list', async () => {
      const { prisma } = require('@/lib/prisma')
      const mockDate = new Date()
      prisma.taskComment.findMany.mockResolvedValue([
        {
          id: 'comment-1', taskId: 'task-1', content: 'Great task!', createdAt: mockDate,
          agent: { id: 'agent-2', name: 'Commenter', ownerXHandle: null },
          _count: { votes: 3 },
        },
      ])
      prisma.taskComment.count.mockResolvedValue(1)

      const request = new Request('http://localhost:3000/api/tasks/task-1/comments')
      const response = await commentsGet(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.comments).toHaveLength(1)
      expect(data.data.comments[0].content).toBe('Great task!')
    })
  })

  describe('POST /api/tasks/:id/comments', () => {
    it('should create a comment', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const mockDate = new Date()
      prisma.taskComment.count.mockResolvedValue(0)
      prisma.taskComment.create.mockResolvedValue({
        id: 'comment-new', taskId: 'task-1', agentId: 'agent-1', content: 'Nice work!',
        createdAt: mockDate, agent: { id: 'agent-1', name: 'TestAgent', ownerXHandle: null },
      })

      const request = new Request('http://localhost:3000/api/tasks/task-1/comments', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ content: 'Nice work!' }),
      })

      const response = await commentsPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.content).toBe('Nice work!')
      expect(data.message).toBe('评论成功')
    })

    it('should fail when content is empty', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const request = new Request('http://localhost:3000/api/tasks/task-1/comments', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ content: '' }),
      })

      const response = await commentsPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('不能为空')
    })

    it('should fail when content exceeds 1000 chars', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const request = new Request('http://localhost:3000/api/tasks/task-1/comments', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ content: 'a'.repeat(1001) }),
      })

      const response = await commentsPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('1000')
    })

    it('should fail when comment limit reached (5 per agent)', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)
      prisma.taskComment.count.mockResolvedValue(5)

      const request = new Request('http://localhost:3000/api/tasks/task-1/comments', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-key' },
        body: JSON.stringify({ content: 'One more comment' }),
      })

      const response = await commentsPost(request as any, createParams('task-1'))
      const data = await response.json()

      expect(data.code).toBe(400)
      expect(data.message).toContain('5 条')
    })
  })
})
