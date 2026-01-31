# Opus Testing Guide

## 1. Overview
Opus uses **Vitest** for unit and component testing. Our testing strategy focuses on "Core Mechanics First" (Tier 2/3) to ensure the educational effectiveness and system resilience.

## 2. Test Commands

| Command | Description |
| :--- | :--- |
| `npm test` | Run all tests (Backend + Frontend) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npx vitest run [path]` | Run specific test file |

## 3. Verified Core Mechanics (v1.8)
The following critical paths have been verified via automated tests:

### 3.1 Backend Logic (Ammo Depot)
| Component | Test File | Verified Logic |
| :--- | :--- | :--- |
| **Acquisition** | `actions/__tests__/get-next-drill.test.ts` | 30% Rescue / 50% Review / 20% New Protocol |
| **Phrase Mode** | `actions/__tests__/get-next-drill.test.ts` | Fast Path triggers for collocations (DB Priority) |
| **Plan B** | `actions/__tests__/get-next-drill.test.ts` | Cache Miss -> Deterministic Fallback + Emergency Replenish Trigger |
| **Memory System** | `actions/__tests__/record-outcome.test.ts` | FSRS State Transitions (New -> Learning -> Review) |
| **Scheduling** | `actions/__tests__/record-outcome.test.ts` | Interval Calculation (Easy vs Good) |
| **Resilience** | `workers/__tests__/drill-processor.test.ts` | LLM API Failure -> Job Failure (BullMQ Retry) |

### 3.2 Frontend Interactive Logic
| Component | Test File | Verified Logic |
| :--- | :--- | :--- |
| **Infinite Scroll** | `components/session/__tests__/session-runner.test.tsx` | Pre-fetch triggers when remaining <= 10 |
| **Session Loop** | `components/session/__tests__/session-runner.test.tsx` | Wrong Answer -> Requeued immediately (Queue Expansion) |
| **Progress Bar** | `components/session/__tests__/session-runner.test.tsx` | Dynamic percentage adjustment relative to loaded items |

## 4. Test Structure
```text
.
├── actions/
│   └── __tests__/           # Server Actions Logic (Acquisition, Grading)
├── workers/
│   └── __tests__/           # Background Job Logic (Drill Gen, Resilience)
├── components/
│   └── session/
│       └── __tests__/       # Client Logic (Session Runner, Interaction)
└── lib/
    └── __tests__/           # Utilities (FSRS, Algo)
```

## 5. Current Gaps (To Be Implemented)
*   **Audio Mode**: Python TTS Worker verification missing.
*   **Visual Trap**: Python Levenshtein generation missing.
*   **Weakness-Driven Dispatch**: Full five-dimension radar dispatch logic missing.

## 6. Best Practices
1.  **Mocking**: Use `vi.mock` aggressively for DB (`prisma`) and Server Actions when testing Components.
2.  **Environment**: Frontend tests require `/** @vitest-environment jsdom */` directive.
3.  **Isolation**: Ensure `vi.clearAllMocks()` is called in `beforeEach`.

## 7. L0 Scenario Verification (Phase 4)

To verify the quality and correctness of L0 prompts (SYNTAX, PHRASE, BLITZ), use the following commands:

| Command | Description |
| :--- | :--- |
| `npm run test:l0` | Run L0 Schema and Rule Assertion tests |
| `npm run eval:l0` | Run LLM evaluation and generate summary report |
| `npm run verify:l0` | **One-Click Regression**: Run both tests and evaluation |

### Acceptance Criteria
- **Unit Tests**: 0 failures (Schema + Rules)
- **LLM Eval**: Avg Score ≥ 7.0 (Check reports/baseline-l0-summary-*.md)
