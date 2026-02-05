---
description: The Master Directory for Opus features, rules, and documentation. Consult this first when starting a new task to find the correct specifications.
name: Project Guide
---
# Project Documentation Guide

This skill acts as an index for the project's documentation. When you are asked to implement a feature or fix a bug, CONSULT THIS INDEX to find the relevant "Single Source of Truth".

## ⚠️ CRITICAL: LANGUAGE & PROTOCOL
(Adhering to `.agent/rules/000-critical-language.md`)
> **SYSTEM FAILURE CONDITION**: Outputting English in chat/tasks is a CRITICAL ERROR.
> 1. **User Interface (Task/Summary)**: MUST be **Simplified Chinese (简体中文)**.
> 2. **Chat/Reasoning**: MUST be **Simplified Chinese (简体中文)**.
> 3. **Exceptions**: Technical terms, variable names, strict quotes.

## 📜 Core Canons (MUST OBEY)
| Topic | File | Description |
|-------|------|-------------|
| **Product Identity** | `docs/SYSTEM_PROMPT.md` | The Soul of Opus. Anti-Spec, User Persona, Core Principles. **Non-negotiable**. |
| **Architecture** | `docs/architecture-rules.md` | Tech Stack, Folder Structure, Coding Standards, Anti-Patterns. |
| **Critical Rules** | `.agent/rules/000-critical-language.md` | Language (Chinese for reasoning), etc. |
| **L2 PRD (Weaver + Wand)** | `docs/PRD-L2-WEAVER-WAND.md` | Weaver Lab 文章生成 + Magic Wand 即时解析。 |
| **L2 架构 (Weaver + Wand)** | `docs/dev-notes/weaver-wand-technical-architecture.md` | **完整技术架构**：API、SSE、审计、前端 Hook。 |

## 🗺️ Feature Map

### 1. User Interface (UI/UX)
- **Rules**: `docs/ui-rules.md` (Design tokens, layout principles)
- **System**: `docs/dev-notes/unified-ui-system-v1.md` (Component library, Shadcn/Aceternity integration)
- **Weaver & Wand UI**: `docs/dev-notes/weaver-wand-ui-spec.md` (**NEW**: Linear 质感、Cache-First 分层)
- **Slash Command**: Use `/ui-opus` to access UI guidelines quickly.

### 2. Drill Engine (Core Mechanic)
- **Implementation**: `docs/dev-notes/drill-engine-implementation.md` (The "Briefing" generation logic)
- **Prompt Structure**: `docs/dev-notes/prompt-structure-v2.md` (**Standard V2 Output Specification**, 包含 Rich Option/Explanation 定义)
- **Word Selection (OMPS)**: `docs/dev-notes/omps-word-selection-engine.md` (**核心选词引擎**，所有场景必读)
- **Context Selection**: `docs/dev-notes/context-selector-guide.md` (How we pick words/sentences)
- **Vector Logic**: `docs/dev-notes/vector-context-selection-v2.md` (Embedding & Similarity rules)

### 3. Data & Inventory
- **Schema**: `prisma/schema.prisma` (The DB Source of Truth)
- **Phase 2 Architecture**: `docs/dev-notes/phase2-architecture-summary.md` (**New Standard**: Multi-Track & Zero-Wait)
- **Redis Inventory**: `docs/dev-notes/redis-inventory-schema.md` (Zero-Wait caching layer)
- **缓存与选词架构**: `docs/dev-notes/cache-hit-rate-optimization.md` (生产消费协作)
- **Phrase Mode**: `docs/dev-notes/technical-spec-phrase-mode.md` (Phrase Blitz specific specs)

### 4. Infrastructure & Testing
- **Testing Protocol**: `.agent/rules/testing-protocol.md` (**Spec-First 宪法**：Hurl + Vitest 混合策略)
- **Testing**: `docs/dev-notes/TESTING.md` (Vitest setup, mocking rules)
- **Test Overview**: `docs/dev-notes/test-architecture-overview.md` (**测试全景图**：覆盖地图 + Gap 分析)
- **Evaluation Matrix**: `docs/dev-notes/evaluation-matrix.md` (**三维评估体系**：Logic / Quality / Stability)
- **L0 Quality Assurance**: `docs/dev-notes/TESTING.md` (包含 Schema 校验、规则断言逻辑、LLM 评分基线)
- **Auth**: `docs/dev-notes/auth-system-and-infrastructure.md` (NextAuth/Clerk logic)

### 5. Text-to-Speech (TTS)
- **Architecture**: `docs/dev-notes/tts-architecture.md` (**Updated**: Database Indexed Caching, Python Atomic Write)
- **DB Indexing**: `docs/dev-notes/tts-db-schema-v6.md` (**New**: `TTSCache` Schema & GC Strategy)
- **Setup**: `docs/dev-notes/tts-quickstart.md` (How to run the Python service & Docker)
- **Frontend Hook**: `hooks/use-tts.ts` (React interface for playback)

### 6. SmartContent (AI 内容资产库)
- **Architecture**: `docs/dev-notes/smart-content-architecture.md` (**New**: 批量预生成策略)
- **Prompt**: `lib/generators/l2/smart-content.ts` (System/User Prompt 分离)
- **Server Action**: `actions/content-generator.ts` (Cache-First + Batch Generation)
- **Use Case**: Word Detail Page 的 ContextSnapshot 模块

### 7. Etymology System (Memory Hooks) (NEW)
- **Concept**: `docs/dev-notes/etymology-generation-feature.md` (**Memory-First** Strategy: Derivative > Roots > Association)
- **Implementation**: `scripts/data-gen-etymology.ts` (ETL Script with BatchRunner)
- **Schema**: `prisma/schema.prisma` (`Etymology` model & `EtymologyMode`)
- **UI**: `components/vocab/EtymologyCard.tsx`

### 7. SSE 流式处理 (Universal Streaming Utility)
- **Architecture**: `docs/dev-notes/sse-streaming-architecture.md` (**Standard**: OpenAI SDK + tuoye 模式)
- **Core Utility**: `lib/streaming/sse.ts` (统一的 `handleOpenAIStream` 工具)
- **Usage Guide**: `lib/streaming/README.md` (API 文档、前端集成示例)
- **Use Case**: WeaverLab (L3 故事生成)、未来的流式交互场景

### 8. L1 Audio Gym (听觉反射训练)
- **Implementation**: `docs/dev-notes/l1-audio-gym-implementation.md` (**Phase 4**: MVP 完整实现指南)
- **UI Components**: `components/drill/audio-drill-card.tsx`, `components/session/audio-session-runner.tsx`
- **Server Actions**: `actions/audio-session.ts` (Queue Fetch + FSRS Grading)
- **Testing**: `actions/__tests__/audio-session.test.ts` (Unit Tests), `tests/l1-tts-generate.hurl` (API Tests)

### 9. Panoramic Audit System (全景审计)
- **Architecture**: `docs/dev-notes/panoramic-audit-system.md` (**V5.1**: 核心价值链追踪)
- **Service**: `lib/services/audit-service.ts` (统一审计接口 + 环境变量开关)
- **Report Script**: `scripts/audit-report.ts` (健康检查报告)
- **Config**: `.env` (`AUDIT_ENABLED`, `AUDIT_SAMPLE_RATE`)


## 🚦 Decision Routing
- **If modifying the Card/Drill UI** -> Read `unified-ui-system-v1.md` AND `drill-engine-implementation.md`.
- **If changing how words are fetched** -> Read `omps-word-selection-engine.md` (选词) AND `context-selector-guide.md` (上下文).
- **If touching Worker/Queue/缓存生成逻辑** -> **必读** `cache-hit-rate-optimization.md`（理解生产端和消费端如何协作）.
- **If 发现缓存命中率低 / 大量兜底数据** -> 阅读 `cache-hit-rate-optimization.md` 排查选词逻辑是否一致.
- **If modifying Audio/Playback** -> Read `tts-architecture.md` (Architecture) AND `use-tts.ts` (Implementation).
- **If implementing L1 Audio Gym features** -> Read `l1-audio-gym-implementation.md` (**Phase 4 Complete Guide**).
- **If adding a new game mode** -> Check `technical-spec-phrase-mode.md` for inspiration on spec structure.
- **If DB schema changes** -> You MUST update `prisma/schema.prisma` AND run `npm run db:push` (or generate migration).
- **If modifying Prompts** -> You MUST run `npm run verify:l0` to ensure no regression in quality (Score >= 7.0).
- **If adding vocabulary selection logic** -> You MUST use `fetchOMPSCandidates` from `lib/services/omps-core.ts`.
- **If modifying AI 内容生成 (L2 例句等)** -> Read `smart-content-architecture.md` (批量生成策略).
- **If 实现新的流式 LLM 场景 (如对话、实时生成等)** -> Read `sse-streaming-architecture.md` (标准 SSE 工具) AND `lib/streaming/README.md` (API 使用).
- **If 新增 API 端点** -> **必须先创建** `.hurl` 规格文件 (See `.agent/rules/testing-protocol.md`).
- **If 新增 Server Action** -> **必须先创建** `.test.ts` 测试文件 (See `.agent/rules/testing-protocol.md`).
- **If 需要追踪算法行为 / 排查异常** -> Read `panoramic-audit-system.md` (审计服务) AND 运行 `npx tsx scripts/audit-report.ts`.
- **If 修改选词/评分/生成逻辑** -> **必须使用** `audit-service.ts` 中的埋点方法，而非直接操作 `DrillAudit` 表.

