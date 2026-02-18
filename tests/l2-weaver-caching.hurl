# ============================================
# L2: Weaver Lab Caching & Persistence Test
# ============================================
# 覆盖: 
# 1. POST /generate (生成 + 缓存 + 持久化)
# 2. GET /article/[id] (持久化读取)
# 3. DELETE /article/[id] (删除)
#
# 依赖: 
# - SESSION_TOKEN (User Auth)
# - BASE_URL
# ============================================

# 1. 生成文章 (首次) -> 应该触发 LLM 生成并存库
POST {{BASE_URL}}/api/weaver/v2/generate
Cookie: next-auth.session-token={{SESSION_TOKEN}}
Content-Type: application/json
{
    "scenario": "test_caching_scenario",
    "density": "concise"
}

HTTP 200
[Asserts]
header "X-Weaver-Id" exists
header "Content-Type" contains "text/event-stream"
[Captures]
article_id: header "X-Weaver-Id"

# 2. 验证持久化 (立即读取) -> 应该返回 JSON 内容
GET {{BASE_URL}}/api/weaver/v2/article/{{article_id}}
Cookie: next-auth.session-token={{SESSION_TOKEN}}

HTTP 200
[Asserts]
jsonpath "$.content" exists
jsonpath "$.content" isString

# 3. 验证缓存防重 (重复请求) -> 应该返回相同的 ID (Cache Hit)
POST {{BASE_URL}}/api/weaver/v2/generate
Cookie: next-auth.session-token={{SESSION_TOKEN}}
Content-Type: application/json
{
    "scenario": "test_caching_scenario",
    "density": "concise"
}

HTTP 200
[Asserts]
header "X-Weaver-Id" == "{{article_id}}"

# 4. 删除文章
DELETE {{BASE_URL}}/api/weaver/v2/article/{{article_id}}
Cookie: next-auth.session-token={{SESSION_TOKEN}}

HTTP 200
[Asserts]
jsonpath "$.success" == true

# 5. 验证删除 (使用无效 ID)
GET {{BASE_URL}}/api/weaver/v2/article/{{article_id}}
Cookie: next-auth.session-token={{SESSION_TOKEN}}

HTTP 404
