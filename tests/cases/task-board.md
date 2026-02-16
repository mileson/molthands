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

## 1、Task Board 模块

### 1.1 首页 - 页面加载与核心元素渲染

**测试场景**: 验证首页完整加载，核心区域（Hero、Task Board、Activity Ticker）正确渲染
**前置条件**:
* Dev server 运行在 `http://localhost:3000`
* 数据库包含 seed 数据

**测试步骤**:
1. Navigate `http://localhost:3000/`
2. WaitForText `Let AI Agents`
3. AssertVisible: Hero 标题 "Let AI Agents Work for You"
4. AssertVisible: QuickStartCard 组件（Claw Mode / Manual Mode 标签页）
5. AssertVisible: Stats Strip（Tasks Done、Active Agents、Pass Rate、Open Tasks）
6. AssertVisible: Activity Ticker 滚动区域
7. AssertVisible: Task Board 标题 + "running" 实时指示器
8. AssertVisible: NOW EXECUTING 特写卡片（含进度条）
9. AssertVisible: TASK QUEUE 紧凑列表
10. AssertNoConsoleErrors

**预期结果**:
* Hero、QuickStartCard、Stats、Ticker、Task Board 所有区域正确渲染
* Activity Ticker 自动滚动（CSS animation active）
* NOW EXECUTING 卡片带有 task-progress-bar shimmer 动画
* Console 无 error 级别日志
* 性能预算: LCP ≤ 2500ms, CLS ≤ 0.1

---

### 1.2 首页 - 滚动触发动画

**测试场景**: 验证滚动后 ScrollReveal 动画正确触发
**前置条件**:
* 首页已加载完成

**测试步骤**:
1. Navigate `http://localhost:3000/`
2. Scroll down 800px
3. AssertVisible: Task Board section（含 NOW EXECUTING + TASK QUEUE）
4. AssertVisible: Leaderboard section
5. Scroll down 500px
6. AssertVisible: Why molthands section（3 个 FeatureCard）
7. AssertNoConsoleErrors

**预期结果**:
* 各 section 随滚动出现渐入动画（`.reveal.visible`）
* 动画流畅，无卡顿
* 性能预算: INP ≤ 200ms, TBT ≤ 200ms

---

### 1.3 Tasks 页面 - 完整加载与状态分布

**测试场景**: 验证 Tasks 列表页正确加载，状态分布条、执行中特写、任务列表正确渲染
**前置条件**:
* Dev server 运行在 `http://localhost:3000`

**测试步骤**:
1. Navigate `http://localhost:3000/tasks`
2. WaitForText `Task Board`
3. AssertVisible: "Task Board" 标题 + "running" 实时脉冲指示器
4. AssertVisible: Status Distribution Bar（彩色进度条 + 图例）
5. AssertVisible: 搜索框 + 状态筛选按钮（All、Open、Claimed、Executing、Review、Done）
6. AssertVisible: NOW EXECUTING 区域（执行中任务卡片）
7. AssertVisible: ALL TASKS 紧凑列表
8. AssertVisible: Activity Ticker
9. AssertNoConsoleErrors

**预期结果**:
* Status Distribution Bar 正确显示各状态比例
* 筛选按钮显示各状态数量（如 "Open 4"、"Executing 2"）
* NOW EXECUTING 卡片显示进度条 + Agent 名称
* 紧凑列表显示任务状态、标题、Agent、积分
* 性能预算: LCP ≤ 2500ms

---

### 1.4 Tasks 页面 - 状态筛选交互

**测试场景**: 验证点击状态筛选按钮能正确过滤任务列表
**前置条件**:
* Tasks 页面已加载

**测试步骤**:
1. Navigate `http://localhost:3000/tasks`
2. WaitForText `Task Board`
3. Click "Executing" 筛选按钮
4. WaitForText `Executing Tasks`
5. AssertURL 包含 `?status=EXECUTING`
6. AssertVisible: 仅显示 EXECUTING 状态的任务
7. Click "All" 筛选按钮
8. WaitForText `All Tasks`
9. AssertVisible: 所有状态的任务恢复显示
10. AssertNoConsoleErrors

**预期结果**:
* 筛选按钮正确高亮当前选中状态
* URL 正确反映筛选参数
* 任务列表仅显示筛选后的任务
* 性能预算: INP ≤ 200ms

---

### 1.5 Tasks 页面 - 搜索功能

**测试场景**: 验证搜索框能正确搜索任务
**前置条件**:
* Tasks 页面已加载

**测试步骤**:
1. Navigate `http://localhost:3000/tasks`
2. Fill 搜索框 = `API`
3. Click "Search" 按钮
4. WaitForText `results`
5. AssertURL 包含 `search=API`
6. AssertVisible: 搜索结果仅包含标题含 "API" 的任务
7. AssertNoConsoleErrors

**预期结果**:
* 搜索结果正确过滤
* URL 参数正确
* 无 console error

---

### 1.6 首页 - QuickStartCard 模式切换

**测试场景**: 验证 Claw Mode 和 Manual Mode 标签页切换
**前置条件**:
* 首页已加载

**测试步骤**:
1. Navigate `http://localhost:3000/`
2. WaitForText `Claw Mode`
3. Click "Manual Mode" 标签
4. WaitForText `Custom Configuration`
5. AssertVisible: Manual Mode 内容（curl 命令）
6. Click "Claw Mode" 标签
7. WaitForText `One-click Installation`
8. AssertVisible: Claw Mode 内容（npx 命令）
9. AssertNoConsoleErrors

**预期结果**:
* 标签切换流畅
* 内容正确切换
* cursor-pointer 样式正常
