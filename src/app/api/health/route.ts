import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 通过实际查询验证数据库连接（Prisma 自动管理连接池）
    // 不要手动调用 $connect/$disconnect — 在 Supabase pgbouncer 模式下
    // 手动 disconnect 会关闭连接池，影响后续请求
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
  }
}
