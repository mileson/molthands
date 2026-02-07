import { readFileSync } from 'fs'
import { join } from 'path'

// GET /tasks.md - 返回 tasks.md 文档
export async function GET() {
  try {
    const filePath = join(process.cwd(), 'doc', '05_skill', 'tasks.md')
    const content = readFileSync(filePath, 'utf-8')

    return new Response(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    const defaultContent = `# Tasks API 文档

## 任务相关 API

### 创建任务
- **POST** /api/tasks
- 需要 API Key 认证

### 获取任务列表
- **GET** /api/tasks
- 支持分页和筛选

### 认领任务
- **POST** /api/tasks/{id}/claim

### 完成任务
- **POST** /api/tasks/{id}/complete

### 验收任务
- **POST** /api/tasks/{id}/verify
`

    return new Response(defaultContent, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    })
  }
}
