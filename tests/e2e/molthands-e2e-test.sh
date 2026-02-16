#!/bin/bash
###############################################################################
# Molthands 全面端到端测试脚本
# 测试覆盖：注册→创建任务→接单→进度回调→完成→验收→积分流转
# 执行环境：openclaw 服务器 (root@107.175.190.120)
# 目标：https://molthands.com
###############################################################################

set -euo pipefail

BASE_URL="https://www.molthands.com"
TIMESTAMP=$(date +%s)
REPORT_FILE="/tmp/molthands-e2e-report-${TIMESTAMP}.md"
PASS=0
FAIL=0
TOTAL=0
RESULTS=""

# =========================================================================
# 工具函数
# =========================================================================

log() {
  echo "[$(date '+%H:%M:%S')] $1"
}

assert_eq() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
    RESULTS="${RESULTS}\n| ${TOTAL} | ${test_name} | PASS | expected=${expected}, got=${actual} |"
    log "PASS: ${test_name}"
  else
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}\n| ${TOTAL} | ${test_name} | **FAIL** | expected=${expected}, got=${actual} |"
    log "FAIL: ${test_name} (expected=${expected}, got=${actual})"
  fi
}

assert_not_empty() {
  local test_name="$1"
  local value="$2"
  TOTAL=$((TOTAL + 1))
  if [ -n "$value" ] && [ "$value" != "null" ]; then
    PASS=$((PASS + 1))
    RESULTS="${RESULTS}\n| ${TOTAL} | ${test_name} | PASS | value=${value:0:60} |"
    log "PASS: ${test_name}"
  else
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}\n| ${TOTAL} | ${test_name} | **FAIL** | value is empty or null |"
    log "FAIL: ${test_name}"
  fi
}

assert_gte() {
  local test_name="$1"
  local min="$2"
  local actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$actual" -ge "$min" ] 2>/dev/null; then
    PASS=$((PASS + 1))
    RESULTS="${RESULTS}\n| ${TOTAL} | ${test_name} | PASS | actual=${actual} >= min=${min} |"
    log "PASS: ${test_name}"
  else
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}\n| ${TOTAL} | ${test_name} | **FAIL** | actual=${actual}, min=${min} |"
    log "FAIL: ${test_name}"
  fi
}

api_call() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"
  local token="${4:-}"
  local headers="-H 'Content-Type: application/json'"
  
  if [ -n "$token" ]; then
    headers="${headers} -H 'Authorization: Bearer ${token}'"
  fi
  
  local cmd="curl -sL -X ${method} ${headers} '${BASE_URL}${endpoint}'"
  if [ -n "$data" ]; then
    cmd="${cmd} -d '${data}'"
  fi
  
  eval "$cmd" 2>/dev/null || echo '{"code":-1,"message":"curl failed"}'
}

# =========================================================================
# Phase 0: 环境检查
# =========================================================================
log "===== Phase 0: 环境验证 ====="

HEALTH=$(api_call GET /api/health)
HEALTH_STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
assert_eq "P0.1 Health Check" "ok" "$HEALTH_STATUS"

AGENT_COUNT=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('agentCount',0))" 2>/dev/null)
assert_gte "P0.2 Agent Count >= 1" 1 "$AGENT_COUNT"

# =========================================================================
# Phase 1: 新用户注册
# =========================================================================
log "===== Phase 1: 新用户注册 ====="

CREATOR_NAME="E2E-Creator-${TIMESTAMP}"
EXECUTOR_NAME="E2E-Executor-${TIMESTAMP}"

# 注册 Creator Agent
CREATOR_RESP=$(api_call POST /api/agents/register "{\"name\":\"${CREATOR_NAME}\",\"description\":\"E2E test creator agent\",\"tags\":[\"test\",\"creator\"]}")
CREATOR_CODE=$(echo "$CREATOR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P1.1 Creator 注册成功" "0" "$CREATOR_CODE"

CREATOR_ID=$(echo "$CREATOR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
CREATOR_KEY=$(echo "$CREATOR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('apiKey',''))" 2>/dev/null)
CREATOR_CLAIM_URL=$(echo "$CREATOR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('claimUrl',''))" 2>/dev/null)
CREATOR_VERIFY_CODE=$(echo "$CREATOR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('verificationCode',''))" 2>/dev/null)

assert_not_empty "P1.2 Creator ID" "$CREATOR_ID"
assert_not_empty "P1.3 Creator API Key" "$CREATOR_KEY"
assert_not_empty "P1.4 Creator Claim URL" "$CREATOR_CLAIM_URL"
assert_not_empty "P1.5 Creator Verification Code" "$CREATOR_VERIFY_CODE"

log "Creator registered: id=$CREATOR_ID, key=${CREATOR_KEY:0:20}..."

# 注册 Executor Agent
EXECUTOR_RESP=$(api_call POST /api/agents/register "{\"name\":\"${EXECUTOR_NAME}\",\"description\":\"E2E test executor agent\",\"tags\":[\"test\",\"executor\"]}")
EXECUTOR_CODE=$(echo "$EXECUTOR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P1.6 Executor 注册成功" "0" "$EXECUTOR_CODE"

EXECUTOR_ID=$(echo "$EXECUTOR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
EXECUTOR_KEY=$(echo "$EXECUTOR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('apiKey',''))" 2>/dev/null)

assert_not_empty "P1.7 Executor ID" "$EXECUTOR_ID"
assert_not_empty "P1.8 Executor API Key" "$EXECUTOR_KEY"

log "Executor registered: id=$EXECUTOR_ID, key=${EXECUTOR_KEY:0:20}..."

# 验证重复注册被拒绝
DUP_RESP=$(api_call POST /api/agents/register "{\"name\":\"${CREATOR_NAME}\",\"description\":\"duplicate\"}")
DUP_CODE=$(echo "$DUP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P1.9 重复名称注册被拒绝(409)" "409" "$DUP_CODE"

# =========================================================================
# Phase 2: Agent Profile & 初始积分
# =========================================================================
log "===== Phase 2: Agent Profile & 初始积分 ====="

# 获取 Creator Profile
CREATOR_ME=$(api_call GET /api/agents/me "" "$CREATOR_KEY")
CREATOR_ME_CODE=$(echo "$CREATOR_ME" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P2.1 GET /agents/me 成功" "0" "$CREATOR_ME_CODE"

CREATOR_ME_NAME=$(echo "$CREATOR_ME" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('name',''))" 2>/dev/null)
assert_eq "P2.2 Agent 名称匹配" "$CREATOR_NAME" "$CREATOR_ME_NAME"

# 获取初始积分
CREATOR_BAL=$(api_call GET /api/points/balance "" "$CREATOR_KEY")
CREATOR_POINTS=$(echo "$CREATOR_BAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('points',0))" 2>/dev/null)
CREATOR_FROZEN=$(echo "$CREATOR_BAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('frozenPoints',0))" 2>/dev/null)
CREATOR_AVAILABLE=$(echo "$CREATOR_BAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('availablePoints',0))" 2>/dev/null)
assert_eq "P2.3 初始积分 = 10" "10" "$CREATOR_POINTS"
assert_eq "P2.4 初始冻结积分 = 0" "0" "$CREATOR_FROZEN"
assert_eq "P2.5 初始可用积分 = 10" "10" "$CREATOR_AVAILABLE"

log "Creator initial balance: points=$CREATOR_POINTS, frozen=$CREATOR_FROZEN, available=$CREATOR_AVAILABLE"

# Agent Status
CREATOR_STATUS=$(api_call GET /api/agents/status "" "$CREATOR_KEY")
CREATOR_CLAIMED=$(echo "$CREATOR_STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('isClaimed',''))" 2>/dev/null)
assert_eq "P2.6 新注册 Agent 未认领" "False" "$CREATOR_CLAIMED"

# 更新 Agent Profile
UPDATE_RESP=$(api_call PATCH /api/agents/me "{\"description\":\"Updated by E2E test\"}" "$CREATOR_KEY")
UPDATE_CODE=$(echo "$UPDATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P2.7 更新 Agent Profile" "0" "$UPDATE_CODE"

# 无认证访问 /agents/me 应该失败
NO_AUTH_ME=$(api_call GET /api/agents/me)
NO_AUTH_CODE=$(echo "$NO_AUTH_ME" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P2.8 无认证访问被拒绝 (401)" "401" "$NO_AUTH_CODE"

# =========================================================================
# Phase 3: 创建任务（积分冻结）
# =========================================================================
log "===== Phase 3: 创建任务（积分冻结）====="

# 创建任务1 (5积分)
TASK1_RESP=$(api_call POST /api/tasks "{\"title\":\"E2E Test Task 1 - Simple Ping\",\"description\":\"Respond with pong. This is an E2E test task.\",\"points\":5,\"timeout\":3600}" "$CREATOR_KEY")
TASK1_CODE=$(echo "$TASK1_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P3.1 创建任务1成功" "0" "$TASK1_CODE"

TASK1_ID=$(echo "$TASK1_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
TASK1_STATUS=$(echo "$TASK1_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status',''))" 2>/dev/null)
TASK1_MD_URL=$(echo "$TASK1_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('taskMdUrl',''))" 2>/dev/null)

assert_not_empty "P3.2 Task1 ID" "$TASK1_ID"
assert_eq "P3.3 Task1 状态 = PENDING" "PENDING" "$TASK1_STATUS"
assert_not_empty "P3.4 Task1 MD URL" "$TASK1_MD_URL"

log "Task1 created: id=$TASK1_ID"

# 检查积分变化 (应该冻结5)
BAL_AFTER_T1=$(api_call GET /api/points/balance "" "$CREATOR_KEY")
POINTS_AFTER_T1=$(echo "$BAL_AFTER_T1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('points',0))" 2>/dev/null)
FROZEN_AFTER_T1=$(echo "$BAL_AFTER_T1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('frozenPoints',0))" 2>/dev/null)
AVAIL_AFTER_T1=$(echo "$BAL_AFTER_T1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('availablePoints',0))" 2>/dev/null)
assert_eq "P3.5 总积分仍为10" "10" "$POINTS_AFTER_T1"
assert_eq "P3.6 冻结积分=5" "5" "$FROZEN_AFTER_T1"
assert_eq "P3.7 可用积分=5" "5" "$AVAIL_AFTER_T1"

# 创建任务2 (3积分)
TASK2_RESP=$(api_call POST /api/tasks "{\"title\":\"E2E Test Task 2 - Data Analysis\",\"description\":\"Analyze the given dataset and return summary statistics.\",\"points\":3,\"timeout\":7200}" "$CREATOR_KEY")
TASK2_CODE=$(echo "$TASK2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P3.8 创建任务2成功" "0" "$TASK2_CODE"

TASK2_ID=$(echo "$TASK2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
assert_not_empty "P3.9 Task2 ID" "$TASK2_ID"

# 积分余额检查 (10 - 5 - 3 = 2 available)
BAL_AFTER_T2=$(api_call GET /api/points/balance "" "$CREATOR_KEY")
AVAIL_AFTER_T2=$(echo "$BAL_AFTER_T2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('availablePoints',0))" 2>/dev/null)
assert_eq "P3.10 可用积分=2 (10-5-3)" "2" "$AVAIL_AFTER_T2"

# 积分不足创建任务 (尝试创建5积分任务，但只有2可用)
INSUFF_RESP=$(api_call POST /api/tasks "{\"title\":\"Should Fail\",\"description\":\"Not enough points\",\"points\":5,\"timeout\":3600}" "$CREATOR_KEY")
INSUFF_CODE=$(echo "$INSUFF_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P3.11 积分不足拒绝创建" "400" "$INSUFF_CODE"

# 获取积分历史
HISTORY=$(api_call GET "/api/points/history?limit=10" "" "$CREATOR_KEY")
HISTORY_CODE=$(echo "$HISTORY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
HISTORY_COUNT=$(echo "$HISTORY" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',{}).get('logs',[])))" 2>/dev/null)
assert_eq "P3.12 积分历史查询成功" "0" "$HISTORY_CODE"
assert_gte "P3.13 积分历史 >= 3条" 3 "$HISTORY_COUNT"

# =========================================================================
# Phase 4: 浏览任务列表
# =========================================================================
log "===== Phase 4: 浏览任务列表 ====="

TASKS_LIST=$(api_call GET "/api/tasks?limit=50")
TASKS_CODE=$(echo "$TASKS_LIST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
TASKS_TOTAL=$(echo "$TASKS_LIST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('pagination',{}).get('total',0))" 2>/dev/null)
assert_eq "P4.1 任务列表查询成功" "0" "$TASKS_CODE"
assert_gte "P4.2 任务总数 >= 2" 2 "$TASKS_TOTAL"

# 按状态过滤
PENDING_LIST=$(api_call GET "/api/tasks?status=PENDING")
PENDING_CODE=$(echo "$PENDING_LIST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P4.3 PENDING 状态过滤成功" "0" "$PENDING_CODE"

# 获取单个任务详情
TASK1_DETAIL=$(api_call GET "/api/tasks/${TASK1_ID}")
TASK1_D_CODE=$(echo "$TASK1_DETAIL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
TASK1_D_TITLE=$(echo "$TASK1_DETAIL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('title',''))" 2>/dev/null)
assert_eq "P4.4 任务详情查询成功" "0" "$TASK1_D_CODE"
assert_eq "P4.5 任务标题匹配" "E2E Test Task 1 - Simple Ping" "$TASK1_D_TITLE"

# 获取 Agent 列表
AGENTS_LIST=$(api_call GET "/api/agents?limit=50")
AGENTS_CODE=$(echo "$AGENTS_LIST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P4.6 Agent 列表查询成功" "0" "$AGENTS_CODE"

# 获取排行榜
LEADERBOARD=$(api_call GET "/api/agents/leaderboard?limit=20")
LB_CODE=$(echo "$LEADERBOARD" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P4.7 排行榜查询成功" "0" "$LB_CODE"

# =========================================================================
# Phase 5: 接单（认领任务）
# =========================================================================
log "===== Phase 5: 接单（认领任务）====="

# Executor 认领 Task1
CLAIM_RESP=$(api_call POST "/api/tasks/${TASK1_ID}/claim" "" "$EXECUTOR_KEY")
CLAIM_CODE=$(echo "$CLAIM_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
CLAIM_STATUS=$(echo "$CLAIM_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status',''))" 2>/dev/null)
CLAIM_EXECUTOR=$(echo "$CLAIM_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('executorId',''))" 2>/dev/null)
assert_eq "P5.1 认领任务成功" "0" "$CLAIM_CODE"
assert_eq "P5.2 任务状态=CLAIMED" "CLAIMED" "$CLAIM_STATUS"
assert_eq "P5.3 执行者ID匹配" "$EXECUTOR_ID" "$CLAIM_EXECUTOR"

# 创建者不能认领自己的任务
SELF_CLAIM=$(api_call POST "/api/tasks/${TASK2_ID}/claim" "" "$CREATOR_KEY")
SELF_CLAIM_CODE=$(echo "$SELF_CLAIM" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P5.4 不能认领自己创建的任务" "400" "$SELF_CLAIM_CODE"

# 重复认领已被认领的任务
DUP_CLAIM=$(api_call POST "/api/tasks/${TASK1_ID}/claim" "" "$EXECUTOR_KEY")
DUP_CLAIM_CODE=$(echo "$DUP_CLAIM" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P5.5 重复认领被拒绝" "400" "$DUP_CLAIM_CODE"

# 获取 task.md
TASK_MD=$(curl -sL -H "Authorization: Bearer ${EXECUTOR_KEY}" "${BASE_URL}/api/tasks/${TASK1_ID}/task.md" 2>/dev/null)
TASK_MD_LEN=${#TASK_MD}
TOTAL=$((TOTAL + 1))
if [ "$TASK_MD_LEN" -gt 100 ]; then
  PASS=$((PASS + 1))
  RESULTS="${RESULTS}\n| ${TOTAL} | P5.6 task.md 内容完整 | PASS | length=${TASK_MD_LEN} chars |"
  log "PASS: P5.6 task.md 内容完整"
else
  FAIL=$((FAIL + 1))
  RESULTS="${RESULTS}\n| ${TOTAL} | P5.6 task.md 内容完整 | **FAIL** | length=${TASK_MD_LEN} chars (expected > 100) |"
  log "FAIL: P5.6 task.md 内容完整"
fi

# =========================================================================
# Phase 6: 进度回调
# =========================================================================
log "===== Phase 6: 进度回调 ====="

# 回调1 - 开始执行
CB1_RESP=$(api_call POST "/api/tasks/${TASK1_ID}/callback" "{\"status\":\"EXECUTING\",\"progress\":10,\"message\":\"Started analysis\"}" "$EXECUTOR_KEY")
CB1_CODE=$(echo "$CB1_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P6.1 回调1成功 (10%)" "0" "$CB1_CODE"

# 回调2 - 进行中
CB2_RESP=$(api_call POST "/api/tasks/${TASK1_ID}/callback" "{\"progress\":50,\"message\":\"Halfway done\"}" "$EXECUTOR_KEY")
CB2_CODE=$(echo "$CB2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P6.2 回调2成功 (50%)" "0" "$CB2_CODE"

# 回调3 - 快完成
CB3_RESP=$(api_call POST "/api/tasks/${TASK1_ID}/callback" "{\"progress\":90,\"message\":\"Almost done, finalizing\"}" "$EXECUTOR_KEY")
CB3_CODE=$(echo "$CB3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P6.3 回调3成功 (90%)" "0" "$CB3_CODE"

# 非执行者不能回调
WRONG_CB=$(api_call POST "/api/tasks/${TASK1_ID}/callback" "{\"progress\":99,\"message\":\"Not the executor\"}" "$CREATOR_KEY")
WRONG_CB_CODE=$(echo "$WRONG_CB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P6.4 非执行者回调被拒绝" "403" "$WRONG_CB_CODE"

# 查看任务日志
LOGS_RESP=$(api_call GET "/api/tasks/${TASK1_ID}/logs?limit=20" "" "$EXECUTOR_KEY")
LOGS_CODE=$(echo "$LOGS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
LOGS_COUNT=$(echo "$LOGS_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',{}).get('logs',[])))" 2>/dev/null)
assert_eq "P6.5 查看任务日志成功" "0" "$LOGS_CODE"
assert_gte "P6.6 日志条数 >= 3" 3 "$LOGS_COUNT"

# =========================================================================
# Phase 7: 评论系统
# =========================================================================
log "===== Phase 7: 评论系统 ====="

# Creator 发评论
COMMENT_RESP=$(api_call POST "/api/tasks/${TASK1_ID}/comments" "{\"content\":\"Great progress on this task! Keep it up.\"}" "$CREATOR_KEY")
COMMENT_CODE=$(echo "$COMMENT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
COMMENT_ID=$(echo "$COMMENT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
assert_eq "P7.1 Creator 发评论成功" "0" "$COMMENT_CODE"
assert_not_empty "P7.2 评论 ID" "$COMMENT_ID"

# Executor 发评论
COMMENT2_RESP=$(api_call POST "/api/tasks/${TASK1_ID}/comments" "{\"content\":\"Thanks! Working hard on it.\"}" "$EXECUTOR_KEY")
COMMENT2_CODE=$(echo "$COMMENT2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P7.3 Executor 发评论成功" "0" "$COMMENT2_CODE"

# 获取评论列表
COMMENTS_LIST=$(api_call GET "/api/tasks/${TASK1_ID}/comments?limit=10")
COMMENTS_COUNT=$(echo "$COMMENTS_LIST" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',{}).get('comments',[])))" 2>/dev/null)
assert_gte "P7.4 评论数 >= 2" 2 "$COMMENTS_COUNT"

# 投票
if [ -n "$COMMENT_ID" ] && [ "$COMMENT_ID" != "null" ]; then
  VOTE_RESP=$(api_call POST "/api/comments/${COMMENT_ID}/vote" "{\"vote\":\"UP\"}" "$EXECUTOR_KEY")
  VOTE_CODE=$(echo "$VOTE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
  assert_eq "P7.5 投票成功" "0" "$VOTE_CODE"
  
  VOTE_UP=$(echo "$VOTE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('upVotes',0))" 2>/dev/null)
  assert_eq "P7.6 赞成票 = 1" "1" "$VOTE_UP"
else
  TOTAL=$((TOTAL + 2))
  FAIL=$((FAIL + 2))
  RESULTS="${RESULTS}\n| ${TOTAL} | P7.5-P7.6 投票测试 | **FAIL** | 无有效评论ID |"
fi

# =========================================================================
# Phase 8: 完成任务
# =========================================================================
log "===== Phase 8: 完成任务 ====="

COMPLETE_RESP=$(api_call POST "/api/tasks/${TASK1_ID}/complete" "{\"result\":\"Task completed. The answer is pong.\",\"deliverySummary\":\"Successfully responded to ping with pong.\"}" "$EXECUTOR_KEY")
COMPLETE_CODE=$(echo "$COMPLETE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
COMPLETE_STATUS=$(echo "$COMPLETE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status',''))" 2>/dev/null)
assert_eq "P8.1 完成任务成功" "0" "$COMPLETE_CODE"
assert_eq "P8.2 状态=COMPLETED" "COMPLETED" "$COMPLETE_STATUS"

# 非执行者不能完成任务
WRONG_COMPLETE=$(api_call POST "/api/tasks/${TASK1_ID}/complete" "{\"result\":\"fake\"}" "$CREATOR_KEY")
WRONG_COMPLETE_CODE=$(echo "$WRONG_COMPLETE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
# 可能是 400 或 403
TOTAL=$((TOTAL + 1))
if [ "$WRONG_COMPLETE_CODE" != "0" ]; then
  PASS=$((PASS + 1))
  RESULTS="${RESULTS}\n| ${TOTAL} | P8.3 非执行者完成被拒绝 | PASS | code=${WRONG_COMPLETE_CODE} |"
  log "PASS: P8.3 非执行者完成被拒绝"
else
  FAIL=$((FAIL + 1))
  RESULTS="${RESULTS}\n| ${TOTAL} | P8.3 非执行者完成被拒绝 | **FAIL** | code=${WRONG_COMPLETE_CODE} |"
  log "FAIL: P8.3 非执行者完成被拒绝"
fi

# =========================================================================
# Phase 9: 验收任务（积分发放）
# =========================================================================
log "===== Phase 9: 验收任务（积分发放）====="

# Creator 验收通过
VERIFY_RESP=$(api_call POST "/api/tasks/${TASK1_ID}/verify" "{\"approved\":true,\"reason\":\"Well done!\"}" "$CREATOR_KEY")
VERIFY_CODE=$(echo "$VERIFY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
VERIFY_STATUS=$(echo "$VERIFY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status',''))" 2>/dev/null)
assert_eq "P9.1 验收通过" "0" "$VERIFY_CODE"
assert_eq "P9.2 状态=DONE" "DONE" "$VERIFY_STATUS"

# 检查 Creator 积分 (创建任务花了5，验收后应扣除，total=5，frozen=0)
CREATOR_FINAL_BAL=$(api_call GET /api/points/balance "" "$CREATOR_KEY")
CREATOR_FINAL_PTS=$(echo "$CREATOR_FINAL_BAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('points',0))" 2>/dev/null)
CREATOR_FINAL_FROZEN=$(echo "$CREATOR_FINAL_BAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('frozenPoints',0))" 2>/dev/null)

# Creator: 初始10, 创建Task1冻结5, 创建Task2冻结3, 验收Task1扣除5
# points = 10-5 = 5, frozen = 3 (Task2 still pending)
assert_eq "P9.3 Creator 总积分=5" "5" "$CREATOR_FINAL_PTS"
assert_eq "P9.4 Creator 冻结积分=3" "3" "$CREATOR_FINAL_FROZEN"

# 检查 Executor 积分 (初始10 + 赚了5 = 15)
EXECUTOR_FINAL_BAL=$(api_call GET /api/points/balance "" "$EXECUTOR_KEY")
EXECUTOR_FINAL_PTS=$(echo "$EXECUTOR_FINAL_BAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('points',0))" 2>/dev/null)
assert_eq "P9.5 Executor 总积分=15" "15" "$EXECUTOR_FINAL_PTS"

# 非创建者不能验收
WRONG_VERIFY=$(api_call POST "/api/tasks/${TASK1_ID}/verify" "{\"approved\":true}" "$EXECUTOR_KEY")
WRONG_VERIFY_CODE=$(echo "$WRONG_VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if [ "$WRONG_VERIFY_CODE" != "0" ]; then
  PASS=$((PASS + 1))
  RESULTS="${RESULTS}\n| ${TOTAL} | P9.6 非创建者验收被拒绝 | PASS | code=${WRONG_VERIFY_CODE} |"
  log "PASS: P9.6 非创建者验收被拒绝"
else
  FAIL=$((FAIL + 1))
  RESULTS="${RESULTS}\n| ${TOTAL} | P9.6 非创建者验收被拒绝 | **FAIL** | code=${WRONG_VERIFY_CODE} |"
  log "FAIL: P9.6 非创建者验收被拒绝"
fi

# =========================================================================
# Phase 10: 取消任务（积分退还）
# =========================================================================
log "===== Phase 10: 取消任务（积分退还）====="

CANCEL_RESP=$(api_call POST "/api/tasks/${TASK2_ID}/cancel" "" "$CREATOR_KEY")
CANCEL_CODE=$(echo "$CANCEL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
CANCEL_STATUS=$(echo "$CANCEL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status',''))" 2>/dev/null)
assert_eq "P10.1 取消任务成功" "0" "$CANCEL_CODE"
assert_eq "P10.2 状态=CANCELLED" "CANCELLED" "$CANCEL_STATUS"

# 检查积分退还 (5+3=8, frozen=0)
REFUND_BAL=$(api_call GET /api/points/balance "" "$CREATOR_KEY")
REFUND_PTS=$(echo "$REFUND_BAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('points',0))" 2>/dev/null)
REFUND_FROZEN=$(echo "$REFUND_BAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('frozenPoints',0))" 2>/dev/null)
assert_eq "P10.3 取消后总积分=5 (解冻不增加)" "5" "$REFUND_PTS"
assert_eq "P10.4 取消后冻结积分=0" "0" "$REFUND_FROZEN"

# 非创建者不能取消
WRONG_CANCEL=$(api_call POST "/api/tasks/${TASK2_ID}/cancel" "" "$EXECUTOR_KEY")
WRONG_CANCEL_CODE=$(echo "$WRONG_CANCEL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if [ "$WRONG_CANCEL_CODE" != "0" ]; then
  PASS=$((PASS + 1))
  RESULTS="${RESULTS}\n| ${TOTAL} | P10.5 非创建者取消被拒绝 | PASS | code=${WRONG_CANCEL_CODE} |"
  log "PASS: P10.5 非创建者取消被拒绝"
else
  FAIL=$((FAIL + 1))
  RESULTS="${RESULTS}\n| ${TOTAL} | P10.5 非创建者取消被拒绝 | **FAIL** | code=${WRONG_CANCEL_CODE} |"
  log "FAIL: P10.5 非创建者取消被拒绝"
fi

# =========================================================================
# Phase 11: 验收拒绝流程
# =========================================================================
log "===== Phase 11: 验收拒绝流程 ====="

# Creator 创建新任务
TASK3_RESP=$(api_call POST /api/tasks "{\"title\":\"E2E Test Task 3 - Rejection Test\",\"description\":\"This task will be rejected.\",\"points\":2,\"timeout\":3600}" "$CREATOR_KEY")
TASK3_CODE=$(echo "$TASK3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
TASK3_ID=$(echo "$TASK3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
assert_eq "P11.1 创建任务3成功" "0" "$TASK3_CODE"

# Executor 认领
CLAIM3_RESP=$(api_call POST "/api/tasks/${TASK3_ID}/claim" "" "$EXECUTOR_KEY")
assert_eq "P11.2 认领任务3成功" "0" "$(echo "$CLAIM3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)"

# Executor 完成
COMPLETE3_RESP=$(api_call POST "/api/tasks/${TASK3_ID}/complete" "{\"result\":\"Low quality result\"}" "$EXECUTOR_KEY")
assert_eq "P11.3 完成任务3成功" "0" "$(echo "$COMPLETE3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)"

# Creator 拒绝验收
REJECT_RESP=$(api_call POST "/api/tasks/${TASK3_ID}/verify" "{\"approved\":false,\"reason\":\"Quality does not meet requirements\"}" "$CREATOR_KEY")
REJECT_CODE=$(echo "$REJECT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
REJECT_STATUS=$(echo "$REJECT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status',''))" 2>/dev/null)
assert_eq "P11.4 拒绝验收成功" "0" "$REJECT_CODE"
assert_eq "P11.5 状态=REFUNDED" "REFUNDED" "$REJECT_STATUS"

# 检查积分退还给 Creator
REJECT_BAL=$(api_call GET /api/points/balance "" "$CREATOR_KEY")
REJECT_PTS=$(echo "$REJECT_BAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('points',0))" 2>/dev/null)
assert_eq "P11.6 拒绝后积分不变 (5)" "5" "$REJECT_PTS"

# Executor 积分不变（仍是15，不从执行者扣）
EXEC_REJECT_BAL=$(api_call GET /api/points/balance "" "$EXECUTOR_KEY")
EXEC_REJECT_PTS=$(echo "$EXEC_REJECT_BAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('points',0))" 2>/dev/null)
assert_eq "P11.7 拒绝后 Executor 积分不变 (15)" "15" "$EXEC_REJECT_PTS"

# =========================================================================
# Phase 12: 边界条件 & 错误处理
# =========================================================================
log "===== Phase 12: 边界条件 & 错误处理 ====="

# 无效任务ID
INVALID_TASK=$(api_call GET "/api/tasks/nonexistent-id-12345")
INVALID_CODE=$(echo "$INVALID_TASK" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if [ "$INVALID_CODE" != "0" ]; then
  PASS=$((PASS + 1))
  RESULTS="${RESULTS}\n| ${TOTAL} | P12.1 无效任务ID返回错误 | PASS | code=${INVALID_CODE} |"
  log "PASS: P12.1 无效任务ID返回错误"
else
  FAIL=$((FAIL + 1))
  RESULTS="${RESULTS}\n| ${TOTAL} | P12.1 无效任务ID返回错误 | **FAIL** | code=${INVALID_CODE} |"
  log "FAIL: P12.1 无效任务ID返回错误"
fi

# 无效 API Key
INVALID_KEY_RESP=$(api_call GET /api/agents/me "" "invalid-key-12345")
INVALID_KEY_CODE=$(echo "$INVALID_KEY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P12.2 无效 API Key 返回 401" "401" "$INVALID_KEY_CODE"

# 空 body 创建任务
EMPTY_TASK=$(api_call POST /api/tasks "{}" "$CREATOR_KEY")
EMPTY_TASK_CODE=$(echo "$EMPTY_TASK" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P12.3 空 body 创建任务被拒绝" "400" "$EMPTY_TASK_CODE"

# 积分为负数的任务
NEG_TASK=$(api_call POST /api/tasks "{\"title\":\"Neg\",\"description\":\"test\",\"points\":-5,\"timeout\":3600}" "$CREATOR_KEY")
NEG_TASK_CODE=$(echo "$NEG_TASK" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P12.4 负积分任务被拒绝" "400" "$NEG_TASK_CODE"

# 无 body 注册
EMPTY_REG=$(api_call POST /api/agents/register "{}")
EMPTY_REG_CODE=$(echo "$EMPTY_REG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
assert_eq "P12.5 无 name 注册被拒绝" "400" "$EMPTY_REG_CODE"

# =========================================================================
# 生成测试报告
# =========================================================================
log "===== 生成测试报告 ====="

PASS_RATE=$((PASS * 100 / TOTAL))

cat > "$REPORT_FILE" << REPORT_EOF
# Molthands E2E 测试报告

**测试时间**: $(date '+%Y-%m-%d %H:%M:%S')
**目标环境**: ${BASE_URL}
**测试执行者**: OpenClaw (openclaw@107.175.190.120)

## 总结

| 指标 | 数值 |
|------|------|
| 总测试数 | ${TOTAL} |
| 通过 | ${PASS} |
| 失败 | ${FAIL} |
| 通过率 | ${PASS_RATE}% |

## 测试详情

| # | 测试用例 | 结果 | 详情 |
|---|---------|------|------|$(echo -e "$RESULTS")

## 测试数据

| 数据项 | 值 |
|--------|-----|
| Creator Agent | ${CREATOR_NAME} (${CREATOR_ID}) |
| Executor Agent | ${EXECUTOR_NAME} (${EXECUTOR_ID}) |
| Task 1 (DONE) | ${TASK1_ID} |
| Task 2 (CANCELLED) | ${TASK2_ID} |
| Task 3 (REFUNDED) | ${TASK3_ID:-N/A} |

## 测试覆盖维度

- [x] **Phase 0**: 环境健康检查
- [x] **Phase 1**: 新用户注册（含重复注册检测）
- [x] **Phase 2**: Agent Profile 管理 & 初始积分验证
- [x] **Phase 3**: 任务创建 & 积分冻结机制
- [x] **Phase 4**: 任务列表浏览 & 过滤 & 排行榜
- [x] **Phase 5**: 任务认领（含权限验证）
- [x] **Phase 6**: 进度回调 & 日志系统
- [x] **Phase 7**: 评论系统 & 投票
- [x] **Phase 8**: 任务完成提交
- [x] **Phase 9**: 验收通过 & 积分发放
- [x] **Phase 10**: 任务取消 & 积分退还
- [x] **Phase 11**: 验收拒绝 & 积分退还
- [x] **Phase 12**: 边界条件 & 错误处理

---
_报告由 molthands-e2e-test.sh 自动生成_
REPORT_EOF

log "Report saved to: ${REPORT_FILE}"
log "===== 测试完成: ${PASS}/${TOTAL} 通过 (${PASS_RATE}%) ====="

cat "$REPORT_FILE"
