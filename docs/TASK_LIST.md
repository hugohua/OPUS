# 📝 Opus v2.1 Migration Task List

Based on the Deep Dive Analysis of `PRDV2.md` and `dev-notes`.
**Core Goal**: Implement **Multi-Track FSRS** (Schema Upgrade) and **Integrate Components** (Python TTS, Vector Search).

## Phase 1: Database & Schema (Crucial)
This phase upgrades the data model to support independent FSRS tracks (Visual, Audio, Context).

- [ ] **Schema Upgrade**: Add `track` field to `UserProgress` and update Unique Key to `(userId, vocabId, track)`.
- [ ] **Migration Script**: Create migration to default existing records to `VISUAL` track.
- [ ] **Prisma Client**: Regenerate client (`prisma generate`).

## Phase 2: Logic Layer (The Wiring)
Refactor core services to respect the new `Track` dimension.

- [ ] **Action Update (`record-outcome.ts`)**:
    - [ ] Map `mode` to `track` (e.g., `SYNTAX` -> `VISUAL`, `AUDIO` -> `AUDIO`).
    - [ ] Update `upsert` logic to include `track`.
- [ ] **Selector Update (`omps-core.ts`)**:
    - [ ] Add `track` parameter to `fetchOMPSCandidates`.
    - [ ] Filter `UserProgress` by `track` when checking for due reviews.
- [ ] **Worker Update (`drill-processor.ts`)**:
    - [ ] Update `fetchDueCandidates` to query the correct track based on job `mode`.

## Phase 3: Integration (The Missing Pieces)
Connect the "lego blocks" (Python TTS, Vector Search, Client).

- [ ] **Python TTS Integration**:
    - [ ] Create `lib/services/tts-client.ts` (API Client for Python Service).
    - [ ] Implement `Task2Generator` (Audio) using `tts-client`.
- [ ] **Vector Search Integration**:
    - [ ] Create `lib/services/vector.ts` (if needed) or use existing `ContextSelector`.
    - [ ] Implement `Task3Generator` (Context) using `ContextSelector`.
- [ ] **Route Dispatcher**:
    - [ ] Update `actions/get-next-drill.ts` to dispatch to L0/L1/L2 generators based on mode.

## Phase 4: Verification
- [ ] **Integration Test**: Run a full L1 (Audio) session flow.

## Phase 5: Backlog (Deferred Items)
Tasks deferred from Drill Processor V2 Refactor (Smart Dispatch).

- [ ] **L1/L2 Generator Mapping**:
    - [ ] Explicitly map `AUDIO` mode to `Phrase` generator (with Audio hints).
    - [ ] Map `CHUNKING` mode to `Context` generator.
- [ ] **MIX Mode Aggregation**:
    - [ ] Implement parallel fetching from L0, L1, and L2 pools.
    - [ ] Define mixing ratio (e.g., 4:3:3).
- [ ] **Dashboard Link Fixes**:
    - [ ] Fix `Daily Blitz` card link to `/session/mix` (or correct implementation).
    - [ ] Update `Skill Gym` links (`Speed Run` -> `SYNTAX`, `Audio Gym` -> `AUDIO`).
