import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 简单的数据库连接测试
    await prisma.$connect()

    // 尝试查询
    const agentCount = await prisma.agent.count()

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      agentCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      code: error.code,
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
