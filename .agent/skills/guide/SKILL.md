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

## 🗺️ Feature Map

### 1. User Interface (UI/UX)
- **Rules**: `docs/ui-rules.md` (Design tokens, layout principles)
- **System**: `docs/dev-notes/unified-ui-system-v1.md` (Component library, Shadcn/Aceternity integration)
- **Slash Command**: Use `/ui-opus` to access UI guidelines quickly.

### 2. Drill Engine (Core Mechanic)
- **Implementation**: `docs/dev-notes/drill-engine-implementation.md` (The "Briefing" generation logic)
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
- **Testing**: `docs/dev-notes/TESTING.md` (Vitest setup, mocking rules)
- **Auth**: `docs/dev-notes/auth-system-and-infrastructure.md` (NextAuth/Clerk logic)

### 5. Text-to-Speech (TTS)
- **Architecture**: `docs/dev-notes/tts-architecture.md` (Service boundaries, Edge-TTS, caching strategy)
- **Setup**: `docs/dev-notes/tts-quickstart.md` (How to run the Python service & Docker)
- **Frontend Hook**: `hooks/use-tts.ts` (React interface for playback)

## 🚦 Decision Routing
- **If modifying the Card/Drill UI** -> Read `unified-ui-system-v1.md` AND `drill-engine-implementation.md`.
- **If changing how words are fetched** -> Read `omps-word-selection-engine.md` (选词) AND `context-selector-guide.md` (上下文).
- **If touching Worker/Queue/缓存生成逻辑** -> **必读** `cache-hit-rate-optimization.md`（理解生产端和消费端如何协作）.
- **If 发现缓存命中率低 / 大量兜底数据** -> 阅读 `cache-hit-rate-optimization.md` 排查选词逻辑是否一致.
- **If modifying Audio/Playback** -> Read `tts-architecture.md` (Architecture) AND `use-tts.ts` (Implementation).
- **If adding a new game mode** -> Check `technical-spec-phrase-mode.md` for inspiration on spec structure.
- **If DB schema changes** -> You MUST update `prisma/schema.prisma` AND run `npm run db:push` (or generate migration).
- **If adding vocabulary selection logic** -> You MUST use `fetchOMPSCandidates` from `lib/services/omps-core.ts`.

