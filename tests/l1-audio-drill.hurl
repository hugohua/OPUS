# ============================================
# L1: Audio Gym Drill Generation Specification
# ============================================
# Endpoint: POST /api/cron/prefetch
# Function: Trigger background generation for AUDIO mode
# Validation: Check if drills are generated and structure matches BRIEFING V2
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Scenario 1: Prefetch AUDIO drills
# --------------------------------------------
POST {{BASE_URL}}/api/cron/prefetch
Authorization: Bearer {{CRON_SECRET}}
Content-Type: application/json
{
    "userId": "{{TEST_USER_ID}}", 
    "mode": "AUDIO",
    "limit": 1,
    "force": true
}

HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.count" > 0
# Check payload structure checks will be done by unit tests, 
# here we just verify the integration flow works without error.
