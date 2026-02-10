# ============================================
# L2: Magic Wand 查词 API 测试
# ============================================
# 端点: GET /api/wand/word
# 功能: 即时查词 (Cache-First: 本地词源 + 异步 AI 解析)
# 安全: 需要认证 (session cookie)
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input (Query Params):
#   word: string           // 必填: 查询的单词 (e.g., "strategy")
#   context_id: string?    // 可选: 上下文 ID (用于 AI 语境解析)
#
# Output (JSON):
#   {
#     "vocab": {
#       "phonetic": string,
#       "meaning": string
#     },
#     "etymology": {
#       "mode": "ROOTS" | "DERIVATIVE" | "ASSOCIATION" | "NONE",
#       "memory_hook": string,
#       "data": object
#     } | null,
#     "ai_insight": null  // 前端通过 SSE 异步获取
#   }
#
# Error Response:
#   401: Unauthorized (无认证)
#   404: { "error": "Word not found" }
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ============================================
# Test 1: 无认证访问应返回 401
# ============================================
GET {{BASE_URL}}/api/wand/word?word=strategy

HTTP 401

# ============================================
# Test 2: 基础查询 (Cache-First)
# ============================================
# 需要配置: SESSION_TOKEN 环境变量
GET {{BASE_URL}}/api/wand/word?word=strategy
Cookie: next-auth.session-token={{SESSION_TOKEN}}

HTTP 200
[Asserts]
jsonpath "$.vocab" exists
jsonpath "$.vocab.phonetic" exists
jsonpath "$.etymology" exists
jsonpath "$.ai_insight" == null

# ============================================
# Test 3: 带上下文查询
# ============================================
GET {{BASE_URL}}/api/wand/word?word=forecast&context_id=article_123
Cookie: next-auth.session-token={{SESSION_TOKEN}}

HTTP 200
[Asserts]
jsonpath "$.vocab" exists
jsonpath "$.etymology" exists

# ============================================
# Test 4: 不存在的单词应返回 404
# ============================================
GET {{BASE_URL}}/api/wand/word?word=nonexistentword12345
Cookie: next-auth.session-token={{SESSION_TOKEN}}

HTTP 404
