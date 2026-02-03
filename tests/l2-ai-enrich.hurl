# ============================================
# L2: AI Enrich 词汇增强测试
# ============================================
# 端点: POST /api/ai/enrich
# 功能: 批量增强词汇数据 (定义、例句、搭配等)
# 用途: ETL Pipeline / Admin 工具
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input (JSON Body):
#   {
#     "inputs": [
#       {
#         "word": string,           // 目标单词
#         "def_en": string          // 英文定义 (必需)
#       }
#     ]
#   }
#
# Output (JSON Schema):
#   {
#     "status": "success" | "error",
#     "data": [
#       {
#         "word": string,
#         "definition_cn": string,
#         "commonExample": string,
#         "collocations": [...]
#       }
#     ]
#   }
#
# Error Response:
#   400: { "status": "error", "message": "..." }
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ============================================
# Test 1: 基础增强请求 (Happy Path)
# ============================================
POST {{BASE_URL}}/api/ai/enrich
Content-Type: application/json
{
    "inputs": [
        {
            "word": "TEST_strategy",
            "def_en": "a plan of action designed to achieve a long-term goal"
        }
    ]
}

HTTP 200
[Captures]
enriched_data: jsonpath "$.data"
[Asserts]
# 1. Schema 验证
jsonpath "$.status" isString
jsonpath "$.data" isCollection

# 2. 业务逻辑验证
jsonpath "$.status" == "success"

# ============================================
# Test 2: 缺少 inputs 字段应返回 400
# ============================================
POST {{BASE_URL}}/api/ai/enrich
Content-Type: application/json
{
    "invalid": "data"
}

HTTP 400
[Asserts]
jsonpath "$.status" == "error"

# ============================================
# Test 3: 缺少 def_en 应返回 400
# ============================================
POST {{BASE_URL}}/api/ai/enrich
Content-Type: application/json
{
    "inputs": [
        {
            "word": "TEST_strategy"
        }
    ]
}

HTTP 400
[Asserts]
jsonpath "$.status" == "error"
