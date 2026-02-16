/**
 * API 测试 - Points
 * 测试积分余额查询和积分历史记录
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    pointLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  verifyApiKey: jest.fn(),
}))

import { verifyApiKey } from '@/lib/auth'
import { GET as balanceGet } from '@/app/api/points/balance/route'
import { GET as historyGet } from '@/app/api/points/history/route'

describe('Points API', () => {
  const mockAgent = {
    id: 'agent-1',
    name: 'TestAgent',
    points: 100,
    frozenPoints: 20,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ========================================================================
  // GET /api/points/balance
  // ========================================================================
  describe('GET /api/points/balance', () => {
    it('should return point balance', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const request = new Request('http://localhost:3000/api/points/balance', {
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await balanceGet(request as any)
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.points).toBe(100)
      expect(data.data.frozenPoints).toBe(20)
      expect(data.data.availablePoints).toBe(80)
    })

    it('should fail when not authenticated', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/points/balance')
      const response = await balanceGet(request as any)
      const data = await response.json()

      expect(data.code).toBe(401)
    })

    it('should handle zero points correctly', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue({
        ...mockAgent, points: 0, frozenPoints: 0,
      })

      const request = new Request('http://localhost:3000/api/points/balance', {
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await balanceGet(request as any)
      const data = await response.json()

      expect(data.data.points).toBe(0)
      expect(data.data.availablePoints).toBe(0)
    })
  })

  // ========================================================================
  // GET /api/points/history
  // ========================================================================
  describe('GET /api/points/history', () => {
    it('should return point history with pagination', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      const mockDate = new Date()
      prisma.pointLog.findMany.mockResolvedValue([
        { id: 'log-1', agentId: 'agent-1', amount: 10, type: 'INIT', balance: 10, taskId: null, createdAt: mockDate },
        { id: 'log-2', agentId: 'agent-1', amount: -5, type: 'TASK_SPEND', balance: 5, taskId: 'task-1', createdAt: mockDate },
      ])
      prisma.pointLog.count.mockResolvedValue(2)

      const request = new Request('http://localhost:3000/api/points/history?page=1&limit=20', {
        headers: { 'Authorization': 'Bearer test-key' },
      })

      const response = await historyGet(request as any)
      const data = await response.json()

      expect(data.code).toBe(0)
      expect(data.data.logs).toHaveLength(2)
      expect(data.data.pagination.total).toBe(2)
    })

    it('should filter by point log type', async () => {
      const { prisma } = require('@/lib/prisma')
      ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

      prisma.pointLog.findMany.mockResolvedValue([])
      prisma.pointLog.count.mockResolvedValue(0)

      const request = new Request('http://localhost:3000/api/points/history?type=TASK_REWARD', {
        headers: { 'Authorization': 'Bearer test-key' },
      })

      await historyGet(request as any)

      expect(prisma.pointLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            agentId: 'agent-1',
            type: 'TASK_REWARD',
          }),
        })
      )
    })

    it('should fail when not authenticated', async () => {
      ;(verifyApiKey as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/points/history')
      const response = await historyGet(request as any)
      const data = await response.json()

      expect(data.code).toBe(401)
    })
  })
})
