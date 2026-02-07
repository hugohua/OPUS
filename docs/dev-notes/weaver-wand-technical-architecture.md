# Weaver Lab & Magic Wand - 技术架构文档

> **版本**: v2.0  
> **最后更新**: 2026-02-05  
> **状态**: ✅ 完成 (Phase 1-4 + Code Review 修复)

---

## 📋 概述

Weaver Lab 与 Magic Wand 是 Opus L2 Track 的核心功能模块，实现了基于 FSRS 队列的沉浸式商务阅读材料生成（Weaver）和即时词汇解析（Magic Wand）。

**核心价值**:
- **Zero-Wait**: 流式生成 + 缓存优先，无阻塞体验
- **AI-Native**: LLM 驱动的内容生成 + 智能选词
- **Fail-Safe**: 完整的错误处理和兜底机制
- **Audit-Ready**: 全链路审计埋点，支持行为分析

---

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌────────────────┐         ┌──────────────────┐            │
│  │ WeaverConsole  │────────▶│ ArticleReader    │            │
│  │ (选词界面)      │         │ (SSE 流式渲染)    │            │
│  └────────────────┘         └──────────────────┘            │
│         │                            │                       │
│         │ useSSEStream Hook          │ MagicWandSheet       │
│         ▼                            ▼                       │
└─────────┼────────────────────────────┼───────────────────────┘
          │                            │
┌─────────┼────────────────────────────┼───────────────────────┐
│         │        Backend (Next.js)   │                       │
│  ┌──────▼────────┐          ┌────────▼────────┐             │
│  │ Weaver V2 API │          │ Magic Wand API  │             │
│  │ /api/weaver/  │          │ /api/wand/word  │             │
│  │ v2/generate   │          │                 │             │
│  └───────────────┘          └─────────────────┘             │
│         │                            │                       │
│         │ handleOpenAIStream         │ Cache-First          │
│         ▼                            ▼                       │
│  ┌──────────────┐          ┌─────────────────┐              │
│  │ SSE Streaming│          │ Vocab Lookup    │              │
│  │ (OpenAI SDK) │          │ (Prisma)        │              │
│  └──────────────┘          └─────────────────┘              │
│         │                            │                       │
│         │ onComplete                 │                       │
│         ▼                            ▼                       │
│  ┌────────────────────────────────────────┐                 │
│  │      Audit Service (Fire-and-Forget)   │                 │
│  │  • WEAVER:SELECTION                    │                 │
│  │  • WAND:LOOKUP                         │                 │
│  └────────────────────────────────────────┘                 │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────┐                                            │
│  │  DrillAudit │ (Prisma)                                   │
│  └─────────────┘                                            │
└────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Layer (PostgreSQL + Redis)                 │
│  • Vocab (词汇库)                                            │
│  • UserProgress (FSRS 状态)                                  │
│  • DrillAudit (审计日志)                                     │
│  • Redis Cache (Weaver Ingredients)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 核心模块

### 1. Weaver Lab (文章生成)

#### 1.1 API 端点

**路径**: `POST /api/weaver/v2/generate`

**输入** (Zod Schema: `WeaverV2InputSchema`):
```typescript
{
  scenario: "finance" | "product_launch" | "team_meeting" | ...,
  target_word_ids?: number[] // 可选，手动指定词汇
}
```

**输出**: SSE Stream
```typescript
data: {"type":"content","data":"Hello"}
data: {"type":"content","data":" world"}
data: {"type":"done"}
```

#### 1.2 智能装填逻辑 (Server Action)

**文件**: `actions/weaver-selection.ts`

**流程**:
1. **Redis 缓存检查** (`weaver:ingredients:{userId}:{scenario}`)
2. **OMPS 选词** (Priority Queue):
   - `fetchOMPSCandidates(userId, 10, { reviewRatio: 0.8 }, [], "CONTEXT")`
   - 80% Due 词 + 20% New 词
3. **Filler Queue** (补充词汇):
   - 从 `UserProgress` 查询 L2 Track 高频词
   - 限制 5 个

**缓存策略**:
- TTL: 5 分钟
- Key Format: `weaver:ingredients:{userId}:{scenario}`

#### 1.3 LLM Prompt 生成

**文件**: `lib/generators/l2/weaver-context.ts`

**System Prompt**:
```
你是商务英语教练。根据场景 ({scenario}) 生成 200-250 词文章。
要求：
- 自然融入目标词汇（加粗）
- 符合商务场景语境
- 难度适配 L2 水平
```

**User Prompt**:
```
场景: {scenario}
目标词汇: negotiate, stakeholder, ...
生成文章，目标词加粗。
```

#### 1.4 FSRS 记录

**触发时机**: `onComplete` 回调

**实现**:
```typescript
await Promise.all(candidates.map(c =>
    recordOutcome({
        userId,
        vocabId: c.id,
        grade: 1, // Again (曝光)
        mode: "CONTEXT",
        track: "CONTEXT"
    })
));
```

---

### 2. Magic Wand (即时查词)

#### 2.1 API 端点

**路径**: `GET /api/wand/word`

**查询参数**:
```typescript
{
  word: string,        // 目标词汇
  context_id?: string  // 可选，上下文 ID
}
```

**输出** (Zod Schema: `WandWordOutputSchema`):
```typescript
{
  word: string,
  phonetic: string,
  definition_cn: string,
  definition_en: string,
  example_sentences: string[],
  collocations: string[],
  difficulty_level: number,
  frequency_score: number,
  ai_insight?: {
    etymology: string,
    usage_tips: string[]
  }
}
```

#### 2.2 Cache-First 策略

**查询逻辑**:
```typescript
// 1. 本地 Vocab 表查询
const vocab = await prisma.vocab.findFirst({
    where: { word: { equals: word, mode: 'insensitive' } },
    select: { /* ... */ }
});

// 2. 如果未找到，返回 404（未来可扩展为 LLM 生成）
```

#### 2.3 前端集成

**组件**: `components/wand/MagicWandSheet.tsx`

**触发方式**:
- 点击 `ArticleReader` 中的高亮词汇
- 打开 Bottom Sheet，显示词汇详情

**UI 分层**:
- **Layer 1**: Local DNA (实线边框，0ms 响应)
- **Layer 2**: AI Context (虚线边框，呼吸动画，异步加载)

---

### 3. SSE 流式处理

#### 3.1 后端实现

**核心文件**: `lib/streaming/sse.ts`

**函数**: `handleOpenAIStream(messages, options)`

**特性**:
- ✅ 单例 OpenAI 客户端
- ✅ 标准 SSE 格式 `{type, data}`
- ✅ Try-Catch 错误处理 + Client Disconnect 检测
- ✅ `onComplete` 回调支持（Await Promise）

**关键代码**:
```typescript
try {
    controller.enqueue(encoder.encode(sseData));
} catch (err) {
    console.warn(`Client disconnected during stream`);
    return; // 优雅退出
}
```

#### 3.2 前端 Hook

**文件**: `hooks/use-sse-stream.ts`

**函数**: `useSSEStream(options)`

**特性**:
- ✅ AbortController 超时保护 (60s)
- ✅ 精确依赖管理 (`onComplete`, `onError`)
- ✅ 错误状态管理

**用法**:
```typescript
const { text, isLoading, error, startStream } = useSSEStream({
    onComplete: (text) => console.log('Done:', text.length),
    onError: (err) => console.error('Error:', err)
});

startStream('/api/weaver/v2/generate', { scenario: 'finance' });
```

---

### 4. 审计系统 (Panoramic Audit)

#### 4.1 新增审计类型

**扩展**: `lib/services/audit-service.ts`

```typescript
type AuditContextMode =
    | 'OMPS:SELECTION'
    | 'FSRS:TRANSITION'
    | 'WEAVER:SELECTION' // ✅ 新增
    | 'WAND:LOOKUP'      // ✅ 新增
    | ...
```

#### 4.2 Weaver Selection 审计

**函数**: `auditWeaverSelection(userId, scenario, inputs)`

**记录内容**:
```typescript
{
  targetWord: "WEAVER:FINANCE",
  contextMode: "WEAVER:SELECTION",
  userId: "xxx",
  payload: {
    context: { scenario: "finance" },
    decision: {
      priorityCount: 8,
      fillerCount: 5,
      priorityIds: [1, 2, ...],
      fillerIds: [10, 11, ...]
    }
  },
  auditTags: ["weaver_starved"] // 如果 priorityCount === 0
}
```

#### 4.3 Wand Lookup 审计

**函数**: `auditWandLookup(userId, word, contextId, result)`

**记录内容**:
```typescript
{
  targetWord: "negotiate", // ✅ 限制 100 字符
  contextMode: "WAND:LOOKUP",
  userId: "xxx",
  payload: {
    context: { contextId: "gen_123" },
    decision: { vocabId: 42, found: true }
  },
  auditTags: ["contextual_lookup"] // 如果有 contextId
}
```

#### 4.4 安全保护

**校验逻辑**:
```typescript
// ✅ User ID 校验
if (!userId || userId.trim() === '') {
    log.warn('[AuditService] Invalid userId, skipping audit');
    return;
}

// ✅ 词汇长度限制
const sanitizedWord = word.trim().slice(0, 100);
```

---

## 🧪 测试策略

### API 测试 (Hurl)

**文件**:
- `tests/l2-weaver-fsrs.hurl` - Weaver V2 API 完整规格
- `tests/l2-magic-wand.hurl` - Magic Wand API 完整规格

**覆盖场景**:
- 认证测试 (401 Unauthorized)
- 输入验证 (400 Bad Request)
- 正常流程 (200 OK)
- 边界条件 (空词汇库、未登录)

### 单元测试 (Vitest)

**文件**: `actions/__tests__/weaver-selection.test.ts`

**覆盖场景**:
- Redis Cache Hit
- Redis Cache Miss + OMPS 调用
- 审计埋点验证
- 错误处理

---

## 🎨 UI/UX 规范

### 主题支持

**文件**: `components/providers.tsx`

```tsx
<SessionProvider>
    <NextThemesProvider {...props}>
        {children}
    </NextThemesProvider>
</SessionProvider>
```

### Weaver Console

**组件**: `components/weaver/WeaverConsole.tsx`

**特性**:
- Scenario 选择器 (Tabs)
- Priority Queue 展示 (Badge 显示数量)
- "Initialize Weaver" 按钮
- Linear 质感设计

### Article Reader

**组件**: `components/weaver/ArticleReader.tsx`

**特性**:
- ✅ 流式打字机效果
- ✅ 目标词高亮（Indigo 下划线）
- ✅ 点击触发 Magic Wand
- ✅ 错误状态 UI + 重试按钮
- ✅ Loading State (Progress Bar)
- ✅ Empty State

### Magic Wand Sheet

**组件**: `components/wand/MagicWandSheet.tsx`

**特性**:
- Bottom Sheet (Shadcn UI)
- Layer 1: Local DNA (实线边框)
- Layer 2: AI Context (虚线边框 + 呼吸动画)
- 词源、搭配、例句展示

---

## 🔒 安全与校验

### 认证保护

**所有 API 端点**:
```typescript
const session = await auth();
if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
}
```

### 输入校验

**Zod Schema**:
- `WeaverV2InputSchema` - Weaver 输入
- `WandWordOutputSchema` - Wand 输出
- `AIInsightSchema` - AI 洞察

### 错误处理

**层级**:
1. **API 层**: Try-Catch + Zod 校验
2. **SSE 层**: Stream Error Event `{type: 'error'}`
3. **前端层**: Error State UI + 重试机制

---

## 📈 性能优化

### 缓存策略

| 层级 | 策略 | TTL |
|------|------|-----|
| Weaver Ingredients | Redis | 5 分钟 |
| Vocab Lookup | Prisma 查询优化 | N/A |
| SSE Stream | 无缓存（实时生成） | N/A |

### 并发优化

**FSRS 记录**:
```typescript
await Promise.all(candidates.map(c => recordOutcome(...)));
```

**审计记录**:
```typescript
void db.drillAudit?.create({...}).catch(err => {...}); // Fire-and-Forget
```

---

## 🛠️ 环境变量

```env
# OpenAI / DashScope
   - **Model**: `AI_MODEL_NAME` (Global Config)
   - **Protocol**: OpenAI Compatible (SSE Stream)

# 审计系统
AUDIT_ENABLED=true
AUDIT_SAMPLE_RATE=1.0

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=xxx
```

---

## 📚 相关文档

| 文档 | 描述 |
|------|------|
| `docs/PRD-L2-WEAVER-WAND.md` | 产品需求文档 |
| `docs/dev-notes/sse-streaming-architecture.md` | SSE 流式处理架构 |
| `docs/dev-notes/panoramic-audit-system.md` | 审计系统设计 |
| `lib/streaming/README.md` | SSE 工具使用文档 |
| `tests/l2-weaver-fsrs.hurl` | Weaver API 规格 |
| `tests/l2-magic-wand.hurl` | Wand API 规格 |

---

## 🐛 已知问题 & 修复历史

| 版本 | 日期 | 问题 | 修复 |
|------|------|------|------|
| v2.0 | 2026-02-05 | SSE Controller 竞态条件 | Try-Catch 包裹 enqueue |
| v2.0 | 2026-02-05 | useSSEStream 依赖问题 | 解构 options 避免闭包 |
| v2.0 | 2026-02-05 | SessionProvider 缺失 | 创建 `/api/auth/[...nextauth]/route.ts` |
| v2.0 | 2026-02-05 | 审计缺少校验 | 添加 userId 和字段长度校验 |

---

## 🚀 未来扩展

### Phase 5 候选特性

1. **Wand AI 洞察增强**:
   - 动态生成 `ai_insight` (当前仅支持静态数据)
   - 使用 `lib/ai/client.ts` + `generateObject`

2. **Weaver 模板系统**:
   - 支持用户自定义场景模板
   - Prompt 参数化配置

3. **批量生成优化**:
   - Worker 预生成热门场景文章
   - 缓存至 Redis

4. **多语言支持**:
   - 支持生成非中文解释（如日语、西班牙语）

---

**维护者**: Hugo (Opus Team)  
**最后审计**: 2026-02-05 (Code Review v1.0 通过)
