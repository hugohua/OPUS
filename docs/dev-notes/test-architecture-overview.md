# Opus 测试体系全景图 (Test Architecture Overview)

> 文档版本：v1.0
> 最后更新：2026-01-31
> 状态：Active
> **当前阶段：L0 链路打通 (L1/L2 尚未实现)**

## 🎯 当前聚焦：L0 场景矩阵

| 场景 | 模式 | 维度 | 交互 | 测试状态 |
|------|------|------|------|----------|
| **S-V-O 句法** | `SYNTAX` | V (Visual) | Swipe Card | ✅ 已覆盖 |
| **1+N 短语** | `PHRASE` | C (Context) | Bubble Select | ✅ 已覆盖 |
| **闪电战** | `BLITZ` | V (Visual) | Bubble Select | ✅ 已覆盖 |

> L1 (Chunking) / L2 (Context) 业务逻辑尚未实现，评估脚本已预留接口。

---

## 📊 全景统计

| 类别 | 数量 | 位置 |
|------|------|------|
| **Vitest Unit Tests** | 27 | `*/__tests__/*.test.ts(x)` |
| **Hurl API Tests** | 5 | `tests/l{1,2}-*.hurl` |
| **手动测试脚本** | 8 | `scripts/test-*.ts` |
| **LLM 评估脚本** | 2 | `scripts/eval*.ts` |
| **评估数据集** | 2 | `tests/evals/*.json` |

---

## 🔀 混合测试策略 (Hybrid Testing)

> 📋 完整规范见 `.agent/rules/testing-protocol.md`

### Spec-First 原则
```
禁止直接编写实现代码。必须先定义测试规格。
```

### 测试工具分层

| 组件类型 | 测试工具 | 开发顺序 |
|----------|----------|----------|
| **Route Handlers** | Hurl | 先写 `.hurl` → 再写 `route.ts` |
| **Server Actions** | Vitest | 先写 `.test.ts` → 再写 Action |
| **LLM Prompts** | Evals | 先定义基线 → 再改 Prompt |

### 测试层级

| 层级 | 名称 | 覆盖范围 | 触发时机 |
|------|------|----------|----------|
| **L1** | 防御层 | 认证、基础 CRUD | 每次 PR |
| **L2** | 进攻层 | 业务逻辑、AI 集成 | 每次 PR |
| **L3** | 规格层 | SSE 流、E2E | 发布前 |
| **Eval** | 质量层 | LLM 输出评分 | Prompt 变更 |

---

## 🗺️ 测试覆盖地图

### 1. 核心业务逻辑 (Tier 1 - 必须覆盖)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CORE MECHANICS                               │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ FSRS 状态机           │  actions/__tests__/record-outcome.test.ts │
│     - New → Learning → Review                                       │
│     - Grade 映射 (1-4)                                              │
│     - Interval 计算 (Easy > Good)                                   │
│     - Implicit Grading (Duration → Grade)                           │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ OMPS 选词引擎          │  lib/services/__tests__/omps-core.test.ts │
│     - 70/30 配比 (Review/New)                                       │
│     - 30/50/20 Arena (Rescue/Review/New) [V3]                       │
│     - 分层采样 (2简单 + 6核心 + 2困难)                                │
│     - excludeIds 过滤                                                │
│     - posFilter 词性过滤                                             │
│     - Rescue Queue + source 标记 [V3]                                │
│     - 协议预设 (Dojo/Arena) [V3]                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ 多轨隔离               │  actions/__tests__/multi-track.test.ts    │
│     - Track Isolation (VISUAL vs AUDIO)                              │
│     - OMPS Routing (按 Track 过滤)                                   │
│     - Default Track Fallback                                         │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ 无限流机制              │  components/session/__tests__/session-runner.test.tsx │
│     - Pre-fetch (remaining ≤ 10)                                     │
│     - Session Loop (错题重入队列)                                    │
│     - Progress Bar 动态计算                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. 数据获取层 (Tier 2 - 重要)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ 批量获取               │  actions/__tests__/get-next-drill.test.ts │
│     - 30/50/20 Protocol                                              │
│     - PHRASE Fast Path (DB 优先)                                     │
│     - Plan B 触发 (缓存击穿)                                          │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ 缓存层                 │  lib/__tests__/inventory.test.ts          │
│     - Redis Push/Pop                                                 │
│     - Inventory Counts                                               │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ Drill Cache            │  lib/__tests__/drill-cache.test.ts       │
│     - DB Fallback                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Worker 层 (Tier 3 - 后台任务)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WORKER LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ Drill Processor        │  workers/__tests__/drill-processor.test.ts │
│     - Safe JSON Parse (截断恢复)                                     │
│     - Smart Fetch (Plan A - 无 ID 新词获取)                          │
│     - Plan C (指定 vocabIds)                                         │
│     - Race Condition Fix (库存预检)                                  │
│     - LLM Failure → Job Failure (BullMQ Retry)                       │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ Drill Routing          │  workers/__tests__/drill-routing.test.ts  │
│     - Mode → Generator 映射                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. AI 层 (Tier 4)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           AI LAYER                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ AI Client              │  lib/ai/__tests__/client.test.ts          │
│  ✅ AI Utils               │  lib/ai/__tests__/utils.test.ts           │
│  ✅ Context Selector       │  lib/ai/__tests__/context-selector.test.ts│
│  ✅ Vocabulary AI          │  lib/ai/__tests__/VocabularyAIService.test.ts │
│  ✅ Article AI             │  lib/ai/__tests__/ArticleAIService.test.ts│
├─────────────────────────────────────────────────────────────────────┤
│  ✅ Validations            │  lib/validations/__tests__/ai.test.ts     │
│                            │  lib/validations/__tests__/article.test.ts│
└─────────────────────────────────────────────────────────────────────┘
```

### 5. 其他模块

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OTHER MODULES                                │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ Phrase Mode Algorithm  │  lib/algorithm/__tests__/phrase-mode.test.ts │
│  ✅ Inventory Queue        │  lib/queue/__tests__/inventory-queue.test.ts │
│  ✅ Word Selection Service │  lib/services/__tests__/WordSelectionService.test.ts │
│  ✅ Article Action         │  actions/__tests__/article.test.ts         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 手动测试脚本 (scripts/test-*.ts)

| 脚本 | 用途 | 运行方式 |
|------|------|----------|
| `test-engine.ts` | Drill Engine 端到端测试 | `npx tsx scripts/test-engine.ts` |
| `test-session-flow.ts` | Session 流程验证 | `npx tsx scripts/test-session-flow.ts` |
| `test-word-selection.ts` | 选词逻辑验证 | `npx tsx scripts/test-word-selection.ts` |
| `test-generate-briefing.ts` | Briefing 生成测试 | `npx tsx scripts/test-generate-briefing.ts` |
| `test-blitz-lib.ts` | Blitz 模式库测试 | `npx tsx scripts/test-blitz-lib.ts` |
| `test-article-generation.ts` | 文章生成测试 | `npx tsx scripts/test-article-generation.ts` |
| `test-openai-proxy.ts` | OpenAI 代理测试 | `npx tsx scripts/test-openai-proxy.ts` |
| `test-pos-fix.ts` | 词性修复测试 | `npx tsx scripts/test-pos-fix.ts` |

---

## 📝 LLM 评估体系 (scripts/eval*.ts)

| 脚本 | 用途 | 运行示例 |
|------|------|----------|
| `eval-prompts.ts` | 批量评测 + LLM 裁判 | `npx tsx scripts/eval-prompts.ts --mode L0_SYNTAX --judge ets-auditor` |
| `evaluate-context-quality.ts` | 上下文质量评估 | `npx tsx scripts/evaluate-context-quality.ts` |
| `generate-eval-samples.ts` | 样本生成 | `npx tsx scripts/generate-eval-samples.ts --level=0 --variant=blitz` |

**评估数据集**:
- `tests/evals/l0-syntax.json` - L0 Syntax 测试用例
- `tests/evals/l1-chunking.json` - L1 Chunking 测试用例

---

## ⚠️ Gap 分析 (缺失项)

### 🔴 高优先级 (P0)

| 缺失项 | 影响 | 建议 |
|--------|------|------|
| **依赖熔断测试** | L0 未掌握时可能推送 L1/L2 | 新增 `circuit-breaker.test.ts` |
| **混合流 Interleaving 测试** | 可能连续 10 题同类型 | 新增 ratio 校验用例 |

### 🟡 中优先级 (P1)

| 缺失项 | 影响 | 建议 |
|--------|------|------|
| **压力测试 (k6)** | 无法验证 1000 题稳定性 | 创建 `tests/load/` 目录 |
| **TTS 并发测试** | Python 服务可能堆积 | 新增 Python pytest |
| **五维雷达覆盖测试** | 只有 V/C 维度有测试 | 补充 A/M/X 维度 |

### 🟢 低优先级 (P2)

| 缺失项 | 影响 | 建议 |
|--------|------|------|
| **Admin Inspector** | 无人工审计入口 | 新增 Dashboard 页面 |
| **Bad Case 回流** | 无法持续改进 | 需 DB Schema 支持 |
| **E2E Browser Test** | 无完整用户流程测试 | Playwright 集成 |

---

## 🏃 快速运行指南

```bash
# 运行全部 Unit Tests
npm test

# 运行指定模块测试
npx vitest run actions/__tests__/

# 运行单个文件
npx vitest run lib/services/__tests__/omps-core.test.ts

# Watch 模式
npm run test:watch

# 覆盖率报告
npm run test:coverage

# LLM 评估 (修改 Prompt 后必跑)
npx tsx scripts/eval-prompts.ts --mode L0_SYNTAX --judge ets-auditor
```

---

## 📐 测试金字塔

```
                    ┌─────────┐
                    │ E2E     │  ← ⚠️ 缺失 (Playwright)
                    │ Browser │
                  ┌─┴─────────┴─┐
                  │ Integration │  ← ✅ multi-track.test.ts
                  │   Tests     │     (真实 DB + 多模块)
              ┌───┴─────────────┴───┐
              │    Unit Tests       │  ← ✅ 21 个文件
              │ (Mock + 隔离)        │
          ┌───┴─────────────────────┴───┐
          │       LLM Evaluation        │  ← ✅ eval-prompts.ts
          │   (AI 质量 + 规则校验)        │
      ┌───┴─────────────────────────────┴───┐
      │          Static Analysis            │  ← ✅ TypeScript + ESLint
      │       (类型检查 + Zod Schema)        │
      └─────────────────────────────────────┘
```

---

## 📚 相关文档

- [测试指南](./TESTING.md) - Vitest 配置、Mocking 规则
- [评估矩阵](./evaluation-matrix.md) - 三维评估体系 (Logic/Quality/Stability)
- [LLM 评估架构](./llm-eval-architecture.md) - AI 裁判员设计
