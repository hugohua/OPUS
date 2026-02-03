# ============================================
# L1: TTS 生成端点测试
# ============================================
# 端点: POST /api/tts/generate
# 功能: 文字转语音生成 (调用 Python Worker)
# 架构: Next.js Brain → Python Voice Renderer
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input (JSON Body):
#   {
#     "text": string,         // 要转换的文本 (必需)
#     "voice": string,        // 语音类型: "alloy" | "echo" | "fable" | ...
#     "language": string      // 语言: "en" | "zh"
#   }
#
# Output (JSON Schema):
#   {
#     "success": boolean,
#     "url": string,          // 生成的音频 URL
#     "cached": boolean       // 是否命中缓存
#   }
#
# Error Response:
#   400: { "error": "Missing required field: text" }
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ============================================
# Test 1: 基础 TTS 生成 (Happy Path)
# ============================================
POST {{BASE_URL}}/api/tts/generate
Content-Type: application/json
{
    "text": "{{TEST_TTS_TEXT}}",
    "voice": "Cherry",
    "language": "en"
}

HTTP 200
[Captures]
audio_url: jsonpath "$.url"
is_cached: jsonpath "$.cached"
[Asserts]
# 1. Schema 验证
jsonpath "$.success" isBoolean
jsonpath "$.url" isString
jsonpath "$.cached" isBoolean

# 2. 业务逻辑验证
jsonpath "$.success" == true

# ============================================
# Test 2: 缓存命中测试 (相同请求)
# ============================================
POST {{BASE_URL}}/api/tts/generate
Content-Type: application/json
{
    "text": "{{TEST_TTS_TEXT}}",
    "voice": "Cherry",
    "language": "en"
}

HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.cached" == true

# ============================================
# Test 3: 缺少必需参数应返回 400
# ============================================
POST {{BASE_URL}}/api/tts/generate
Content-Type: application/json
{
    "voice": "Cherry"
}

HTTP 500
[Asserts]
jsonpath "$.error" exists
