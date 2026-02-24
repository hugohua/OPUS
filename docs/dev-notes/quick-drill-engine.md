# Quick Drill 靶向训练引擎分析

## 1. 核心设计哲学
"Quick Drill" 旨在让用户点击自己的语法短板时，迅速刷取相关题型。
核心原则：**不新建路由、不新建 SessionMode、直接穿透**。

在 V2 结构中，`ARENA_PART5` 是一个极具扩展性的引擎容器。Quick Drill 的本质就是带了过滤参数（`grammarNodeId`）的 `ARENA_PART5`。

## 2. 参数穿透链路 (Pipeline Passthrough)
- **URL**：前端组装 `/dashboard/arena/blitz?node=XXX`
- **Page**：`blitz/page.tsx` 读取 `searchParams.node` 生成 `grammarNodeId`
- **SessionRunner**：透传 `props.grammarNodeId`
- **Hooks**：`useDrillSession` 在 `loadMore` & `loadInitialData` 时将 `grammarNodeId` 打入 Server Action
- **Server Action**：`get-next-drill.ts` 捕获拦截。

## 3. O(1) 旁路兜底策略 (Bypass Fallback)
在 `actions/get-next-drill.ts` 的顶部实现了外科手术式的分流：
- **如果有 `grammarNodeId`**：
  直接拦截，不查 OMPS，不去 Redis 问，直接写一个 Prisma 查询：`QuestionSeed WHERE grammarNodeId = node`。
- **如果不满足（常规 Blitz）**：
  坠落到常规的 70(词库) / 30(语法随机题) 的大分发树形图里。
  
### 3.1 真实语境防退化
兜底时没有 LLM 的千变万化，但直接使用 `QuestionSeed` 的原题有一个巨大好处：它就是 100% 真实的 TOEIC 考试原题。由于排除了过去 24h `AttemptRecord` 中的 Seed_Id（防重复机制），用户体验到了最高密度的无废话靶向刷题快感。

## 4. Part 5 与 Part 6 物理隔离机制 (V3.0 更新)
为了防止在随机抽样或降级兜底时，大模型将“单句题干”的考试逻辑和“长文连贯阅读”的逻辑混淆，核心在分发引擎设计了物理隔离：

- **大盘分发轨 (`actions/get-next-drill.ts`)**: 
  处理所有 L0/L1/L2 的日课以及 `ARENA_PART5` 的大盘。无论是 Quick Drill 靶向还是 Fallback 兜底，查询被严格死锁在 `where: { part: 5 }`，永远只用标准单句考点做灵感。
- **长文发牌专轨 (`actions/part6-queue.ts`)**: 
  处理 `ARENA_PART6` 模式。此处的 fallback 如果拿不到符合词汇要求的 Part 6 考题，**不仅被强制约束在 `where: { part: 6 }`，更是通过 `include: { passage: true }` 关联提取原文长段落**。这确保大模型面对即使是 `SENTENCE_INSERTION` (考点在文章，本身为空) 也能获得充分锚点，免于瞎编发散。
