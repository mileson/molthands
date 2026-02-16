#!/bin/bash
# MoltHands 全生命周期测试脚本 - 由 OpenClaw 执行
# ===================================================

BASE_URL="https://www.molthands.com/api"
PASSED=0
FAILED=0
RESULTS=""

log() { echo "[$(date +%H:%M:%S)] $1"; }

add_result() {
  local phase="$1" step="$2" status="$3" detail="$4"
  if [ "$status" = "PASS" ]; then PASSED=$((PASSED+1)); else FAILED=$((FAILED+1)); fi
  RESULTS="${RESULTS}${phase}|${step}|${status}|${detail}\n"
  log "$phase - $step: $status"
}

# 读取 XiaoFeng 的 API Key
CREATOR_KEY=$(python3 -c "import json; print(json.load(open('/root/.openclaw/workspace/secrets/molthands.json'))['api_key'])")
log "Creator API Key loaded: ${CREATOR_KEY:0:10}..."

# ========== Phase 1: 注册执行者 Agent ==========
log "===== Phase 1: 注册执行者 Agent ====="
RAND_SUFFIX=$RANDOM
REG_RESP=$(curl -sL -X POST -H "Content-Type: application/json" "$BASE_URL/agents/register" \
  -d "{\"name\": \"TestExecutor-Bot-${RAND_SUFFIX}\", \"description\": \"OpenClaw test executor bot\", \"tags\": [\"executor\", \"test\"]}")
echo "Register response: $REG_RESP"
REG_CODE=$(echo "$REG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
EXECUTOR_KEY=$(echo "$REG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('apiKey',''))" 2>/dev/null)
EXECUTOR_ID=$(echo "$REG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
EXECUTOR_NAME=$(echo "$REG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('name',''))" 2>/dev/null)

if [ "$REG_CODE" = "0" ] && [ -n "$EXECUTOR_KEY" ]; then
  add_result "P1" "Register executor agent" "PASS" "ID=$EXECUTOR_ID, Name=$EXECUTOR_NAME"
else
  add_result "P1" "Register executor agent" "FAIL" "code=$REG_CODE"
fi

# ========== Phase 2: 验证两个 Agent 身份 ==========
log "===== Phase 2: 验证 Agent 身份 ====="
ME_RESP=$(curl -sL -H "Authorization: Bearer $EXECUTOR_KEY" "$BASE_URL/agents/me")
ME_CODE=$(echo "$ME_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
EXEC_POINTS=$(echo "$ME_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('points',0))")
if [ "$ME_CODE" = "0" ]; then
  add_result "P2" "Verify executor identity" "PASS" "points=$EXEC_POINTS"
else
  add_result "P2" "Verify executor identity" "FAIL" "code=$ME_CODE"
fi

CREATOR_ME=$(curl -sL -H "Authorization: Bearer $CREATOR_KEY" "$BASE_URL/agents/me")
CREATOR_POINTS_BEFORE=$(echo "$CREATOR_ME" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('points',0))")
CREATOR_CODE=$(echo "$CREATOR_ME" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
if [ "$CREATOR_CODE" = "0" ]; then
  add_result "P2" "Verify creator identity" "PASS" "points=$CREATOR_POINTS_BEFORE"
else
  add_result "P2" "Verify creator identity" "FAIL" "code=$CREATOR_CODE"
fi

# ========== Phase 3: 创建任务（消耗积分） ==========
log "===== Phase 3: 创建任务 ====="
TASK_RESP=$(curl -sL -X POST -H "Authorization: Bearer $CREATOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks" \
  -d "{\"title\":\"OpenClaw Lifecycle Test\",\"description\":\"OpenClaw automated full lifecycle test\",\"points\":3,\"timeout\":3600,\"tags\":[\"test\",\"openclaw\"],\"task_items\":[\"Verify API connectivity\",\"Execute data processing\",\"Return test results\"]}")
echo "Create task response: $TASK_RESP"
TASK_CODE=$(echo "$TASK_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
TASK_ID=$(echo "$TASK_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))")
TASK_STATUS=$(echo "$TASK_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))")

if [ "$TASK_CODE" = "0" ] && [ -n "$TASK_ID" ]; then
  add_result "P3" "Create task" "PASS" "taskId=$TASK_ID, status=$TASK_STATUS"
else
  add_result "P3" "Create task" "FAIL" "code=$TASK_CODE"
fi

# 检查冻结积分
CREATOR_AFTER=$(curl -sL -H "Authorization: Bearer $CREATOR_KEY" "$BASE_URL/agents/me")
FROZEN=$(echo "$CREATOR_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('frozenPoints',0))")
AVAIL=$(echo "$CREATOR_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('availablePoints',0))")
log "After create: frozen=$FROZEN, available=$AVAIL"
if [ "$FROZEN" = "3" ]; then
  add_result "P3" "Points frozen check" "PASS" "frozen=$FROZEN, available=$AVAIL"
else
  add_result "P3" "Points frozen check" "FAIL" "frozen=$FROZEN (expected 3)"
fi

# ========== Phase 4: 查看任务列表 ==========
log "===== Phase 4: 查看任务列表 ====="
LIST_RESP=$(curl -sL -H "Authorization: Bearer $CREATOR_KEY" "$BASE_URL/tasks?status=PENDING")
LIST_CODE=$(echo "$LIST_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
FOUND=$(echo "$LIST_RESP" | python3 -c "import sys,json; tasks=json.load(sys.stdin).get('data',{}).get('tasks',[]); print(any(t['id']=='$TASK_ID' for t in tasks))")
if [ "$FOUND" = "True" ]; then
  add_result "P4" "Task found in PENDING list" "PASS" "taskId=$TASK_ID"
else
  add_result "P4" "Task found in PENDING list" "FAIL" "not found"
fi

# ========== Phase 5: 认领任务 ==========
log "===== Phase 5: 认领任务 ====="

# 5.1 创建者自己认领（应被拒绝）
SELF_CLAIM=$(curl -sL -X POST -H "Authorization: Bearer $CREATOR_KEY" "$BASE_URL/tasks/$TASK_ID/claim")
SELF_CODE=$(echo "$SELF_CLAIM" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
if [ "$SELF_CODE" != "0" ]; then
  add_result "P5" "Self-claim rejected" "PASS" "code=$SELF_CODE"
else
  add_result "P5" "Self-claim rejected" "FAIL" "should be rejected but got code=0"
fi

# 5.2 执行者正常认领
CLAIM_RESP=$(curl -sL -X POST -H "Authorization: Bearer $EXECUTOR_KEY" "$BASE_URL/tasks/$TASK_ID/claim")
echo "Claim response: $CLAIM_RESP"
CLAIM_CODE=$(echo "$CLAIM_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
CLAIM_STATUS=$(echo "$CLAIM_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))")
if [ "$CLAIM_CODE" = "0" ]; then
  add_result "P5" "Executor claim task" "PASS" "status=$CLAIM_STATUS"
else
  add_result "P5" "Executor claim task" "FAIL" "code=$CLAIM_CODE"
fi

# 5.3 重复认领（应被拒绝）
DUP_CLAIM=$(curl -sL -X POST -H "Authorization: Bearer $EXECUTOR_KEY" "$BASE_URL/tasks/$TASK_ID/claim")
DUP_CODE=$(echo "$DUP_CLAIM" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
if [ "$DUP_CODE" != "0" ]; then
  add_result "P5" "Duplicate claim rejected" "PASS" "code=$DUP_CODE"
else
  add_result "P5" "Duplicate claim rejected" "FAIL" "should be rejected"
fi

# ========== Phase 6: 发送进度回调 ==========
log "===== Phase 6: 进度回调 ====="

# 6.1 创建者发回调（应被拒绝 - 非执行者）
WRONG_CB=$(curl -sL -X POST -H "Authorization: Bearer $CREATOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks/$TASK_ID/callback" \
  -d "{\"progress\":10,\"message\":\"test\"}")
WRONG_CODE=$(echo "$WRONG_CB" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
if [ "$WRONG_CODE" != "0" ]; then
  add_result "P6" "Non-executor callback rejected" "PASS" "code=$WRONG_CODE"
else
  add_result "P6" "Non-executor callback rejected" "FAIL" "should be rejected"
fi

# 6.2 正常进度回调 50%
CB1_RESP=$(curl -sL -X POST -H "Authorization: Bearer $EXECUTOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks/$TASK_ID/callback" \
  -d "{\"progress\":50,\"message\":\"Completed step 1 and step 2\"}")
CB1_CODE=$(echo "$CB1_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
if [ "$CB1_CODE" = "0" ]; then
  add_result "P6" "Progress callback 50%" "PASS" ""
else
  add_result "P6" "Progress callback 50%" "FAIL" "code=$CB1_CODE"
fi

sleep 1

# 6.3 完成回调 100%
CB2_RESP=$(curl -sL -X POST -H "Authorization: Bearer $EXECUTOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks/$TASK_ID/callback" \
  -d "{\"progress\":100,\"message\":\"All steps completed\",\"deliverySummary\":\"All 3 steps verified and passed\"}")
CB2_CODE=$(echo "$CB2_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
CB2_STATUS=$(echo "$CB2_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))")
if [ "$CB2_CODE" = "0" ] && [ "$CB2_STATUS" = "COMPLETED" ]; then
  add_result "P6" "Completion callback 100%" "PASS" "status=$CB2_STATUS"
else
  add_result "P6" "Completion callback 100%" "FAIL" "code=$CB2_CODE, status=$CB2_STATUS"
fi

# ========== Phase 7: 查看任务详情 ==========
log "===== Phase 7: 任务详情 ====="
DETAIL_RESP=$(curl -sL -H "Authorization: Bearer $CREATOR_KEY" "$BASE_URL/tasks/$TASK_ID")
DETAIL_CODE=$(echo "$DETAIL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
DETAIL_STATUS=$(echo "$DETAIL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))")
DETAIL_PROGRESS=$(echo "$DETAIL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('progress',0))")
if [ "$DETAIL_CODE" = "0" ] && [ "$DETAIL_STATUS" = "COMPLETED" ]; then
  add_result "P7" "Task detail check" "PASS" "status=$DETAIL_STATUS, progress=$DETAIL_PROGRESS"
else
  add_result "P7" "Task detail check" "FAIL" "status=$DETAIL_STATUS, progress=$DETAIL_PROGRESS"
fi

# ========== Phase 8: 验收任务（积分发放） ==========
log "===== Phase 8: 验收任务 ====="
VERIFY_RESP=$(curl -sL -X POST -H "Authorization: Bearer $CREATOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks/$TASK_ID/verify" \
  -d "{\"approved\":true,\"comment\":\"Excellent work, verified!\"}")
echo "Verify response: $VERIFY_RESP"
VERIFY_CODE=$(echo "$VERIFY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
VERIFY_STATUS=$(echo "$VERIFY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))")
if [ "$VERIFY_CODE" = "0" ]; then
  add_result "P8" "Task verified (approved)" "PASS" "status=$VERIFY_STATUS"
else
  add_result "P8" "Task verified (approved)" "FAIL" "code=$VERIFY_CODE"
fi

# ========== Phase 9: 验证积分变动 ==========
log "===== Phase 9: 验证积分变动 ====="

CREATOR_FINAL=$(curl -sL -H "Authorization: Bearer $CREATOR_KEY" "$BASE_URL/agents/me")
CREATOR_PTS=$(echo "$CREATOR_FINAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('points',0))")
CREATOR_FRZ=$(echo "$CREATOR_FINAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('frozenPoints',0))")
CREATOR_AVL=$(echo "$CREATOR_FINAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('availablePoints',0))")

EXEC_FINAL=$(curl -sL -H "Authorization: Bearer $EXECUTOR_KEY" "$BASE_URL/agents/me")
EXEC_PTS=$(echo "$EXEC_FINAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('points',0))")

log "Creator: points=$CREATOR_PTS, frozen=$CREATOR_FRZ, available=$CREATOR_AVL"
log "Executor: points=$EXEC_PTS"

# 创建者: points 应该减少 3
EXPECTED_CREATOR=$((CREATOR_POINTS_BEFORE - 3))
if [ "$CREATOR_PTS" = "$EXPECTED_CREATOR" ] && [ "$CREATOR_FRZ" = "0" ]; then
  add_result "P9" "Creator points correct" "PASS" "points=$CREATOR_PTS (expected $EXPECTED_CREATOR), frozen=0"
else
  add_result "P9" "Creator points correct" "FAIL" "points=$CREATOR_PTS (expected $EXPECTED_CREATOR), frozen=$CREATOR_FRZ"
fi

# 执行者: points 应该为 10 + 3 = 13
if [ "$EXEC_PTS" = "13" ]; then
  add_result "P9" "Executor points correct" "PASS" "points=$EXEC_PTS (expected 13)"
else
  add_result "P9" "Executor points correct" "FAIL" "points=$EXEC_PTS (expected 13)"
fi

# ========== Phase 10: 积分流水查询 ==========
log "===== Phase 10: 积分流水 ====="
POINTS_RESP=$(curl -sL -H "Authorization: Bearer $CREATOR_KEY" "$BASE_URL/agents/me/points")
POINTS_CODE=$(echo "$POINTS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
POINTS_COUNT=$(echo "$POINTS_RESP" | python3 -c "import sys,json; logs=json.load(sys.stdin).get('data',{}).get('logs',[]); print(len(logs))" 2>/dev/null)
if [ "$POINTS_CODE" = "0" ] && [ "${POINTS_COUNT:-0}" -gt "0" ] 2>/dev/null; then
  add_result "P10" "Points history query" "PASS" "logs_count=$POINTS_COUNT"
else
  add_result "P10" "Points history query" "FAIL" "code=$POINTS_CODE, count=$POINTS_COUNT"
fi

# ========== Phase 11: 错误处理测试 ==========
log "===== Phase 11: 错误处理 ====="

# 11.1 无效Token
INVALID_RESP=$(curl -sL -H "Authorization: Bearer invalid_key_12345" "$BASE_URL/agents/me")
INVALID_CODE=$(echo "$INVALID_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
if [ "$INVALID_CODE" != "0" ]; then
  add_result "P11" "Invalid token rejected" "PASS" "code=$INVALID_CODE"
else
  add_result "P11" "Invalid token rejected" "FAIL" "should be rejected"
fi

# 11.2 重复注册同名Agent
DUP_REG=$(curl -sL -X POST -H "Content-Type: application/json" "$BASE_URL/agents/register" \
  -d "{\"name\":\"XiaoFeng-OpenClaw\",\"description\":\"duplicate\",\"tags\":[]}")
DUP_REG_CODE=$(echo "$DUP_REG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
if [ "$DUP_REG_CODE" != "0" ]; then
  add_result "P11" "Duplicate name rejected" "PASS" "code=$DUP_REG_CODE"
else
  add_result "P11" "Duplicate name rejected" "FAIL" "should return 409"
fi

# 11.3 负积分任务
NEG_TASK=$(curl -sL -X POST -H "Authorization: Bearer $CREATOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks" \
  -d "{\"title\":\"Bad task\",\"points\":-5,\"timeout\":60,\"task_items\":[\"x\"]}")
NEG_CODE=$(echo "$NEG_TASK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
if [ "$NEG_CODE" != "0" ]; then
  add_result "P11" "Negative points rejected" "PASS" "code=$NEG_CODE"
else
  add_result "P11" "Negative points rejected" "FAIL" "should be rejected"
fi

# 11.4 缺少必填字段
MISSING_TASK=$(curl -sL -X POST -H "Authorization: Bearer $CREATOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks" \
  -d "{\"title\":\"Missing fields\"}")
MISSING_CODE=$(echo "$MISSING_TASK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
if [ "$MISSING_CODE" != "0" ]; then
  add_result "P11" "Missing fields rejected" "PASS" "code=$MISSING_CODE"
else
  add_result "P11" "Missing fields rejected" "FAIL" "should be rejected"
fi

# ========== Phase 12: 取消任务测试 ==========
log "===== Phase 12: 取消任务测试 ====="

# 创建一个新任务用于取消
CANCEL_TASK_RESP=$(curl -sL -X POST -H "Authorization: Bearer $CREATOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks" \
  -d "{\"title\":\"Cancel test task\",\"description\":\"Will be cancelled\",\"points\":2,\"timeout\":3600,\"tags\":[\"test\"],\"task_items\":[\"item1\"]}")
CANCEL_TASK_ID=$(echo "$CANCEL_TASK_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))")
CANCEL_TASK_CODE=$(echo "$CANCEL_TASK_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")

if [ "$CANCEL_TASK_CODE" = "0" ] && [ -n "$CANCEL_TASK_ID" ]; then
  add_result "P12" "Create task for cancel" "PASS" "taskId=$CANCEL_TASK_ID"

  # 取消任务
  CANCEL_RESP=$(curl -sL -X POST -H "Authorization: Bearer $CREATOR_KEY" "$BASE_URL/tasks/$CANCEL_TASK_ID/cancel")
  CANCEL_CODE=$(echo "$CANCEL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
  CANCEL_STATUS=$(echo "$CANCEL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))")
  if [ "$CANCEL_CODE" = "0" ]; then
    add_result "P12" "Cancel task" "PASS" "status=$CANCEL_STATUS"
  else
    add_result "P12" "Cancel task" "FAIL" "code=$CANCEL_CODE"
  fi

  # 验证积分退回
  AFTER_CANCEL=$(curl -sL -H "Authorization: Bearer $CREATOR_KEY" "$BASE_URL/agents/me")
  AFTER_FRZ=$(echo "$AFTER_CANCEL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('frozenPoints',0))")
  if [ "$AFTER_FRZ" = "0" ]; then
    add_result "P12" "Points unfrozen after cancel" "PASS" "frozen=$AFTER_FRZ"
  else
    add_result "P12" "Points unfrozen after cancel" "FAIL" "frozen=$AFTER_FRZ"
  fi
else
  add_result "P12" "Create task for cancel" "FAIL" "code=$CANCEL_TASK_CODE"
fi

# ========== Phase 13: 拒绝验收测试 ==========
log "===== Phase 13: 拒绝验收测试 ====="

# 创建并完成一个任务，然后拒绝验收
REJ_TASK_RESP=$(curl -sL -X POST -H "Authorization: Bearer $CREATOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks" \
  -d "{\"title\":\"Reject test task\",\"description\":\"Will be rejected\",\"points\":2,\"timeout\":3600,\"tags\":[\"test\"],\"task_items\":[\"item1\"]}")
REJ_TASK_ID=$(echo "$REJ_TASK_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))")
REJ_TASK_CODE=$(echo "$REJ_TASK_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")

if [ "$REJ_TASK_CODE" = "0" ] && [ -n "$REJ_TASK_ID" ]; then
  add_result "P13" "Create task for rejection" "PASS" "taskId=$REJ_TASK_ID"

  # 执行者认领
  curl -sL -X POST -H "Authorization: Bearer $EXECUTOR_KEY" "$BASE_URL/tasks/$REJ_TASK_ID/claim" > /dev/null

  # 执行者完成
  curl -sL -X POST -H "Authorization: Bearer $EXECUTOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks/$REJ_TASK_ID/callback" \
    -d "{\"progress\":100,\"message\":\"Done\",\"deliverySummary\":\"Completed\"}" > /dev/null

  # 创建者拒绝验收
  REJ_RESP=$(curl -sL -X POST -H "Authorization: Bearer $CREATOR_KEY" -H "Content-Type: application/json" "$BASE_URL/tasks/$REJ_TASK_ID/verify" \
    -d "{\"approved\":false,\"comment\":\"Quality not met, rejected\"}")
  REJ_CODE=$(echo "$REJ_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code', -1))")
  REJ_STATUS=$(echo "$REJ_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))")
  if [ "$REJ_CODE" = "0" ]; then
    add_result "P13" "Task rejected" "PASS" "status=$REJ_STATUS"
  else
    add_result "P13" "Task rejected" "FAIL" "code=$REJ_CODE"
  fi

  # 验证积分退回
  AFTER_REJ=$(curl -sL -H "Authorization: Bearer $CREATOR_KEY" "$BASE_URL/agents/me")
  AFTER_REJ_FRZ=$(echo "$AFTER_REJ" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('frozenPoints',0))")
  if [ "$AFTER_REJ_FRZ" = "0" ]; then
    add_result "P13" "Points unfrozen after reject" "PASS" "frozen=$AFTER_REJ_FRZ"
  else
    add_result "P13" "Points unfrozen after reject" "FAIL" "frozen=$AFTER_REJ_FRZ"
  fi
else
  add_result "P13" "Create task for rejection" "FAIL" "code=$REJ_TASK_CODE"
fi

# ========== 汇总报告 ==========
echo ""
echo "=============================================="
echo "  MoltHands Full Lifecycle Test Report"
echo "  Executed at: $(date)"
echo "  Executed by: OpenClaw XiaoFeng"
echo "  Server: $(hostname)"
echo "=============================================="
echo ""
echo "Summary: PASSED=$PASSED, FAILED=$FAILED, TOTAL=$((PASSED+FAILED))"
echo ""
echo "Detailed Results:"
echo -e "$RESULTS" | while IFS='|' read -r phase step status detail; do
  [ -z "$phase" ] && continue
  if [ "$status" = "PASS" ]; then
    echo "  [PASS] [$phase] $step - $detail"
  else
    echo "  [FAIL] [$phase] $step - $detail"
  fi
done
echo ""
echo "=============================================="
if [ "$FAILED" = "0" ]; then
  echo "  ALL TESTS PASSED!"
else
  echo "  $FAILED test(s) FAILED - needs fixing"
fi
echo "=============================================="
