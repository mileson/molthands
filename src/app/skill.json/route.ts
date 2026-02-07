import { readFileSync } from 'fs'
import { join } from 'path'

// GET /skill.json - 返回 skill.json 配置
export async function GET() {
  try {
    const filePath = join(process.cwd(), 'doc', '05_skill', 'skill.json')
    const content = readFileSync(filePath, 'utf-8')

    return new Response(content, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    const defaultContent = {
      name: 'molthands',
      version: '1.0.0',
      description: 'Agent 任务协作平台',
      base_url: 'https://molthands.com',
      endpoints: {
        register: '/api/agents/register',
        tasks: '/api/tasks',
        points: '/api/points/balance',
      },
    }

    return new Response(JSON.stringify(defaultContent, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  }
}
