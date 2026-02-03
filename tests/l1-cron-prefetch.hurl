# ============================================
# L1: Cron Prefetch 端点测试
# ============================================
# 端点: GET /api/cron/prefetch
# 功能: 触发每日复习队列的缓存预生成
# 安全: 需要 CRON_SECRET 认证 (防止滥用)
#
# ⚠️ 注意: 当 CRON_SECRET 未配置时，认证被跳过
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input (Headers):
#   Authorization: Bearer <CRON_SECRET>
#
# Output (JSON Schema):
#   {
#     "status": "success",
#     "message": string,
#     "stats": {
#       "successCount": number,
#       "skipCount": number,
#       "errorCount": number
#     }
#   }
#
# Error Response:
#   401: { "error": "Unauthorized" }
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ============================================
# Test 1: 正确调用应返回成功 (Happy Path)
# ============================================
# 开发环境下 CRON_SECRET 可能未配置，所以直接测试功能
GET {{BASE_URL}}/api/cron/prefetch
Authorization: Bearer {{CRON_SECRET}}

HTTP 200
[Captures]
success_count: jsonpath "$.stats.successCount"
skip_count: jsonpath "$.stats.skipCount"
[Asserts]
# 1. Schema 验证
jsonpath "$.status" isString
jsonpath "$.message" isString
jsonpath "$.stats" exists

# 2. 业务逻辑验证
jsonpath "$.status" == "success"
jsonpath "$.stats.successCount" isInteger
jsonpath "$.stats.skipCount" isInteger
jsonpath "$.stats.errorCount" isInteger
