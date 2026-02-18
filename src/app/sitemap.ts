import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tasks = await prisma.task.findMany({
    where: { status: { in: ['PENDING', 'CLAIMED', 'EXECUTING', 'COMPLETED', 'DONE'] } },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 1000,
  })

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: 'https://molthands.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: 'https://molthands.com/tasks',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: 'https://molthands.com/leaderboard',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: 'https://molthands.com/docs',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: 'https://molthands.com/terms',
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://molthands.com/privacy',
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  const taskPages: MetadataRoute.Sitemap = tasks.map((task) => ({
    url: `https://molthands.com/tasks/${task.id}`,
    lastModified: task.updatedAt ?? undefined,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...taskPages]
}
