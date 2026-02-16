/**
 * API 测试 - Comment Voting
 * 测试评论投票功能（点赞/点踩）
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    taskComment: {
      findUnique: jest.fn(),
    },
    taskCommentVote: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  verifyApiKey: jest.fn(),
}))

import { verifyApiKey } from '@/lib/auth'
import { POST as votePost } from '@/app/api/comments/[id]/vote/route'

const createParams = (id: string) => ({ params: Promise.resolve({ id }) })

describe('Comment Vote API', () => {
  const mockAgent = {
    id: 'agent-1',
    name: 'TestAgent',
    points: 100,
    frozenPoints: 0,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create an UP vote', async () => {
    const { prisma } = require('@/lib/prisma')
    ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

    prisma.taskComment.findUnique.mockResolvedValue({ id: 'comment-1', agentId: 'agent-2' })
    prisma.taskCommentVote.findUnique.mockResolvedValue(null)
    prisma.taskCommentVote.create.mockResolvedValue({})
    prisma.taskCommentVote.groupBy.mockResolvedValue([{ vote: 'UP', _count: 1 }])

    const request = new Request('http://localhost:3000/api/comments/comment-1/vote', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({ vote: 'UP' }),
    })

    const response = await votePost(request as any, createParams('comment-1'))
    const data = await response.json()

    expect(data.code).toBe(0)
    expect(data.data.vote).toBe('UP')
    expect(data.data.upVotes).toBe(1)
    expect(data.data.score).toBe(1)
  })

  it('should create a DOWN vote', async () => {
    const { prisma } = require('@/lib/prisma')
    ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

    prisma.taskComment.findUnique.mockResolvedValue({ id: 'comment-1', agentId: 'agent-2' })
    prisma.taskCommentVote.findUnique.mockResolvedValue(null)
    prisma.taskCommentVote.create.mockResolvedValue({})
    prisma.taskCommentVote.groupBy.mockResolvedValue([{ vote: 'DOWN', _count: 1 }])

    const request = new Request('http://localhost:3000/api/comments/comment-1/vote', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({ vote: 'DOWN' }),
    })

    const response = await votePost(request as any, createParams('comment-1'))
    const data = await response.json()

    expect(data.data.vote).toBe('DOWN')
    expect(data.data.downVotes).toBe(1)
  })

  it('should update an existing vote', async () => {
    const { prisma } = require('@/lib/prisma')
    ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

    prisma.taskComment.findUnique.mockResolvedValue({ id: 'comment-1', agentId: 'agent-2' })
    prisma.taskCommentVote.findUnique.mockResolvedValue({ id: 'vote-1', vote: 'UP' })
    prisma.taskCommentVote.update.mockResolvedValue({})
    prisma.taskCommentVote.groupBy.mockResolvedValue([{ vote: 'DOWN', _count: 1 }])

    const request = new Request('http://localhost:3000/api/comments/comment-1/vote', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({ vote: 'DOWN' }),
    })

    const response = await votePost(request as any, createParams('comment-1'))
    const data = await response.json()

    expect(data.code).toBe(0)
    expect(prisma.taskCommentVote.update).toHaveBeenCalled()
  })

  it('should prevent self-voting', async () => {
    const { prisma } = require('@/lib/prisma')
    ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

    prisma.taskComment.findUnique.mockResolvedValue({ id: 'comment-1', agentId: 'agent-1' })

    const request = new Request('http://localhost:3000/api/comments/comment-1/vote', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({ vote: 'UP' }),
    })

    const response = await votePost(request as any, createParams('comment-1'))
    const data = await response.json()

    expect(data.code).toBe(400)
    expect(data.message).toContain('不能给自己')
  })

  it('should fail with invalid vote type', async () => {
    ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

    const request = new Request('http://localhost:3000/api/comments/comment-1/vote', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({ vote: 'INVALID' }),
    })

    const response = await votePost(request as any, createParams('comment-1'))
    const data = await response.json()

    expect(data.code).toBe(400)
    expect(data.message).toContain('投票类型无效')
  })

  it('should fail when comment not found', async () => {
    const { prisma } = require('@/lib/prisma')
    ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

    prisma.taskComment.findUnique.mockResolvedValue(null)

    const request = new Request('http://localhost:3000/api/comments/nonexistent/vote', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({ vote: 'UP' }),
    })

    const response = await votePost(request as any, createParams('nonexistent'))
    const data = await response.json()

    expect(data.code).toBe(404)
  })

  it('should fail when not authenticated', async () => {
    ;(verifyApiKey as jest.Mock).mockResolvedValue(null)

    const request = new Request('http://localhost:3000/api/comments/comment-1/vote', {
      method: 'POST',
      body: JSON.stringify({ vote: 'UP' }),
    })

    const response = await votePost(request as any, createParams('comment-1'))
    const data = await response.json()

    expect(data.code).toBe(401)
  })

  it('should allow NONE vote to remove vote', async () => {
    const { prisma } = require('@/lib/prisma')
    ;(verifyApiKey as jest.Mock).mockResolvedValue(mockAgent)

    prisma.taskComment.findUnique.mockResolvedValue({ id: 'comment-1', agentId: 'agent-2' })
    prisma.taskCommentVote.findUnique.mockResolvedValue({ id: 'vote-1', vote: 'UP' })
    prisma.taskCommentVote.update.mockResolvedValue({})
    prisma.taskCommentVote.groupBy.mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/comments/comment-1/vote', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({ vote: 'NONE' }),
    })

    const response = await votePost(request as any, createParams('comment-1'))
    const data = await response.json()

    expect(data.code).toBe(0)
    expect(data.data.vote).toBe('NONE')
    expect(data.data.score).toBe(0)
  })
})
