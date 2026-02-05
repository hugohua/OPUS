# ============================================
# L2: Weaver Lab FSRS 集成测试
# ============================================
# 端点: POST /api/weaver/v2/generate
# 功能: 基于 FSRS 队列生成沉浸式商务阅读材料 (SSE 流式)
# 安全: 需要认证 (session cookie)
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input (JSON Body):
#   {
#     "scenario": string,           // 必填: "finance" | "hr" | "marketing" | "rnd"
#     "target_word_ids": number[]?  // 可选: 手动指定目标词 ID，不传则 OMPS 自动装填
#   }
#
# Output (SSE Stream):
#   Content-Type: text/event-stream
#   
#   data: {"type": "content", "data": "The board has decided..."}
#   data: {"type": "content", "data": " to adopt a new strategy..."}
#   data: {"type": "done"}
#
# Error Response:
#   401: Unauthorized (无认证)
#   400: { "error": "Invalid scenario" }
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ============================================
# Test 1: 无认证访问应返回 401
# ============================================
POST {{BASE_URL}}/api/weaver/v2/generate
Content-Type: application/json
{
    "scenario": "finance"
}

HTTP 401

# ============================================
# Test 2: 自动装填模式 (OMPS 选词)
# ============================================
# 注意: 此测试需要手动配置 session cookie
#       取消注释并填入有效 token 后运行
#
# POST {{BASE_URL}}/api/weaver/v2/generate
# Content-Type: application/json
# Cookie: next-auth.session-token={{SESSION_TOKEN}}
# {
#     "scenario": "finance"
# }
# 
# HTTP 200
# [Asserts]
# header "Content-Type" contains "text/event-stream"

# ============================================
# Test 3: 手动指定目标词
# ============================================
# POST {{BASE_URL}}/api/weaver/v2/generate
# Content-Type: application/json
# Cookie: next-auth.session-token={{SESSION_TOKEN}}
# {
#     "scenario": "hr",
#     "target_word_ids": [101, 102, 103]
# }
# 
# HTTP 200
# [Asserts]
# header "Content-Type" contains "text/event-stream"

# ============================================
# Test 4: 无效场景应返回 400
# ============================================
# POST {{BASE_URL}}/api/weaver/v2/generate
# Content-Type: application/json
# Cookie: next-auth.session-token={{SESSION_TOKEN}}
# {
#     "scenario": "invalid_scenario"
# }
# 
# HTTP 400
