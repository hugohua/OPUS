---
name: opus-aidot-test
description: OPUS Spec-First testing workflow. Use when adding API routes, Server Actions, backend shared core logic, FSRS algorithm changes, OMPS/session changes, or LLM prompt changes that need Hurl, Vitest, or eval specifications before implementation.
---
# 编写测试规格工作流 (Spec-First)

> **用途**: 为新功能创建测试规格文件  
> **触发场景**: 新增 API 端点、新增 Server Action、修改后端共享核心、修改核心逻辑

## 核心原则

> **先写测试规格，再写实现代码。**

后续默认采用 **后端共享核心** 测试分层：

- 可复用业务逻辑先写 `lib/backend-core/**/*.test.ts` 或既有共享 service 单测，覆盖核心行为。
- Web Server Action 测认证、用户一致性、Zod、`ActionState` 包装，不重复测试核心算法。
- H5/Mobile Route Handler 测 HTTP envelope、状态码、DTO 映射、鉴权，不重复测试 FSRS/OMPS。
- iOS Demo adapter 测消费端字段和 `fsrsPreview` 等扩展，不作为后端 schema 决策来源。
- 若 Web、H5、iOS 行为冲突，测试以 Web 合同为主源。

---

## 场景路由

### 场景 A: 新增 Route Handler (`app/api/...`)

**使用工具**: Hurl

**步骤**:
1. 确定端点路径和 HTTP 方法
2. 创建 Hurl 文件: `tests/l{1,2,3}-{feature}.hurl`
3. 遵循 **1-3-1 规则**:
   - 1 个 Happy Path (200 OK)
   - 3 个 Edge Cases (400, 401, 422)
   - 1 个 Logic Assertion
4. 获得用户确认
5. 创建 route.ts 实现

**共享核心约束**:
- Route Handler 不直接实现 FSRS、OMPS、Session batch、评分、状态写入、审计等业务规则。
- 业务规则必须通过 `lib/backend-core/**` 或既有共享 service 调用。
- Hurl/contract 测试只断言 envelope、HTTP 状态、DTO 稳定性和鉴权边界。

**Hurl 模板**:
```hurl
# ============================================
# L{Level}: {Feature Name}
# ============================================
# 端点: {METHOD} {URL}
# 功能: {Brief Description}
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 规格定义 (Specification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Input: { ... }
# Output: { "success": boolean, "data": { ... } }
# Error: 401 - Unauthorized
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Test 1: Happy Path
{METHOD} {{BASE_URL}}{URL}
Content-Type: application/json
{ ... }

HTTP 200
[Asserts]
jsonpath "$.success" == true

# Test 2: 无认证
{METHOD} {{BASE_URL}}{URL}

HTTP 401

# Test 3: 无效输入
{METHOD} {{BASE_URL}}{URL}
Content-Type: application/json
{ "invalid": "data" }

HTTP 400
```

---

### 场景 B: 新增 Server Action (`actions/...`)

**使用工具**: Vitest

**步骤**:
1. 创建测试文件: `actions/__tests__/{feature}.test.ts`
2. Mock 外部依赖 (Prisma, AI SDK)
3. 定义输入输出类型
4. 获得用户确认
5. 创建 Action 实现

**共享核心约束**:
- Server Action 不直接承载可复用业务规则；先创建或更新 `lib/backend-core/**` usecase。
- Action 单测只覆盖 `auth()`、用户一致性、Zod、`ActionState`、`revalidatePath` 等 Web 边界。
- 客户端需要的类型不得从 `"use server"` 模块导出；放到非 Server Action 模块并用 `import type`。

**Vitest 模板**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

vi.mock('server-only', () => ({}));

describe('{FeatureName} Action', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Happy Path', () => {
        it('should return expected result', async () => {
            // Arrange
            // Act
            // Assert
        });
    });

    describe('Edge Cases', () => {
        it('should handle invalid input', async () => {});
        it('should handle auth failure', async () => {});
    });
});
```

---

### 场景 C: 修改 FSRS 算法

**核心约束**: 必须验证状态转换

FSRS 变更必须优先落在共享核心测试中，例如 `lib/backend-core/session/**/__tests__`；Web、H5、iOS 只保留 adapter contract 测试。

**必须断言**:
1. `stability_new > stability_old`
2. `next_review > now`
3. `state` 转换正确 (Learning → Review)

```typescript
expect(result.stability).toBeGreaterThan(initialStability);
expect(result.nextReviewAt).toBeAfter(new Date());
expect(result.state).toBe('REVIEW');
```

### 场景 D: 修改后端共享核心 (`lib/backend-core/**`)

**使用工具**: Vitest

**步骤**:
1. 先写共享核心失败测试，固定 Web 合同行为。
2. 覆盖至少一个跨端复用入口：Web Action、Mobile/H5 adapter 或 Route Handler contract。
3. 实现核心 usecase，adapter 只做边界映射。
4. 回归相关 Web Action、Mobile/H5 route contract、共享核心测试。

**必须断言**:
- 业务结果与 Web 旧行为一致。
- iOS/H5 adapter 不复制核心规则，只调用共享核心。
- 输入验证复用 `lib/validations/**` 或同等 Zod schema。
- 关键写入仍保持事务、MASTERED 跳过、纯语法跳过、审计写入等数据完整性约束。

---

### 场景 E: 修改 LLM Prompt

**核心约束**: 必须建立质量基线

**步骤**:
1. 运行现有 Eval: `npm run verify:l0`
2. 记录当前分数
3. 修改 Prompt
4. 重新运行 Eval
5. 确认分数 ≥ 7.0

---

## 测试数据约定

| 数据类型 | 前缀 | 示例 |
|----------|------|------|
| 词汇 | `TEST_ARTIFACT_` | `TEST_ARTIFACT_budget` |
| 用户 ID | `test_user_hurl_` | `test_user_hurl_001` |
| Session | `test_session_` | `test_session_001` |

---

## 相关文档
- 测试宪法: `.agent/rules/testing-protocol.md`
- 运行测试: Antigravity `/run-hurl` workflow 或 Codex `$opus-run-hurl` skill
