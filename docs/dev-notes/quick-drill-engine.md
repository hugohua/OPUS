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
