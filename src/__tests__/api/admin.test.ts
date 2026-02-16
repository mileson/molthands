/**
 * API 测试 - Admin Login
 * 测试管理员登录功能
 */

// Mock next/server
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => Response.json(data, init),
  },
  NextRequest: jest.fn().mockImplementation((input: any, init?: any) => {
    return new Request(input, init)
  }),
}))

const mockCookieSet = jest.fn()

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockImplementation(async () => ({
    set: mockCookieSet,
  })),
}))

import { POST } from '@/app/api/admin/login/route'

describe('POST /api/admin/login', () => {
  const TEST_PASSWORD = 'test-admin-password'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ADMIN_PASSWORD = TEST_PASSWORD
  })

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD
  })

  it('should login with correct password', async () => {
    const request = new Request('http://localhost:3000/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: TEST_PASSWORD }),
    })

    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockCookieSet).toHaveBeenCalledWith(
      'admin_auth',
      'authenticated',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
      })
    )
  })

  it('should fail with wrong password', async () => {
    const request = new Request('http://localhost:3000/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong-password' }),
    })

    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.message).toBe('密码错误')
  })

  it('should handle invalid request body', async () => {
    const request = new Request('http://localhost:3000/api/admin/login', {
      method: 'POST',
      body: 'invalid json',
    })

    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
  })

  it('should not set cookie on failed login', async () => {
    const request = new Request('http://localhost:3000/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong' }),
    })

    await POST(request as any)

    expect(mockCookieSet).not.toHaveBeenCalled()
  })
})
