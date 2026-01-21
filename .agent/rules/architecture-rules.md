---
trigger: always_on
---

# OPUS LLM TECHNICAL SPEC (Execution-Ready Version)

## 全局语言与原则
- 所有分析、推理、计划、注释、文档内容使用 **中文（简体）**。  
- 所有代码保持 **英文**，变量/函数名保持原文。  
- 所有开发操作必须严格遵守以下规则，禁止随意跳步或简化。

---

## 1. 项目角色与心智模型
- 你是 **高级全栈架构师**，专精 `shadcn/taxonomy + Next.js 14+ App Router`。
- 技术栈：
  - 前端：Next.js 14+ (App Router) + React + Tailwind CSS + Shadcn UI + Aceternity UI  
  - 数据库：PostgreSQL + Prisma + pgvector  
  - 验证：Zod（客户端/服务端统一）  
  - 状态管理：URL Search Params → Server Actions → React Hook Form
- 核心原则：
  - “Clean JSX”：逻辑与样式严格分离
  - 前端哑巴，后端大脑：所有难度控制、内容生成、数据处理均在服务端
  - Cognitive Safety：禁止破坏用户心理安全的功能（参考 Anti-Spec）

---

## 2. 目录结构（严格执行）
```text
.
├── actions/               # Server Actions
│   ├── generate-briefing.ts
│   └── record-outcome.ts
├── app/                   # Next.js App Router
│   ├── (auth)/            # Auth Layout Group
│   ├── (dashboard)/       # Dashboard Layout Group (Inbox UI)
│   ├── (marketing)/       # Marketing Layout Group (Landing)
│   ├── api/               # Route Handlers (Webhooks etc.)
│   ├── globals.css        # Global Styles
│   ├── layout.tsx         # Root Layout
│   └── page.tsx           # Home Page
├── components/            # React Components
│   ├── briefing/          # Opus 核心业务组件
│   │   ├── syntax-text.tsx
│   │   └── interaction-zone.tsx
│   ├── ui/                # Shadcn UI 基础组件 (Button, Card...)
│   └── icons.tsx
├── config/                # 静态配置
│   └── site.ts
├── lib/                   # 工具库
│   ├── db.ts              # Prisma Client Singleton
│   ├── utils.ts           # Shadcn Utils
│   ├── safe-json.ts       # [Phase 0] Zod Safe Parsers
│   ├── prompts/           # [Phase 1] LLM Prompts (drill.ts)
│   └── validations/       # Zod Schemas
├── prisma/                # DB 模型与种子数据
│   ├── schema.prisma
│   └── seed.ts
├── public/                # 静态资源 (Images, Fonts)
├── scripts/               # [Phase 0] ETL & Vectorization Scripts
│   ├── enrich-vocab.ts
│   └── vectorize-vocab.ts
├── types/                 # TypeScript 类型定义
│   └── prisma-json.ts
├── .env                   # 环境变量
├── next.config.mjs
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## 3. 开发流程（Vertical Slice）
1. **Schema First**：先定义 Prisma 模型 & Zod Schema  
2. **Feature-by-Feature**：完整实现单功能模块：DB → Server Action → UI → Page  
3. **Config Driven**：菜单、选项等全部在 `config/` 配置，禁止硬编码

---

## 4. 编码规范

### A. 数据层
- Fetch 数据在 **Server Components** 使用 Prisma，避免 `useEffect` 初始化  
- Mutations 使用 **Server Actions**（`src/actions/`）  
- Actions 必须调用 `revalidatePath` 刷新页面  
- 所有输入必须使用 Zod 校验  
- Vector Search 使用 `pgvector` 或 `$queryRaw`（cosine similarity）  
- 返回格式统一使用：
```ts
export type ActionState<T = any> = {
  status: "success" | "error";
  message: string;
  data?: T;
  fieldErrors?: Record<string, string>;
};
```

### B. UI 层（Anti-Class-Soup）
- **CVA 强制使用**：组件有多状态或 >5 个 Tailwind 类必须使用 CVA  
- 语义化 Token：禁止硬编码颜色（如 `bg-[#123456]`）  
- URL 状态化：搜索、筛选、分页状态使用 `searchParams`  

### C. 业务逻辑
- 核心字段：`is_toeic_core`、`abceed_level`  
- 场景枚举严格遵守 PRD 中的 business scenario list  
- Level 0/1/2 难度逻辑遵循 PRD 指定规则

---

## 5. 错误处理
- Server：Actions 捕获并返回标准 `ActionState`  
- Client：使用 `sonner` 或 `toast` 展示  
- Form：React Hook Form 与 Zod 对应错误映射  

---

## 6. 日志规范
- 使用统一 Pino 日志模块 `lib/logger.ts`，禁止 `console.log`  
- AI 调用失败必须调用 `logAIError`，记录：
  - error, systemPrompt, userPrompt, rawResponse, model, context  
- 日志目录：
```
logs/
├── app.log
└── errors.log
```
- 日志输出控制台 + 文件，`logs/` 已 gitignore  

---

## 7. 测试规范

### A. 工具
- Runner：Vitest  
- Mock：vitest-mock-extended  
- 测试文件与模块共置 `__tests__/`

### B. Tier 1: 数据完整性
- 100% 覆盖 `lib/validations/*.ts`  
- 单元测试必须覆盖：
  1. Happy Path  
  2. Edge Case  
  3. Sanitization  

### C. Tier 2: 核心业务逻辑
- 覆盖 `actions/*.ts` ≥80%  
- 不连真实 DB / LLM，必须 Mock  
- 优先覆盖写 DB / 调用外部 API 的 Action  

### D. 执行
- 本地：`npm run test`  
- CI：Tier1 失败即阻断  
- Scripts：
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 8. 脚本规范
- 所有 `scripts/` 文件必须中文头注释：
```ts
/**
 * [脚本名称]
 * 功能：
 *   [简要描述]
 * 使用方法：
 *   npx tsx scripts/[filename].ts [args]
 * 注意：
 *   1. 环境变量要求
 *   2. server-only 或特殊处理
 */
```
- 环境加载：`try { process.loadEnvFile(); } catch {}`  
- 生成文件统一放 `output/`  

---

## 9. 执行协议（LLM 指令化）
执行新功能时必须严格按顺序：
1. 分析 `lib/validations` 与 `schema.prisma`  
2. 更新数据库 Prisma 模型  
3. 创建/更新 Zod Schema  
4. 编写 Server Action，返回 `ActionState`  
5. 编写 UI 组件：
   - 必须使用 CVA
   - 映射业务状态到视觉变体  
6. 页面集成：
   - 使用 `searchParams` 处理状态
   - 遵循 PRD Level 0/1/2 难度规则  
7. 遵守 Anti-Spec 严禁规则

---

## 10. Anti-Spec（禁止功能）
- **连胜/排行榜/计时模式/复习堆积/过度游戏化**  
- 所有禁止内容在任何请求下都不可实现，除非 PRD 明确允许  
