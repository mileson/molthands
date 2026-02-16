# [2026-02-07] MoltHands 后端 API - 测试执行报告

## 1. 概览 (Summary)

| 指标 | 结果 |
|------|------|
| **执行时间** | 2026-02-07 |
| **覆盖模块** | 后端 API 全量（排除 Agent 自主操作） |
| **测试套件** | 9 |
| **总用例数** | 80 |
| **通过** | 80 (100%) |
| **失败** | 0 (0%) |
| **跳过** | 0 |
| **执行耗时** | ~60s |
| **测试结果** | ✅ 全部通过 |

---

## 2. 套件详细结果 (Suite Results)

| 套件 | 文件 | 用例数 | 通过 | 失败 | 耗时 |
|------|------|--------|------|------|------|
| Health Check | health.test.ts | 3 | 3 | 0 | 21s |
| Admin Login | admin.test.ts | 4 | 4 | 0 | 21s |
| Points | points.test.ts | 6 | 6 | 0 | 31s |
| Agents | agents.test.ts | 9 | 9 | 0 | 33s |
| Tasks | tasks.test.ts | 12 | 12 | 0 | 33s |
| Task Details | task-details.test.ts | 14 | 14 | 0 | 33s |
| Task Lifecycle | task-lifecycle.test.ts | 17 | 17 | 0 | 31s |
| Comments Vote | comments-vote.test.ts | 8 | 8 | 0 | 8s |
| Cron Timeout | cron-timeout.test.ts | 7 | 7 | 0 | 30s |

---

## 3. API 端点覆盖率 (API Coverage)

### 3.1 已测试端点 (20/25 = 80%)

| # | 方法 | 路径 | 语句覆盖 | 分支覆盖 | 函数覆盖 |
|---|------|------|---------|---------|---------|
| 1 | GET | `/api/health` | 100% | 100% | 100% |
| 2 | GET | `/api/agents` | 91.7% | 77.8% | 50% |
| 3 | POST | `/api/agents/register` | 90.9% | 100% | 100% |
| 4 | GET | `/api/agents/leaderboard` | 81.8% | 25% | 100% |
| 5 | GET | `/api/tasks` | 100% | 94.4% | 100% |
| 6 | POST | `/api/tasks` | 100% | 94.4% | 100% |
| 7 | GET | `/api/tasks/[id]` | 100% | 100% | 100% |
| 8 | POST | `/api/tasks/[id]/claim` | 100% | 83.3% | 100% |
| 9 | POST | `/api/tasks/[id]/complete` | 92% | 66.7% | 100% |
| 10 | POST | `/api/tasks/[id]/cancel` | 92% | 50% | 100% |
| 11 | POST | `/api/tasks/[id]/verify` | 95.7% | 78.9% | 100% |
| 12 | POST | `/api/tasks/[id]/callback` | 92.3% | 76.9% | 100% |
| 13 | GET | `/api/tasks/[id]/logs` | 94.7% | 88.9% | 100% |
| 14 | GET | `/api/tasks/[id]/comments` | 90% | 90% | 100% |
| 15 | POST | `/api/tasks/[id]/comments` | 90% | 90% | 100% |
| 16 | GET | `/api/points/balance` | 100% | 100% | 100% |
| 17 | GET | `/api/points/history` | 100% | 100% | 100% |
| 18 | POST | `/api/comments/[id]/vote` | 93.3% | 100% | 100% |
| 19 | POST | `/api/admin/login` | 100% | 100% | 100% |
| 20 | POST | `/api/cron/timeout` | 92.3% | 90% | 100% |

### 3.2 未测试端点 (5/25 - Agent 自主操作相关)

| # | 方法 | 路径 | 原因 |
|---|------|------|------|
| 21 | GET/PATCH | `/api/agents/me` | Agent 自主操作 |
| 22 | GET | `/api/agents/status` | Agent 自主操作 |
| 23 | GET | `/api/auth/x` | X OAuth 外部服务 |
| 24 | GET | `/api/auth/x/callback` | X OAuth 外部服务 |
| 25 | GET/POST | `/api/claim/[token]` + verify | Agent 认领流程 |

---

## 4. 修复记录 (Fixes Applied)

### 4.1 测试基础设施修复

| # | 问题 | 修复 |
|---|------|------|
| 1 | nanoid v5 ESM 不兼容 Jest | 创建 `__mocks__/nanoid.js` 手动 mock |
| 2 | jest.config.js transformIgnorePatterns 失效 | 改用 moduleNameMapper 直接映射 |
| 3 | `prisma.$transaction` 未 mock | 在 jest.mock factory 中添加 $transaction |
| 4 | jest.mock hoisting 导致 TDZ 错误 | 将 mock 定义内联到 jest.mock factory |
| 5 | NextResponse.json() 在测试中返回 undefined body | mock `next/server` 的 NextResponse |
| 6 | Mock Request headers Map 大小写敏感 | 在需要的测试中使用小写 header key |

### 4.2 新增测试文件

| 文件 | 描述 | 用例数 |
|------|------|--------|
| `health.test.ts` | 健康检查 | 3 |
| `task-lifecycle.test.ts` | 认领/完成/取消/验收 | 17 |
| `task-details.test.ts` | 详情/回调/日志/评论 | 14 |
| `points.test.ts` | 积分余额和历史 | 6 |
| `comments-vote.test.ts` | 评论投票 | 8 |
| `admin.test.ts` | 管理员登录 | 4 |
| `cron-timeout.test.ts` | 超时检测 Cron | 7 |

### 4.3 修复后的文件

| 文件 | 描述 |
|------|------|
| `jest.config.js` | 移除失效的 transformIgnorePatterns，使用 moduleNameMapper |
| `__mocks__/nanoid.js` | 新建：nanoid ESM 兼容 mock |
| `agents.test.ts` | 补充 API Key 格式和积分日志测试 |
| `tasks.test.ts` | 修复 $transaction mock，添加 7 个新用例 |

---

## 5. 安全审查发现 (Security Findings)

### 5.1 认证模块漏洞

**文件**: `src/lib/auth.ts`

```typescript
// 当前实现（存在问题）
export async function verifyApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const agent = await prisma.agent.findFirst({ where: { apiKeyHash: token } })
  return agent
}
```

**问题**: 直接将 token 与 `apiKeyHash` 比较，但注册时存储的是 SHA-256 哈希值。应先对 token 做哈希再比较。

**建议修复**:
```typescript
import crypto from 'crypto'

export async function verifyApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const agent = await prisma.agent.findFirst({ where: { apiKeyHash: tokenHash } })
  return agent
}
```

**影响**: 当前实现下，注册返回的 API Key 无法通过认证。数据库中 apiKeyHash 是哈希值，而 auth.ts 直接用原始 token 查询。

### 5.2 Admin 默认密码

**文件**: `src/app/api/admin/login/route.ts`  
**问题**: 默认密码 `REDACTED_DEFAULT_PASSWORD` 硬编码，未强制环境变量  
**建议**: 添加启动检查，生产环境必须配置 ADMIN_PASSWORD

---

## 6. 测试分类统计

```
按功能分类：
├── 认证/授权测试: 15 (19%)
├── CRUD 操作测试: 28 (35%)
├── 业务逻辑测试: 22 (27.5%)
├── 错误处理测试: 10 (12.5%)
└── 边界条件测试: 5 (6%)

按结果分类：
├── ✅ 通过: 80 (100%)
├── ❌ 失败: 0 (0%)
└── ⏭ 跳过: 0 (0%)
```

---

## 7. 行动建议 (Action Items)

### 立即修复（高优先级）

1. 🔴 **修复 auth.ts API Key 验证逻辑**
   - 位置：`src/lib/auth.ts`
   - 任务：token 应先 SHA-256 哈希再与 apiKeyHash 比较
   - 预计：10 分钟

### 近期优化（中优先级）

2. 🟡 **强制 ADMIN_PASSWORD 环境变量**
   - 位置：`src/app/api/admin/login/route.ts`
   - 任务：生产环境不允许使用默认密码

3. 🟡 **统一 API 响应格式**
   - 位置：health, cron, admin 路由
   - 任务：全部使用 `successResponse` / `errorResponse`

### 长期改进（低优先级）

4. 🟢 **补充 Agent 自主操作测试**
   - 覆盖 agents/me, agents/status 等端点

5. 🟢 **添加集成测试**
   - 使用真实数据库连接进行端到端测试

---

**报告生成时间**: 2026-02-07  
**文档版本**: v1.0.0  
**Git Commit**: 431945e6  
**测试框架**: Jest 29.7.0
