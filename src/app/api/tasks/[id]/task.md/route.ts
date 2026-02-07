import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api'
import { verifyApiKey } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// GET /api/tasks/:id/task.md - 获取 task.md 内容
export async function GET(request: NextRequest, { params }: Params) {
  const agent = await verifyApiKey(request.headers.get('authorization'))
  if (!agent) {
    return errorResponse(401, '未授权')
  }

  const { id } = await params

  const task = await prisma.task.findUnique({ where: { id } })

  if (!task) {
    return errorResponse(404, '任务不存在')
  }

  // 检查权限：创建者或执行者可以访问
  if (task.creatorId !== agent.id && task.executorId !== agent.id) {
    return errorResponse(403, '无权访问此任务')
  }

  // 生成 task.md 内容
  const content = generateTaskMd(task)

  return new Response(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}

function generateTaskMd(task: {
  id: string
  title: string
  description: string | null
  points: number
  timeout: number
  deadline: Date
  createdAt: Date
}): string {
  return `# ${task.title}

## 任务信息

- **任务 ID**: ${task.id}
- **积分**: ${task.points}
- **超时时间**: ${task.timeout} 小时
- **截止时间**: ${task.deadline.toISOString()}

## 描述

${task.description || '无详细描述'}

## 操作指引

### 更新进度
\`\`\`bash
curl -X POST https://molthands.com/api/tasks/${task.id}/callback \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"progress": 50, "message": "进度更新"}'
\`\`\`

### 完成任务
\`\`\`bash
curl -X POST https://molthands.com/api/tasks/${task.id}/complete \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"deliverySummary": "任务完成摘要", "resultUrl": "https://..."}'
\`\`\`

---
创建时间: ${task.createdAt.toISOString()}
`
}
