---
name: opus-guide
description: OPUS project documentation index and task routing guide. Use before starting OPUS work to find source-of-truth docs, including backend shared core rules for Web/H5/iOS reusable business logic.
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
| **Backend Shared Core** | `lib/backend-core/**` + relevant PRD/dev-notes | Web 合同优先；可复用业务逻辑必须沉入后端共享核心，Web/H5/iOS 只做 adapter。 |
| **L2 PRD (Weaver + Wand)** | `docs/PRD-L2-WEAVER-WAND.md` | Weaver Lab 文章生成 + Magic Wand 即时解析。 |
| **L2 架构 (Weaver + Wand)** | `docs/dev-notes/weaver-wand-technical-architecture.md` | **v2.1 技术架构**：4 层瀑布选词、Density 控制、幻觉检测、审计。 |

## 🧠 Backend Shared Core Rule (MUST OBEY)

后续开发默认采用 **后端共享核心** 架构：

- Web 端现有业务逻辑是主合同；若 Web、H5、iOS 行为不一致，除非用户另有明确要求，按 Web 端修正核心与 API。
- 可复用业务规则必须优先抽到 `lib/backend-core/**`，包括 FSRS、OMPS、Session batch、评分、状态写入、审计、用户策略读取等。
- `actions/**` 只保留 Web 边界职责：`auth()`、用户一致性校验、Zod 输入、`ActionState` 包装、`revalidatePath`。
- `app/api/**` Route Handler 只保留 HTTP 边界职责：认证、envelope、DTO 映射、状态码。
- `lib/mobile/**` 和未来 H5 adapter 只做消费端适配：DTO、`fsrsPreview`、iOS/H5 envelope；不得复制 FSRS/OMPS/选词/状态规则。
- iOS 当前视为 Demo consumer；Swift model 只能作为消费端适配参考，不能反向决定后端 schema 或削弱 Web payload 合同。
- Type-only 定义不得从 `"use server"` 模块导出给客户端；共享类型放到非 Server Action 模块。

## 🗺️ Feature Map

### 1. User Interface (UI/UX)
- **Rules**: `docs/ui-rules.md` (Design tokens, layout principles)
- **System**: `docs/dev-notes/unified-ui-system-v1.md` (Component library, Shadcn/Aceternity integration)
- **Header Top Navigation**: `docs/dev-notes/header-ux-guidelines.md` (**NEW**: Global Fusion vs. Immersive Focus 空间槽位、滚动及避坑规范)
- **Weaver & Wand UI**: `docs/dev-notes/weaver-wand-ui-spec.md` (**v2.0**: 组件架构重构、Zinc Glassmorphism、Config-Driven)
- **Weaver Config**: `config/weaver-scenarios.ts` (场景 UI 配置) + `lib/constants/weaver-scenario-map.ts` (6→21 DB 标签映射) + `lib/constants/weaver-density.ts` (Density 枚举)
- **中文化术语规范**: `docs/dev-notes/ui-localization-terminology.md` (**NEW**: 全站翻译一致性标准)
- **Workflow / Skill**: Use `/ui-opus` in Antigravity or `$opus-ui` in Codex to access UI guidelines quickly.

### 2. Drill Engine (Core Mechanic)
- **Implementation**: `docs/dev-notes/drill-engine-implementation.md` (The "Briefing" generation logic)
- **Prompt Structure**: `docs/dev-notes/prompt-structure-v2.md` (**Standard V2 Output Specification**, 包含 Rich Option/Explanation 定义)
- **全模式链路参考**: `docs/dev-notes/drill-mode-options-audit.md` (**NEW**: 8 种 Drill 模式的完整 生成→存储→消费→渲染 链路、Options V2 双格式规范、Fallback 策略、Renderer 映射)
- **L0 Syntax Generator**: `lib/generators/l0/syntax.ts` (**Source of Truth**: S-V-O 公式、Slot-Based Explanation、挖空算法)
- **Word Selection (OMPS)**: `docs/dev-notes/omps-word-selection-engine.md` (**核心选词引擎**，所有场景必读)
- **Context Selection**: `docs/dev-notes/context-selector-guide.md` (How we pick words/sentences)
- **Vector Logic**: `docs/dev-notes/vector-context-selection-v2.md` (Embedding & Similarity rules)
- **新增全新题型 (End-to-End) 开发指南**: `docs/dev-notes/new-drill-mode-end-to-end-guide.md` (**NEW**: 涵盖新增任意答题类型的 8 步全栈 Checklist)
- **Arena 架构解密**: `docs/dev-notes/arena-mode-integration-guide.md` (特指竞技场数据流与 O(1) 兜底)
- **Adaptive Diagnostic Engine**: `docs/dev-notes/adaptive-diagnostic-engine.md` (**NEW**: V7.0 自适应诊断引擎：遥测、加权选词与降维打击)
- **Grammar Skill Tree**: `docs/PRD-GRAMMAR-SKILL-TREE.md` (**NEW**: L1-L3 语法诊断树，BKT 算法与靶向出题)
- **Backend Shared Core**: `lib/backend-core/session/**` (Session 共享 usecase；Web Action、H5 Route Handler、iOS API 必须复用同一核心)

### 3. Data & Inventory
- **Schema**: `prisma/schema.prisma` (The DB Source of Truth)
- **Vocab ETL Pipeline**: `docs/dev-notes/vocab-metadata-etl-pipeline.md` (**NEW**: 从 Abceed/PDF 到包含所有释义/音标/价值分的元数据清洗、补全自动化流水线与 4 个核心脚本的顺序)
- **Mixed Mode Architecture**: `docs/dev-notes/mixed-mode-architecture.md` (**NEW**: L0/L1/L2 混合模式、Stability 场景选择、批量操作)
- **Phase 2 Architecture**: `docs/dev-notes/phase2-architecture-summary.md` (Multi-Track & Zero-Wait)
- **Redis Inventory**: `docs/dev-notes/redis-inventory-schema.md` (Zero-Wait caching layer, **V2.1**: Batch Operations)
- **缓存与选词架构**: `docs/dev-notes/cache-hit-rate-optimization.md` (生产消费协作)
- **Phrase Mode**: `docs/dev-notes/technical-spec-phrase-mode.md` (Phrase Blitz specific specs)

### 4. Infrastructure & Testing
- **Unified AI Architecture**: `docs/dev-notes/ai-service-architecture.md` (**Core**: `lib/ai/core.ts` Facade, Failover Strategy)
- **Testing Protocol**: `.agent/rules/testing-protocol.md` (**Spec-First 宪法**：Hurl + Vitest 混合策略)
- **Testing**: `docs/dev-notes/TESTING.md` (Vitest setup, mocking rules)
- **Test Overview**: `docs/dev-notes/test-architecture-overview.md` (**测试全景图**：覆盖地图 + Gap 分析)
- **Evaluation Matrix**: `docs/dev-notes/evaluation-matrix.md` (**三维评估体系**：Logic / Quality / Stability)
- **L0 Quality Assurance**: `docs/dev-notes/TESTING.md` (包含 Schema 校验、规则断言逻辑、LLM 评分基线)
- **Auth**: `docs/dev-notes/auth-system-and-infrastructure.md` (NextAuth/Clerk logic)
- **PWA 配置**: `docs/dev-notes/pwa-configuration.md` (**Serwist**: Service Worker、Manifest、iOS 安装支持)

### 5. Text-to-Speech (TTS)
- **Architecture**: `docs/dev-notes/tts-architecture.md` (**Updated**: Database Indexed Caching, Python Atomic Write)
- **DB Indexing**: `docs/dev-notes/tts-db-schema-v6.md` (**New**: `TTSCache` Schema & GC Strategy)
- **Setup**: `docs/dev-notes/tts-quickstart.md` (How to run the Python service & Docker)
- **Audio Preload Strategy**: `docs/dev-notes/audio-preload-architecture.md` (**New**: Zero-Wait Generic Hook, Debounce, Cache Synergy)
- **Edge-TTS 离线批量生成**: `docs/dev-notes/edge-tts-offline-generation.md` (**New**: 两步工作流、断点续传、DB 直写、声音映射)
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

### 10. Grammar Skill Tree (L1-L3) (**NEW**)
- **Architecture & Schema**: `docs/dev-notes/grammar-skill-tree-architecture.md` (L1-L3 概念树、双重锚点、Restrict 保护)
- **BKT Algorithm & Telemetry**: `docs/dev-notes/bkt-telemetry-algorithm.md` (隐马尔可夫平滑更新、降维打击与向上穿透机制)
- **Frontend & Zero-Wait SSR**: `docs/dev-notes/arena-dashboard-frontend.md` (`app/dashboard/arena/page.tsx` 重构、SVG 雷达图弹流渲染)
- **Quick Drill Engine**: `docs/dev-notes/quick-drill-engine.md` (`get-next-drill.ts` 旁路兜底策略、全栈参数穿透链路)

### 10. NAS 部署 (Synology)
- **部署指南**: `docs/dev-notes/nas-deployment-guide.md` (**完整**: 架构、一键部署、数据库迁移、网络踩坑)
- **构建脚本**: `build-and-export.sh` (Mac ARM → NAS AMD64 跨平台构建 + 自动部署)
- **NAS Compose**: `docker-compose.nas.yml` (预构建镜像 + 绑定挂载)
- **Nginx 配置**: `nginx/nginx.conf` (反向代理、静态缓存、音频直出)

### 11. TOEIC PDF ETL Pipeline (题库数据导入)
- **Architecture**: `docs/dev-notes/toeic-pdf-etl-pipeline.md` (**NEW**: OCR 提取 + 结构化入库 + XML-Mode Prompt + QuestionType 枚举完整定义)
- **OCR Script**: `scripts/ocr_pdf_to_text.py` (PyMuPDF + Vision API + 并发 + 断点续传)
- **Seeding Script**: `scripts/seed-from-pdf.ts` (Gemini ETL + Zod 校验 + 原生 Worker Pool 并发)
- **ETL Prompt**: `lib/generators/etl/part5-seed-prompt.ts` (XML-Mode + 6-Enum 决策树 + 自检步骤)
- **Schema**: `QuestionSeed` in `prisma/schema.prisma` (含 `originalNumber`, `passageContext`, `QuestionType` 枚举完整定义)


- **If implementing Mixed Mode / L0_MIXED / L1_MIXED / DAILY_BLITZ** -> Read `mixed-mode-architecture.md` (**Stability 阈值、Track 隔离、批量操作**).
- **If modifying Server Actions, Route Handlers, Mobile/H5 APIs, FSRS, OMPS, Session batch, outcome recording, or shared settings** -> first check whether the behavior belongs in `lib/backend-core/**`; adapters must not duplicate business rules.
- **If modifying the Card/Drill UI** -> Read `unified-ui-system-v1.md` AND `drill-engine-implementation.md`.
- **If changing how words are fetched** -> Read `omps-word-selection-engine.md` (选词) AND `context-selector-guide.md` (上下文).
- **If touching Worker/Queue/缓存生成逻辑** -> **必读** `cache-hit-rate-optimization.md`（理解生产端和消费端如何协作）.
- **If discovering low cache hits / many fallbacks** -> Read `cache-hit-rate-optimization.md`.
- **If modifying Audio/Playback** -> Read `tts-architecture.md` and `use-tts.ts`.
- **If 需要离线批量预生成音频 / 扩展 Edge-TTS** -> Read `edge-tts-offline-generation.md` (**两步工作流、声音映射、断点续传**).
- **If implementing L1 Audio Gym features** -> Read `l1-audio-gym-implementation.md`.
- **If 修改 Prompt 模板 / options 格式 / Renderer / Fallback** -> **必读** `drill-mode-options-audit.md`（8 种模式全链路参考、V2 双格式规范、兼容消费模式）.
- **If adding a new game mode / answer type** -> **CRITICAL**: Read `new-drill-mode-end-to-end-guide.md` for the 8-step full-stack checklist.
- **If 修改语法结构树 / BKT 追踪 / Arena 靶向出题** -> Read `docs/PRD-GRAMMAR-SKILL-TREE.md`.
- **If DB schema changes** -> Update `prisma/schema.prisma` AND run `npm run db:push` (or generate migration).
- **If 处理 TOEIC PDF 数据 / 修改题库导入 / QuestionSeed 相关** -> Read `toeic-pdf-etl-pipeline.md` (**ETL 全流程、QuestionType 枚举、Prompt 设计规范**).
- **If modifying Prompts** -> You MUST run `npm run verify:l0` to ensure no regression in quality (Score >= 7.0).
- **If adding vocabulary selection logic** -> You MUST use `fetchOMPSCandidates` from `lib/services/omps-core.ts` (**注意**: Weaver 使用独立的 4 层瀑布选词，见 `actions/weaver-selection.ts`).
- **If 修改 Weaver Lab 选词/场景/密度** -> Read `weaver-wand-technical-architecture.md` (v2.1) AND `weaver-wand-ui-spec.md` (v2.0).
- **If 新增 Weaver 场景** -> Update `lib/constants/weaver-scenario-map.ts` (DB 映射) + `config/weaver-scenarios.ts` (UI 配置) + `lib/generators/l2/weaver-context.ts` (Prompt 上下文).
- **If modifying AI 内容生成 (L2 例句等)** -> Read `smart-content-architecture.md` (批量生成策略).
- **If 实现新的流式 LLM 场景 (如对话、实时生成等)** -> Read `sse-streaming-architecture.md` (标准 SSE 工具) AND `lib/streaming/README.md` (API 使用).
- **If 新增 API 端点** -> **必须先创建** `.hurl` 规格文件 (See `.agent/rules/testing-protocol.md`).
- **If 新增 Server Action** -> **必须先创建** `.test.ts` 测试文件 (See `.agent/rules/testing-protocol.md`).
- **If 需要追踪算法行为 / 排查异常** -> Read `panoramic-audit-system.md` (审计服务) AND 运行 `npx tsx scripts/audit-report.ts`.
- **If 修改选词/评分/生成逻辑** -> **必须使用** `audit-service.ts` 中的埋点方法，而非直接操作 `DrillAudit` 表.
- **If 部署到 NAS / 修改 Docker 配置 / 排查部署问题** -> Read `nas-deployment-guide.md` (**完整踩坑记录**).
- **If 修改 PWA 配置 / Service Worker / Manifest / 图标** -> Read `pwa-configuration.md` (**Serwist 缓存策略、构建注意事项**).
