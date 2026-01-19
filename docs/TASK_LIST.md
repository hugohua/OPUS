# 🚀 Opus Mobile (V3.0) Vibe Coding Master List

**Master Directive for LLM:**
You are building **Opus**, a **Mobile Workplace Simulator** for TOEIC preparation.

* **Mindset**: Don't build a "Reader". Build an "Inbox".
* **UI Strategy**: "Dumb" Frontend (Markdown Renderer) + "Smart" Backend (Prompt Engineering).
* **Tech Stack**: Next.js 14 (App Router), Prisma, pgvector, Shadcn UI (Mobile), Tailwind CSS.
* **Data Source**: All vocabulary metadata is pre-calculated via **Gemini ETL** (stored in DB).

---

## 🟢 Phase 0: Data Foundation (The Bedrock)

> **Goal**: Ensure the DB supports the "5-Dimensional" simulation before building UI.

* [x] **Task 0.1: Finalize Prisma Schema**
* **Status**: Done.
* **Context**: `Word` table includes `word_family` (JSON), `synonyms`, `priority`. `UserWordProgress` split into `v_score`, `c_score`, etc.


* [x] **Task 0.2: Enable pgvector**
* **Status**: Done.


* [ ] **Task 0.3: ETL Script (Enrichment)**
* **Instruction**: Create/Update `scripts/enrich-vocab.ts`.
* **CRITICAL UPDATE**:
1. **Model**: Use `google/gemini-2.0-flash-preview` (or 1.5 Flash).
2. **Prompt**: Use **Opus ETL Prompt v1.0** (Strict polysemy control).
3. **Config**: `temperature: 0.1`, `batch_size: 12`.


* **Logic**: Fetch raw words -> Call Gemini -> Save `vocab_enriched.json`.


* [ ] **Task 0.4: Database Seeding**
* **Instruction**: Create `prisma/seed.ts`.
* **Logic**: Read `vocab_enriched.json`. Upsert data into `Word` table.
* **Verify**: Ensure `word_family` (n/v/adj) and `confusing_words` are correctly populated.
* **Command**: `npx prisma db seed`.


* [ ] **Task 0.5: Vectorization Script**
* **Instruction**: Create `scripts/vectorize-vocab.ts`.
* **Logic**: Fetch words without embeddings. Generate embeddings using OpenAI `text-embedding-3-small`. Save to `Word.embedding`.
* **Why**: Required for finding contextually relevant words for the "1+N" engine.



---

## 🟡 Phase 1: Briefing Engine (The Brain)

> **Goal**: Refactor the old "Article Generator" into the new "Briefing Generator".

* [ ] **Task 1.1: Refactor `generateBriefing` Action** (Critical)
* **Status**: **Needs Refactor** (Old code generates Article string, we need Briefing JSON).
* **File**: `src/actions/generate-briefing.ts`
* **Input**: `userId`, `targetWord`.
* **Logic**:
1. Fetch Target Word + 3 Context Words (via Vector Search).
2. Select Dimension: **V** (Morphology) or **C** (Collocation) *[Start with these two for MVP]*.
3. Call LLM with **PRD V3.0 Prompt** (generate JSON with `segments`).


* **Output JSON**:
```typescript
{
  meta: { format: "email", sender: "HR" },
  segments: [
    { type: "intro", content_markdown: "..." },
    { type: "interaction", task: { style: "bubble_select", options: [...] } }
  ]
}

```




* [ ] **Task 1.2: Fallback Template (Safety Net)**
* **Instruction**: Create `src/lib/templates/fallback-briefing.ts`.
* **Logic**: A hardcoded "Meeting Reschedule" email JSON.
* **Usage**: If LLM API fails or times out (>3s), return this immediately to prevent UI crash.



---

## 🔵 Phase 2: Inbox & Briefing UI (The Body)

> **Goal**: "Thumb-Driven" Interface. No complex dashboards.

* [ ] **Task 2.1: The "Inbox" Stream (Home Page)**
* **File**: `src/app/page.tsx`
* **UI**: A Stack or Swiper view.
* **Logic**:
1. Fetch next `Briefing` on load.
2. Show Skeleton while loading.
3. Render current Briefing Card.
4. On complete -> Swipe animation -> Load next.




* [ ] **Task 2.2: Dumb Markdown Renderer**
* **File**: `src/components/briefing/markdown-renderer.tsx`
* **Tech**: `react-markdown`.
* **Styles**:
* `<mark>` -> `bg-yellow-500/20 text-yellow-200` (Signal words).
* `**bold**` -> `text-emerald-400 font-bold` (Target words).




* [ ] **Task 2.3: Unified Interaction Components**
* **File**: `src/components/briefing/interaction-zone.tsx`
* **Constraint**: All inputs must be in the **Bottom 30%** of the screen.
* **Components**:
* `SwipeChoice`: For V-Dim (Left/Right).
* `BubbleSelect`: For C-Dim (Floating chips).





---

## 🟣 Phase 3: The Simulation Loop (The Soul)

> **Goal**: Gamify the feedback.

* [ ] **Task 3.1: Record Interaction Action**
* **File**: `src/actions/record-outcome.ts`
* **Logic**:
1. Receive `wordId`, `dimension` (e.g., 'C'), `isCorrect`.
2. Update `UserWordProgress.${dimension}_score`.
3. Calculate new `next_review_at` (Simplified SRS).




* [ ] **Task 3.2: Feedback UI (Haptic & KPI)**
* **UI**: A subtle bottom sheet or toast after answering.
* **Copy**: "KPI Updated" (not "Correct"), "Performance Review Needed" (not "Wrong").
* **Tech**: Use `navigator.vibrate` for haptic feedback.



---

## ⚫ Phase 4: Expansion (Later)

* Task 4.1: X Dimension (Logic Insert)
* Task 4.2: Multi-Doc Dimension
* Task 4.3: Auth Integration