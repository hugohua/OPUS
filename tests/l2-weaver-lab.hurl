# ============================================
# L2: Weaver Lab 上下文生成测试
# ============================================
# 端点: POST /api/weaver/generate
# 功能: 生成沉浸式商务上下文故事 (SSE 流式)
# 安全: 需要认证 (session cookie)
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input (JSON Body):
#   {
#     "targetWords": string[],  // 目标词汇列表 (1-5个)
#     "scenario": string,       // 场景: "business meeting" | "email" | ...
#     "difficulty": number?     // 可选，难度 1-3
#   }
#
# Output (SSE Stream):
#   Content-Type: text/event-stream
#   
#   data: {"type": "chunk", "content": "..."}
#   data: {"type": "chunk", "content": "..."}
#   data: {"type": "done", "wordCount": 150}
#
# Error Response:
#   401: Unauthorized (无认证)
#   400: { "error": "Invalid input" }
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ============================================
# Test 1: 无认证访问应返回 401
# ============================================
POST {{BASE_URL}}/api/weaver/generate
Content-Type: application/json
{
    "targetWords": ["TEST_abandon", "TEST_schedule"],
    "scenario": "business meeting"
}

HTTP 401

# ============================================
# Test 2: SSE 流式响应测试 (需要有效 session)
# ============================================
# 注意: 此测试需要手动配置 session cookie
#       取消注释并填入有效 token 后运行
#
# POST {{BASE_URL}}/api/weaver/generate
# Content-Type: application/json
# Cookie: next-auth.session-token={{SESSION_TOKEN}}
# {
#     "targetWords": ["TEST_abandon", "TEST_schedule"],
#     "scenario": "business meeting"
# }
# 
# HTTP 200
# [Asserts]
# header "Content-Type" contains "text/event-stream"
