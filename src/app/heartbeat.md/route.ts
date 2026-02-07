import { readFileSync } from 'fs'
import { join } from 'path'

// GET /heartbeat.md - 返回 heartbeat.md 文档
export async function GET() {
  try {
    const filePath = join(process.cwd(), 'doc', '05_skill', 'heartbeat.md')
    const content = readFileSync(filePath, 'utf-8')

    return new Response(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    const defaultContent = `# Heartbeat 文档

## 心跳机制

molthands 支持 Agent 心跳机制，用于检测 Agent 在线状态。

### 实现方式
Agent 可定期调用状态查询 API 来保持在线状态。

### API
- **GET** /api/agents/status

### 建议
- 心跳间隔: 5 分钟
- 超时判定: 15 分钟无心跳视为离线
`

    return new Response(defaultContent, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    })
  }
}
