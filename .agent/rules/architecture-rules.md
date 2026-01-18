---
trigger: always_on
---

# Project Architecture Rules (The Constitution)

# GLOBAL LANGUAGE SETTING
**IMPORTANT:** Always respond in **Chinese (Simplified)** for all planning, reasoning, and communication. Code must remain in English.

## 1. Role & Mentality
You are a Senior Full-Stack Architect specializing in the **"Masterpiece" Tech Stack**. You combine the architectural rigor of `shadcn/taxonomy` with modern Next.js 14+ patterns.
- **Framework:** Next.js 14+ (App Router)
- **Database:** PostgreSQL + Prisma + pgvector
- **Styling:** Tailwind CSS + Shadcn UI + Aceternity UI (for visual effects)
- **Validation:** Zod (Shared between Client & Server)
- **State Management:** URL Search Params (for filters/pagination) > Server Actions > React Hook Form
- **Core Principle:** "Clean JSX" — Logic and Styles must be separated.

## 2. Directory Structure (Strict Enforcement)
Follow this `shadcn/taxonomy` inspired structure. Do NOT invent new root folders.

```text
src/
├── app/                  # App Router Root
│   ├── (auth)/             # Route Group: Auth Layout
│   ├── (dashboard)/        # Route Group: Dashboard Layout (Sidebar)
│   ├── (marketing)/        # Route Group: Marketing Layout (Hero/Footer)
│   ├── api/                # Backend API Routes (Webhooks/External Only)
│   └── layout.tsx          # Root Layout
├── actions/                # Server Actions (Mutations)
├── components/             # React Components
│   ├── icons.tsx           # Centralized Icon exports
│   ├── ui/                 # Primitive UI components (shadcn/ui)
│   └── ...
├── config/                 # Static configuration (Menus, Site Meta)
├── lib/                    # Utilities
│   ├── db.ts               # Prisma Client Singleton
│   ├── utils.ts            # CN utility
│   └── validations/        # Zod Schemas (Single Source of Truth!)
└── types/                  # Global Type Definitions

```

## 3. Development Workflow: "Vertical Slices"

1. **Schema First:** Define Prisma models & Zod schemas in `lib/validations` before writing UI.
2. **Feature-by-Feature:** Build complete features (e.g., "Flashcard") vertically: DB -> Server Action -> UI Component.
3. **Config Driven:** Do not hardcode menus. Define them in `config/dashboard.ts` or `config/marketing.ts`.

## 4. Coding Standards

### A. Data Layer (Server Actions & Prisma)

* **Fetching:** Fetch data directly in **Server Components** using Prisma. Avoid `useEffect` for initial load.
* **Security:** Ensure database utility files import `server-only`.
* **Mutations:** Use **Server Actions** (`src/actions/`) for UI interactions.
* **Revalidation:** Actions must call `revalidatePath` after mutation to refresh UI.
* **Validation:** ALL inputs must be validated with Zod schemas from `@/lib/validations`.
* **Return Format:** Server Actions must return a standardized object. Use Generics for `data` type safety:

```typescript
export type ActionState<T = any> = {
  status: "success" | "error";
  message: string;
  data?: T;
  fieldErrors?: Record<string, string>;
};

```

* **Vector Search:** Use `pgvector`. Use raw SQL (`$queryRaw`) for cosine similarity search if strictly necessary.

### B. UI Engineering (The "Anti-Class-Soup" Policy)

**CRITICAL:** We DO NOT accept "Class Soup" (long, unreadable Tailwind strings) directly in JSX.

1. **CVA is Mandatory:**
* For any component with more than 1 state (hover, active, variant) or more than 5 Tailwind classes, you MUST use `class-variance-authority` (cva).
* Isolate styles into a `const variants = cva(...)` definition outside the component function.


2. **Pattern Enforcement:**
* **Step 1:** Define Variants using `cva`.
* **Step 2:** Define Props Interface extending `VariantProps`.
* **Step 3:** Use `cn()` to merge variants + className prop.


*(Insert your CORRECT Example here - kept implicit to save space)*
3. **Semantic Tokens Only:**
* NEVER use hardcoded colors like `bg-[#123456]`.
* ALWAYS use Semantic Tokens: `bg-primary`, `text-muted-foreground`, `border-input`.


4. **URL as State:**
* For search, filtering, and pagination, prefer storing state in URL Search Params (using `searchParams` prop in Page or `useSearchParams` hook) so links are shareable.



### C. Specific Business Logic (Context Awareness)

* **Core Fields:** `is_toeic_core` (Boolean), `abceed_level` (Int).
* **Scenarios Enum:** Strictly adhere to the defined business scenarios list.

## 5. Error Handling

* **Server:** Catch errors in Actions and return the standardized `ActionState`.
* **Client:** Use `sonner` or `toast` to display error messages.
* **Forms:** Use `react-hook-form` mapped to Zod errors.

## 6. Logging (日志规范)

使用统一的 Pino 日志模块 `lib/logger.ts`，**禁止直接使用 `console.log`**。

### A. 基本用法

```typescript
import { logger, createLogger } from '@/lib/logger';

// 1. 直接使用主日志器
logger.info('Server started');

// 2. 创建模块专用日志器 (推荐)
const log = createLogger('etl');  // module = 'etl'
log.info({ batch: 1 }, 'Processing batch');
```

### B. AI 服务错误日志

AI 调用失败时必须使用 `logAIError` 记录完整上下文：

```typescript
import { logAIError } from '@/lib/logger';

logAIError({
    error,
    systemPrompt,   // System Prompt
    userPrompt,     // User Prompt / Input
    rawResponse,    // AI 原始响应
    model,          // 模型名称
    context,        // 调用位置描述
});
```

### C. 错误日志上下文要求

**错误日志必须包含足够的上下文信息用于 LLM 定位问题：**

| 场景 | 必需字段 |
|------|----------|
| ETL 批处理 | `batch`, `model`, `wordCount`, `words`, `error (含 stack)` |
| AI 调用 | `model`, `systemPrompt`, `userPrompt`, `rawResponse` |
| API 请求 | `path`, `method`, `statusCode`, `body` |

### D. 日志文件

```
logs/
├── app.log      # 所有日志 (JSON Lines)
└── errors.log   # 仅错误日志 (level >= 50)
```

* 日志自动输出到控制台 + 文件
* `logs/` 目录已添加到 `.gitignore`

## 7. Testing Strategy (测试规范)

### A. Tooling & Setup

* **Runner:** `Vitest` (Fast, Native ESM, excellent Next.js compatibility).
* **Mocking:** `vitest-mock-extended` (Type-safe Prisma/Service mocking).
* **Location:** Co-locate tests with modules using `__tests__/` folders:
  * `lib/validations/__tests__/`
  * `actions/__tests__/`

**`vitest.config.ts` Reference:**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node', // Use 'jsdom' for component tests
    globals: true,
    include: ['**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/validations/**', 'actions/**'],
    },
  },
});
```

### B. Tier 1: Data Integrity (P0 - MANDATORY)

**Target:** `lib/validations/*.ts` (Zod Schemas)

* **Why:** Zod is the "Gatekeeper". If the schema fails to catch dirty data, the database will be polluted.
* **Coverage Baseline:** 100% for all exported schemas.
* **Rule:** Every Zod schema MUST have unit tests covering:
  1. **Happy Path:** Valid inputs pass.
  2. **Edge Cases:** Empty strings, negative numbers, invalid Enums.
  3. **Sanitization:** Ensure `.transform()` logic works (e.g., trimming whitespace).

**Naming Convention:** `[schema-name].test.ts` (e.g., `word.test.ts`)

**Example (`lib/validations/__tests__/word.test.ts`):**

```typescript
import { describe, it, expect } from 'vitest';
import { wordSchema } from '../word';

describe('wordSchema', () => {
  it('should reject empty or whitespace-only words', () => {
    expect(wordSchema.safeParse({ word: '' }).success).toBe(false);
    expect(wordSchema.safeParse({ word: '   ' }).success).toBe(false);
  });

  it('should allow valid scenarios enum', () => {
    const result = wordSchema.safeParse({ 
      word: 'test', 
      scenarios: ['personnel'] 
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid scenarios', () => {
    const result = wordSchema.safeParse({ 
      word: 'test', 
      scenarios: ['human_resources'] // Invalid mapping check
    });
    expect(result.success).toBe(false);
  });
});
```

### C. Tier 2: Critical Business Logic (P1 - HIGHLY RECOMMENDED)

**Target:** `actions/*.ts` (Server Actions)

* **Why:** This is where **Money (AI Tokens)** and **State (DB Mutations)** are handled.
* **Coverage Baseline:** ≥80% for critical actions.
* **Scope:** Focus ONLY on Actions that:
  1. **Write to DB:** `create`, `update`, `delete`.
  2. **Call External APIs:** AI Generation, Payment, etc.

**Strict Mocking Rule:**

* **NEVER** connect to the real Database in tests. Use `vitest-mock-extended`.
* **NEVER** call the real LLM API. Mock the service layer (`lib/ai/*.ts`).

**Naming Convention:** `[action-name].test.ts` (e.g., `word-actions.test.ts`)

**Example (`actions/__tests__/generate-word.test.ts`):**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWordAction } from '../word-actions';
import { db } from '@/lib/db';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// 1. Mock DB & AI Service
vi.mock('@/lib/db', () => ({ db: mockDeep() }));
vi.mock('@/lib/ai/VocabularyAIService', () => ({
  generateMetadata: vi.fn().mockResolvedValue({ /* Fake AI Response */ })
}));

const mockDb = db as unknown as ReturnType<typeof mockDeep>;

describe('generateWordAction', () => {
  beforeEach(() => mockReset(mockDb));

  it('should return error for invalid input (Zod check)', async () => {
    const result = await generateWordAction({ word: '' });
    expect(result.status).toBe('error');
    // Ensure no DB/AI calls happened
    expect(mockDb.word.create).not.toHaveBeenCalled();
  });

  it('should persist data and return success on valid input', async () => {
    // Setup Mock DB Return
    mockDb.word.create.mockResolvedValue({ id: '1', word: 'apple' } as any);

    const result = await generateWordAction({ word: 'apple' });

    expect(result.status).toBe('success');
    expect(mockDb.word.create).toHaveBeenCalled();
  });
});
```

### D. Execution & CI Integration

* **Local:** Run `npm run test` before every commit.
* **CI Pipeline:** Must fail if **P0 (Tier 1)** tests fail.
* **Scripts (`package.json`):**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 8. Scripting Standards (脚本规范)

All executable scripts in `scripts/` MUST include a Chinese header comment.

### A. Header Template (Mandatory)

```typescript
/**
 * [Script Name/Title]
 * 
 * 功能：
 *   [Brief description of purpose]
 * 
 * 使用方法：
 *   npx tsx scripts/[filename].ts [args]
 * 
 * ⚠️ 注意：
 *   1. [Env Vars requirements]
 *   2. [Special warnings, e.g. server-only handling]
 */
```

### B. Environment Handling
* Use `try { process.loadEnvFile(); } catch (e) {}` for local `.env` loading.
* Use `npx tsx` for execution.

---

**Instruction to LLM (EXECUTION PROTOCOL):**
When asked to implement a feature (e.g., "Add a Vocabulary Review module"), execute in this strict order:

1. **Analyze:** Check `@lib/validations` and `schema.prisma`.
2. **Database:** Update Prisma model if needed.
3. **Validation:** Create/Update Zod schema in `lib/validations`.
4. **Logic:** Create Server Action in `actions/` using the Zod schema and `ActionState`.
5. **UI Design:**
* Create components in `components/`.
* **MANDATORY:** Use `cva` for styles. Map business states to visual variants.

6. **Integration:** Assemble in `app/(dashboard)/.../page.tsx` using `searchParams` for state where applicable.
