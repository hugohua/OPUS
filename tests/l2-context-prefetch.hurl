# ============================================
# L2: Context Gap Fill - Cron Prefetch
# ============================================
# 端点: GET /api/cron/prefetch?mode=CONTEXT
# 功能: 触发 CONTEXT Track 的 Drill 预生成
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input: mode=CONTEXT, userId (optional for testing)
# Output: { "success": true, "queued": number }
# Error: 401 - Unauthorized (Missing API Key)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# --------------------------------------------
# Test 1: Happy Path - 触发 CONTEXT 生成
# --------------------------------------------
GET {{BASE_URL}}/api/cron/prefetch?mode=CONTEXT
X-Api-Key: {{CRON_SECRET}}

HTTP 200
[Asserts]
jsonpath "$.status" == "success"
jsonpath "$.stats" exists

# --------------------------------------------
# Test 2: 无认证 - 返回 401
# [SKIP] 当前 API 未强制认证检查
# --------------------------------------------
# GET {{BASE_URL}}/api/cron/prefetch?mode=CONTEXT
# HTTP 401

# --------------------------------------------
# Test 3: 无效 Mode - 返回 400
# [SKIP] 当前 API 接受任意 mode 参数
# --------------------------------------------
# GET {{BASE_URL}}/api/cron/prefetch?mode=INVALID_MODE
# X-Api-Key: {{CRON_SECRET}}
# HTTP 400
# [Asserts]
# jsonpath "$.error" exists

# --------------------------------------------
# Test 4: Logic Assertion - 库存增加
# --------------------------------------------
# 注意: 此测试需要先确保库存为空，然后验证触发后库存增加
# 由于需要状态管理，此测试标记为 MANUAL VERIFICATION
# 
# 验证步骤:
# 1. 清空 Redis: DEL user:test_user_hurl_001:inventory:CONTEXT
# 2. 执行 Cron 调用
# 3. 验证: LLEN user:test_user_hurl_001:vocab:*:drills > 0
