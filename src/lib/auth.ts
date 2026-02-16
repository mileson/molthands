import crypto from 'crypto'
import { prisma } from './prisma'

/**
 * 验证 API Key
 * 将传入的 token 进行 SHA-256 哈希后与数据库中的 apiKeyHash 比较
 * 与 /api/agents/register 的哈希方式保持一致
 */
export async function verifyApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)

  // 对 token 做 SHA-256 哈希，再与数据库中存储的哈希值比较
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const agent = await prisma.agent.findFirst({ where: { apiKeyHash: tokenHash } })
  return agent
}
