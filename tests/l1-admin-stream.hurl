# ============================================
# L1: Admin Stream SSE 端点测试
# ============================================
# 端点: GET /api/admin/stream
# 功能: 实时推送 Drill 生成事件 (SSE)
# 安全: 需要认证 (session cookie)
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input: None (GET)
#
# Output: SSE Stream
#   Content-Type: text/event-stream
#   data: { ... drill event JSON ... }
#
# Error Response:
#   401: Unauthorized (无认证)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ============================================
# Test 1: 无认证访问应返回 401
# ============================================
GET {{BASE_URL}}/api/admin/stream

HTTP 401

# ============================================
# Test 2: 认证后应返回 SSE 流
# ============================================
# 需要配置: SESSION_TOKEN 环境变量
GET {{BASE_URL}}/api/admin/stream
Cookie: next-auth.session-token={{SESSION_TOKEN}}

HTTP 200
[Asserts]
header "Content-Type" contains "text/event-stream"
header "Cache-Control" contains "no-cache"
