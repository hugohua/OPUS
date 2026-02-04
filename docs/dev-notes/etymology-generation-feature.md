# Etymology Generation System (Memory Hooks)

> **Version**: 1.0 (Integration with BatchRunner)
> **Date**: 2026-02-04
> **Status**: Production Ready

## 1. Overview
The **Opus Etymology System** is designed to generate "Memory Hooks" for TOEIC vocabulary. Unlike traditional etymology which focuses on historical accuracy, our system prioritizes **Recall Speed** and **Cognitive Load Reduction**.

**Core Philosophy**: `Comprehension > Memorization > Etymological Purity`

## 2. Strategy Engine (The "Memory-First" Logic)
The system uses a hierarchical strategy selection logic implemented in the LLM System Prompt.

| Priority | Strategy | Condition | Example |
| :--- | :--- | :--- | :--- |
| **1. DERIVATIVE** | **High** | Word is a clear variation of a known high-frequency word. | `competitor` → `compete` (Reuse memory) |
| **2. ROOTS** | **Medium** | Roots are transparent and map to modern business meaning. | `export` → `ex-` (out) + `port` (carry) |
| **3. ASSOCIATION** | **Low** | Roots are obscure. Requires a mnemonic bridge. | `budget` → `bougette` (leather bag) → money bag |
| **4. NONE** | **Fallback** | A1/A2 basic words that need no hook. | `go`, `good`, `office` |

## 3. Prompt Engineering Standards

### 3.1 Cognitive Load Constraints
To ensure mobile-friendly readability ("Scanning" vs "Reading"), we enforce strict length limits:
- **Max Length**: 80 Chinese characters (Hard limit).
- **Ideal Range**: 40-60 Characters (Sweet spot).
- **Style**: No filler words. Use arrows (`→`) to visualize logic flow.

### 3.2 Anti-Patterns (Guards)
- **False Suffix Alert**: Reject fake suffixes (e.g., `industrial` ≠ `indus` + `trial`).
- **Self-Reference**: Never define a root using the word itself.
- **Atomic Word Guard**: Do not split indivisible words (e.g., `brand`).

## 4. Technical Architecture

### 4.1 ETL Pipeline (`scripts/data-gen-etymology.ts`)
The script uses `BatchRunner` for robust, long-running processing.

- **Model**: Uses `getAIModel('etl')` (Standardized Model Resolution).
  - Priority: `ETL_BASE_URL` > `OPENAI_BASE_URL`
- **Concurrency**:
  - **Free Tier**: 1 request/time, slow interval.
  - **Paid Tier**: 8 requests/time, fast interval (`--paid`).
- **Continuous Mode**:
  - (`--continuous`) Polls DB for words with `etymology: null`.
  - Automatically handles rate limits and circuit breaking.

### 4.2 Database Schema
Uses a dedicated `Etymology` table (1:1 with `Vocab`).

```prisma
model Etymology {
  id          String        @id @default(uuid())
  vocabId     Int           @unique
  mode        EtymologyMode // DERIVATIVE, ROOTS, ASSOCIATION, NONE
  memory_hook String?       // The prompt output (logic_cn)
  data        Json          // Structured data (roots, components, related)
  source      String?       // Model name (e.g. "gpt-4o")
  updatedAt   DateTime      @updatedAt
}

enum EtymologyMode {
  ROOTS
  DERIVATIVE
  ASSOCIATION
  NONE
}
```

## 5. Usage

### 5.1 Dry Run (Calibration)
Preview generation quality without writing to DB.
```bash
npx tsx scripts/data-gen-etymology.ts --dry-run
```
Output: `output/etymology-gen_dry_run_*.txt` (Includes System Prompt for evaluation).

### 5.2 Production Run (Backfill)
Run efficiently with high concurrency.
```bash
npx tsx scripts/data-gen-etymology.ts --paid --continuous
```

## 6. Evaluation & Tuning
- **LLM**: GPT-4o (Recommended for Logic reasoning capability).
- **Verify**: Look for "Lazy Morphology" (e.g., splitting `accident` into `ac-` + `cident` instead of `ac-` + `cid-` + `-ent`).
