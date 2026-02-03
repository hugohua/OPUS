# Opus 测试规范规则 v2.0 (Testing Protocol Constitution)

> **优先级**: CRITICAL  
> **生效范围**: 全项目  
> **最后更新**: 2026-02-02  
> **对齐版本**: PRD v2.1 (AI-Native Architecture)

---

## 0. 核心理念

> **验证的不仅是代码，而是业务价值。**

本规则定义了 Opus 项目的 **Spec-First 开发协议**、**FSRS 算法完整性** 和 **LLM 质量保障**。

---

## 1. Spec-First 原则 (Prime Directive)

> **禁止直接编写实现代码。必须先定义测试规格。**

### A. Route Handlers (`app/api/...`) → 使用 Hurl

**开发顺序**:
1. **阅读上下文**: PRD 或验收标准
2. **起草规格**: 遵循 **1-3-1 规则**
   - 1 个 Happy Path (200 OK) - 严格 Schema 校验
   - 3 个 Edge Cases (400 无效输入, 401 认证, 422 业务逻辑)
   - 1 个 Logic Assertion (如 FSRS 间隔增长)
3. **Mock 验证**: 创建 dummy route.ts 通过 Hurl
4. **实现**: 只有此时才写真正的逻辑

### B. Server Actions (`actions/...`) → 使用 Vitest

1. 先创建 `actions/__tests__/{feature}.test.ts`
2. Mock 所有外部依赖 (Database, OpenAI)
3. 获得确认后再实现 Action

---

## 2. 核心价值验证协议 (CRITICAL)

### 🧠 FSRS 算法完整性

当触碰任何与 Review/Drill 相关的代码时 (`lib/fsrs`, `actions/record-outcome`):

**约束**: 必须验证 **状态转换 (State Transition)**

**测试要求**: 测试必须断言 'Good' 评分导致:
1. ✅ **稳定性增加**: `stability_new > stability_old`
2. ✅ **间隔增加**: `next_review > now`
3. ✅ **状态正确转换**: `Learning → Review`

```typescript
// 示例断言
expect(result.stability).toBeGreaterThan(initialStability);
expect(result.nextReviewAt).toBeAfter(new Date());
expect(result.state).toBe('REVIEW');
```

---

### 🤖 LLM 质量保障

当触碰 Weaver Lab 或 Drive Mode (`lib/ai`, `app/api/weaver`):

**约束**: 所有 LLM 调用必须支持 `process.env.AI_MOCK_MODE`

**Mock 模式**: 
```typescript
if (process.env.AI_MOCK_MODE === 'true') {
  return GOLDEN_DATA; // 返回确定性 JSON，不调用 OpenAI
}
```

**输出验证**: **必须** 使用 Zod 验证 LLM JSON 输出。永不盲信模型。

```typescript
const result = LLMOutputSchema.safeParse(response);
if (!result.success) {
  throw new ValidationError('LLM output failed schema validation');
}
```

---

## 3. 混合测试策略 (Hybrid Testing)

| 组件类型 | 测试工具 | 文件位置 |
|----------|----------|----------|
| **Route Handlers** | Hurl | `tests/l{1,2,3}-*.hurl` |
| **Server Actions** | Vitest | `actions/__tests__/*.test.ts` |
| **FSRS Algorithm** | Vitest | `lib/fsrs/__tests__/*.test.ts` |
| **LLM Prompts** | Evals | `tests/evals/*.ts` |
| **Python TTS** | pytest | `python_tts_service/tests/` |

### 测试层级

| 层级 | 名称 | 覆盖范围 | 触发时机 |
|------|------|----------|----------|
| **L1** | 防御层 | 认证、基础 CRUD | 每次 PR |
| **L2** | 进攻层 | 业务逻辑、AI 集成 | 每次 PR |
| **L3** | 规格层 | SSE 流、E2E | 发布前 |
| **Eval** | 质量层 | LLM 输出评分 ≥ 7.0 | Prompt 变更 |

---

## 4. 数据与环境卫生

### 测试数据前缀

| 数据类型 | 前缀规则 | 示例 |
|----------|----------|------|
| 用户 ID | `test_user_{tool}_*` | `test_user_hurl_001` |
| 词汇 | `TEST_ARTIFACT_` | `TEST_ARTIFACT_budget` |
| Session | `test_session_*` | `test_session_001` |

**清理假设**: 假设存在清理脚本会清除这些记录，无需担心创建。

### 代码卫生

- ❌ **禁止 console.log**: 生产代码必须使用 `createLogger`
- ✅ **使用结构化日志**: `log.info({ userId, mode }, 'message')`

---

## 5. Hurl 规格标准

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
```

---

## 6. 技术栈上下文

| 组件 | 技术 |
|------|------|
| **Framework** | Next.js 14+ (App Router) |
| **Database** | PostgreSQL + Prisma |
| **Testing** | Hurl (集成), Vitest (单元) |
| **Validation** | Zod |
| **AI SDK** | Vercel AI SDK (`ai`, `@ai-sdk/openai`) |

---

## 7. 决策路由 (Kick-off Protocol)

当用户请求功能时，先分析：

> **"这是否影响 FSRS 状态或 LLM 生成？"**

| 答案 | 行动 |
|------|------|
| **是** | 先规划验证策略 (Hurl 断言 or Evals)，再编码 |
| **否** | 按标准 Spec-First 流程进行 |

### 具体路由

| 场景 | 问题 | 行动 |
|------|------|------|
| 修改 FSRS 参数 | 间隔计算是否变化？ | 先写 Hurl 验证间隔增长断言 |
| 修改 LLM Prompt | 输出质量是否稳定？ | 先跑 Eval 建立基线 |
| 新增 API 端点 | 是否有认证需求？ | 先写 1-3-1 Hurl 规格 |
| 修改选词逻辑 | 是否影响 OMPS？ | 先更新 omps-core.test.ts |

---

## 8. 违规处理

| 违规行为 | 后果 |
|----------|------|
| 直接编写实现无规格 | PR 拒绝 |
| FSRS 修改无状态转换测试 | PR 拒绝 |
| LLM 调用无 Mock Mode | PR 拒绝 |
| 测试数据无 `TEST_` 前缀 | 要求修正 |
| 使用 console.log | 要求替换为 logger |

---

## 相关文档

| 文档 | 用途 |
|------|------|
| [`docs/PRDV2.md`](../docs/PRDV2.md) | 产品架构定义 |
| [`docs/dev-notes/test-architecture-overview.md`](../docs/dev-notes/test-architecture-overview.md) | 测试全景图 |
| [`docs/dev-notes/evaluation-matrix.md`](../docs/dev-notes/evaluation-matrix.md) | 三维评估体系 |
| [`tests/README.md`](../tests/README.md) | Hurl 运行指南 |
