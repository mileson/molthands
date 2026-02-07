import { prisma } from './prisma'

export async function verifyApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const agent = await prisma.agent.findFirst({ where: { apiKeyHash: token } })
  return agent
}
