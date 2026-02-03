# ============================================
# L1: Admin History 端点测试
# ============================================
# 端点: GET /api/admin/history
# 功能: 获取 Drill 生成历史记录 (Redis)
# 用途: Admin Dashboard 调试面板
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input (Query Params):
#   ?limit=50                 // 可选，默认 50
#   ?offset=0                 // 可选，分页偏移
#
# Output (JSON Schema):
#   {
#     "success": boolean,
#     "items": [
#       {
#         "id": string,       // Redis Key
#         "vocabId": number,
#         "word": string,
#         "mode": string,     // "SYNTAX" | "PHRASE" | "BLITZ"
#         "createdAt": string // ISO 时间戳
#       }
#     ],
#     "total": number         // 总记录数
#   }
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ============================================
# Test 1: 获取历史记录 (Happy Path)
# ============================================
GET {{BASE_URL}}/api/admin/history

HTTP 200
[Captures]
item_count: jsonpath "$.items" count
[Asserts]
# 1. Schema 验证
jsonpath "$.success" isBoolean
jsonpath "$.items" isCollection

# 2. 业务逻辑验证
jsonpath "$.success" == true

# ============================================
# Test 2: 带分页参数
# ============================================
GET {{BASE_URL}}/api/admin/history?limit=10&offset=0

HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.items" isCollection
