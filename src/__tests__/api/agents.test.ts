/**
 * API 测试 - Agents
 * 测试 Agent 注册、查询、排行榜等功能
 */

import { POST as registerPost } from '@/app/api/agents/register/route'
import { GET as agentsGet } from '@/app/api/agents/route'
import { GET as leaderboardGet } from '@/app/api/agents/leaderboard/route'

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    agent: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    pointLog: {
      create: jest.fn(),
    },
  },
}))

// Mock auth
jest.mock('@/lib/auth', () => ({
  verifyApiKey: jest.fn(),
}))

describe('/api/agents/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should register a new agent successfully', async () => {
    const mockAgent = {
      id: 'test-id',
      name: 'TestAgent',
      description: 'Test description',
      tags: ['test'],
      claimToken: 'test-token',
      verificationCode: 'ABC123',
      points: 10,
    }

    const { prisma } = require('@/lib/prisma')
    prisma.agent.findUnique.mockResolvedValue(null)
    prisma.agent.create.mockResolvedValue(mockAgent)
    prisma.pointLog.create.mockResolvedValue({})

    const request = new Request('http://localhost:3000/api/agents/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'TestAgent',
        description: 'Test description',
        tags: ['test'],
      }),
    })

    const response = await registerPost(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.code).toBe(0)
    expect(data.data.name).toBe('TestAgent')
    expect(data.data.apiKey).toBeDefined()
    expect(data.data.apiKey).toMatch(/^mh_/)
    expect(data.data.claimUrl).toBeDefined()
    expect(data.message).toBe('注册成功')
  })

  it('should fail when name is missing', async () => {
    const request = new Request('http://localhost:3000/api/agents/register', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await registerPost(request as any)
    const data = await response.json()

    expect(data.code).toBe(400)
    expect(data.message).toBe('名称不能为空')
  })

  it('should fail when name already exists', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.findUnique.mockResolvedValue({ id: 'existing-id', name: 'ExistingAgent' })

    const request = new Request('http://localhost:3000/api/agents/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'ExistingAgent' }),
    })

    const response = await registerPost(request as any)
    const data = await response.json()

    expect(data.code).toBe(409)
    expect(data.message).toBe('该名称已被使用')
  })

  it('should generate API key with mh_ prefix', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.findUnique.mockResolvedValue(null)
    prisma.agent.create.mockResolvedValue({
      id: 'test-id',
      name: 'NewAgent',
      claimToken: 'token',
      verificationCode: 'CODE',
    })
    prisma.pointLog.create.mockResolvedValue({})

    const request = new Request('http://localhost:3000/api/agents/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'NewAgent' }),
    })

    const response = await registerPost(request as any)
    const data = await response.json()

    expect(data.data.apiKey).toMatch(/^mh_/)
    // Verify prisma.agent.create was called with a hashed API key
    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          apiKeyHash: expect.any(String),
        }),
      })
    )
  })

  it('should create initial point log with 10 points', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.findUnique.mockResolvedValue(null)
    prisma.agent.create.mockResolvedValue({
      id: 'new-agent-id',
      name: 'Agent',
      claimToken: 'token',
      verificationCode: 'CODE',
    })
    prisma.pointLog.create.mockResolvedValue({})

    const request = new Request('http://localhost:3000/api/agents/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Agent' }),
    })

    await registerPost(request as any)

    expect(prisma.pointLog.create).toHaveBeenCalledWith({
      data: {
        agentId: 'new-agent-id',
        amount: 10,
        type: 'INIT',
        balance: 10,
      },
    })
  })
})

describe('/api/agents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return agents list with pagination', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.findMany.mockResolvedValue([])
    prisma.agent.count.mockResolvedValue(0)

    const request = new Request('http://localhost:3000/api/agents?page=1&limit=20')
    const response = await agentsGet(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.code).toBe(0)
    expect(data.data.pagination).toBeDefined()
    expect(data.data.pagination.page).toBe(1)
  })

  it('should filter agents by status', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.findMany.mockResolvedValue([])
    prisma.agent.count.mockResolvedValue(0)

    const request = new Request('http://localhost:3000/api/agents?status=CLAIMED')
    const response = await agentsGet(request as any)

    expect(response.status).toBe(200)
    expect(prisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CLAIMED',
        }),
      })
    )
  })
})

describe('/api/agents/leaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return leaderboard sorted by points', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.findMany.mockResolvedValue([
      {
        id: '1',
        name: 'TopAgent',
        points: 100,
        successRate: 95.5,
        totalTasks: 10,
        successTasks: 9,
        ownerXHandle: 'topuser',
      },
      {
        id: '2',
        name: 'SecondAgent',
        points: 80,
        successRate: 90.0,
        totalTasks: 8,
        successTasks: 7,
        ownerXHandle: 'seconduser',
      },
    ])

    const request = new Request('http://localhost:3000/api/agents/leaderboard?limit=10')
    const response = await leaderboardGet(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.code).toBe(0)
    expect(data.data.leaderboard).toBeDefined()
    expect(data.data.leaderboard).toHaveLength(2)
    expect(data.data.leaderboard[0].name).toBe('TopAgent')
  })

  it('should respect limit parameter', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.findMany.mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/agents/leaderboard?limit=5')
    const response = await leaderboardGet(request as any)

    expect(prisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      })
    )
  })
})
