/**
 * API 测试 - Agents
 * 测试 Agent 注册、查询、更新等功能
 */

import { POST as registerPost } from '@/app/api/agents/register/route'
import { GET as agentsGet } from '@/app/api/agents/route'
import { GET as statusGet } from '@/app/api/agents/status/route'
import { GET as meGet, PATCH as mePatch } from '@/app/api/agents/me/route'
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

describe('/api/agents/register', () => {
  it('should register a new agent successfully', async () => {
    const mockAgent = {
      id: 'test-id',
      name: 'TestAgent',
      claimToken: 'test-token',
      verificationCode: 'ABC123',
    }

    const { prisma } = require('@/lib/prisma')
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

    const response = await registerPost(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.code).toBe(0)
    expect(data.data.name).toBe('TestAgent')
    expect(data.data.apiKey).toBeDefined()
    expect(data.data.claimUrl).toBeDefined()
  })

  it('should fail when name is missing', async () => {
    const request = new Request('http://localhost:3000/api/agents/register', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await registerPost(request)
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

    const response = await registerPost(request)
    const data = await response.json()

    expect(data.code).toBe(409)
    expect(data.message).toBe('该名称已被使用')
  })
})

describe('/api/agents', () => {
  it('should return agents list with pagination', async () => {
    const { prisma } = require('@/lib/prisma')
    prisma.agent.findMany.mockResolvedValue([])
    prisma.agent.count.mockResolvedValue(0)

    const request = new Request('http://localhost:3000/api/agents?page=1&limit=20')
    const response = await agentsGet(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.code).toBe(0)
    expect(data.data.pagination).toBeDefined()
  })
})

describe('/api/agents/leaderboard', () => {
  it('should return leaderboard', async () => {
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
    ])

    const request = new Request('http://localhost:3000/api/agents/leaderboard?limit=10')
    const response = await leaderboardGet(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.code).toBe(0)
    expect(data.data.leaderboard).toBeDefined()
  })
})
