---
config:
  test_case_style: "Structured Markdown"
  report_output:
    enabled: true
    path: "/tests/reports/"
    filename_pattern: "{YYYY-MM-DD}_test_execution_report.md"
  execution_behavior:
    trigger: "在生成/更新测试用例后，必须单独输出一份测试报告 Artifact"
---

## 1、Tasks Page 模块

### 1.1 /tasks - 页面初始加载

**测试场景**: 验证 Tasks 页面首次加载的完整性和性能
**前置条件**:
* 数据库中存在任务数据（至少 12 条）
* Dev server 已启动在 `http://localhost:3000`
**测试步骤**:
1. Navigate `{baseUrl}/tasks`
2. WaitForText `Task Board`
3. 验证页面元素完整性：Header、搜索框、状态筛选按钮、任务卡片列表
4. AssertNoConsoleErrors
5. 性能采集：Performance Trace（reload + autoStop）
**预期结果**:
* 页面标题 "Task Board" 可见
* 搜索输入框 placeholder 为 "Search tasks..."
* 状态筛选按钮包含：All, Open, Claimed, Executing, Review, Done
* 任务卡片数量不超过 12 张（分页 limit = 12）
* LCP ≤ 2500ms
* CLS ≤ 0.1

---

### 1.2 /tasks - 搜索交互性能

**测试场景**: 验证搜索输入后的响应速度（客户端路由 + RSC 重渲染）
**前置条件**:
* 页面已加载在 `/tasks`
* 数据库中存在可被搜索到的任务
**测试步骤**:
1. Navigate `{baseUrl}/tasks`
2. WaitForText `Task Board`
3. 记录交互开始时间
4. Fill 搜索框 = "API"
5. 等待 URL 变更为包含 `search=API`
6. WaitForText `ALL TASKS` (页面内容更新完成)
7. 记录交互结束时间
8. AssertNoConsoleErrors
9. AssertNetwork `GET /tasks?search=API&_rsc=*` status 200
**预期结果**:
* URL 更新为 `/tasks?search=API`
* 搜索结果正确展示或显示 "No tasks found"
* 状态筛选链接包含 `search=API` 参数
* 交互总时间（输入到页面更新）≤ 3000ms（含 300ms debounce）
* INP ≤ 200ms

---

### 1.3 /tasks - 状态筛选交互性能

**测试场景**: 验证点击状态筛选按钮后的响应速度
**前置条件**:
* 页面已加载在 `/tasks`
**测试步骤**:
1. Navigate `{baseUrl}/tasks`
2. WaitForText `Task Board`
3. 记录交互开始时间
4. Click 状态筛选按钮 "Open"
5. WaitForText `OPEN TASKS` 或 URL 变更为包含 `status=PENDING`
6. 记录交互结束时间
7. AssertNoConsoleErrors
8. AssertNetwork 相应请求 status 200
**预期结果**:
* URL 更新为 `/tasks?status=PENDING`
* 仅显示状态为 OPEN 的任务
* "Open" 按钮高亮为激活态
* 交互总时间 ≤ 3000ms
* INP ≤ 200ms

---

### 1.4 /tasks - 分页导航性能

**测试场景**: 验证分页切换的响应速度
**前置条件**:
* 页面已加载在 `/tasks`
* 总任务数 > 12（即存在多页）
**测试步骤**:
1. Navigate `{baseUrl}/tasks`
2. WaitForText `Task Board`
3. 确认分页按钮存在（"Next" 或页码 "2"）
4. 记录交互开始时间
5. Click 页码 "2" 或 "Next"
6. WaitForText URL 变更为包含 `page=2`
7. 记录交互结束时间
8. AssertNoConsoleErrors
**预期结果**:
* URL 更新为 `/tasks?page=2`
* 页面展示第二页的任务
* 分页按钮正确高亮当前页
* 交互总时间 ≤ 3000ms

---

### 1.5 /tasks - 搜索与筛选组合

**测试场景**: 验证搜索 + 状态筛选组合使用时的正确性
**前置条件**:
* 页面已加载在 `/tasks`
**测试步骤**:
1. Navigate `{baseUrl}/tasks`
2. WaitForText `Task Board`
3. Fill 搜索框 = "analysis"
4. 等待搜索结果加载
5. Click 状态筛选 "Executing"
6. 等待页面更新
7. AssertNoConsoleErrors
**预期结果**:
* URL 包含 `status=EXECUTING` 和 `search=analysis`
* 仅显示状态为 EXECUTING 且标题/描述包含 "analysis" 的任务
* 搜索框保持 "analysis" 值
