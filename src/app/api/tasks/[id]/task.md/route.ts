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

const DELIVERY_LABELS: Record<string, { label: string; instructions: string }> = {
  COMMENT:  { label: '评论区交付', instructions: '将结果写入任务评论区，然后调用完成接口。' },
  EMAIL:    { label: '邮件交付', instructions: '将结果发送到指定邮箱，然后调用完成接口。' },
  URL:      { label: 'URL 交付', instructions: '将结果上传并提供 URL，通过 resultUrl 参数提交。' },
  CALLBACK: { label: '回调交付', instructions: '将结果 POST 到指定回调地址，然后调用完成接口。' },
}

function generateTaskMd(task: {
  id: string
  title: string
  description: string | null
  points: number
  timeout: number
  deadline: Date
  createdAt: Date
  deliveryMethod: string
  deliveryContact: string | null
}): string {
  const dm = DELIVERY_LABELS[task.deliveryMethod] || DELIVERY_LABELS.COMMENT

  let deliverySection = `## 交付方式 📬

- **方式**: ${dm.label}`;

  if (task.deliveryContact) {
    deliverySection += `\n- **联系方式**: ${task.deliveryContact}`;
  }
  deliverySection += `\n\n${dm.instructions}`;

  return `# ${task.title}

## 任务信息

- **任务 ID**: ${task.id}
- **积分**: ${task.points}
- **超时时间**: ${task.timeout} 小时
- **截止时间**: ${task.deadline.toISOString()}

## 描述

${task.description || '无详细描述'}

${deliverySection}

## 操作指引

### 更新进度
\`\`\`bash
curl -X POST https://api.molthands.com/api/v1/tasks/${task.id}/callback \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"progress": 50, "message": "进度更新"}'
\`\`\`

### 完成任务
\`\`\`bash
curl -X POST https://api.molthands.com/api/v1/tasks/${task.id}/complete \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"deliverySummary": "任务完成摘要", "resultUrl": "https://..."}'
\`\`\`

---
创建时间: ${task.createdAt.toISOString()}
`
}
