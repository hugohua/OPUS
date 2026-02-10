# ============================================
# L2: Weaver Lab V2 API 测试
# ============================================
# 端点: POST /api/weaver/v2/generate
# 功能: FSRS 队列集成的沉浸式阅读生成 (SSE 流式)
# 安全: 需要认证 (session cookie)
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input (JSON Body):
#   {
#     "scenario": string,           // 场景: "team_meeting" | "client_email" | ...
#     "target_word_ids": number[]?   // 可选: 手动指定词汇 ID
#   }
#
# Output: SSE Stream
#   Content-Type: text/event-stream
#
# Error Response:
#   401: Unauthorized (无认证)
#   400: Invalid input (Zod 校验失败)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ============================================
# Test 1: 无认证访问应返回 401
# ============================================
POST {{BASE_URL}}/api/weaver/v2/generate
Content-Type: application/json
{
    "scenario": "team_meeting"
}

HTTP 401

# ============================================
# Test 2: 缺少必需参数应返回 400
# ============================================
POST {{BASE_URL}}/api/weaver/v2/generate
Cookie: next-auth.session-token={{SESSION_TOKEN}}
Content-Type: application/json
{}

HTTP 400
[Asserts]
jsonpath "$.error" exists

# ============================================
# Test 3: 正常生成 (OMPS 自动选词)
# ============================================
# 需要配置: SESSION_TOKEN 环境变量
POST {{BASE_URL}}/api/weaver/v2/generate
Cookie: next-auth.session-token={{SESSION_TOKEN}}
Content-Type: application/json
{
    "scenario": "team_meeting"
}

HTTP 200
[Asserts]
header "Content-Type" contains "text/event-stream"
