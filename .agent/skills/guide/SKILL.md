---
description: The Master Directory for Opus features, rules, and documentation. Consult this first when starting a new task to find the correct specifications.
name: Project Guide
---
# Project Documentation Guide

This skill acts as an index for the project's documentation. When you are asked to implement a feature or fix a bug, CONSULT THIS INDEX to find the relevant "Single Source of Truth".

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
- **Context Selection**: `docs/dev-notes/context-selector-guide.md` (How we pick words/sentences)
- **Vector Logic**: `docs/dev-notes/vector-context-selection-v2.md` (Embedding & Similarity rules)

### 3. Data & Inventory
- **Schema**: `prisma/schema.prisma` (The DB Source of Truth)
- **Redis Inventory**: `docs/dev-notes/redis-inventory-schema.md` (Zero-Wait caching layer)
- **Phrase Mode**: `docs/dev-notes/technical-spec-phrase-mode.md` (Phrase Blitz specific specs)

### 4. Infrastructure & Testing
- **Testing**: `docs/dev-notes/TESTING.md` (Vitest setup, mocking rules)
- **Auth**: `docs/dev-notes/auth-system-and-infrastructure.md` (NextAuth/Clerk logic)

## 🚦 Decision Routing
- **If modifying the Card/Drill UI** -> Read `unified-ui-system-v1.md` AND `drill-engine-implementation.md`.
- **If changing how words are fetched** -> Read `context-selector-guide.md`.
- **If adding a new game mode** -> Check `technical-spec-phrase-mode.md` for inspiration on spec structure.
- **If DB schema changes** -> You MUST update `prisma/schema.prisma` AND run `npm run db:push` (or generate migration).
