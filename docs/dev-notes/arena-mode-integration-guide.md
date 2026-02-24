# Arena 竞技场模式架构与接入指南

## 1. 竞技场架构概览：Part 5 (单句填空)

Arena（竞技场）模式与传统记忆卡不同，它以**实战题型**为主导，其核心诉求是利用题库 (`QuestionSeed` 表) 或 AI 生成技术，组装出符合标准化考试（例如 TOEIC）的数据结构。

在当前实现的 `ARENA_PART5`（单句填空题）中，系统执行以下架构策略：

### 1.1 数据结构映射 (BriefingPayload)
竞技场题目被序列化为通用的 `BriefingPayload`：
- `meta.format`: `chat` (或未来的专项 UI)
- `meta.mode`: `ARENA_PART5`
- `segments`:
  - `text` segment 用于题干上下文（如果需要长题干）
  - `interaction` segment，其 `task.style` 通常为 `swipe_card`，内含 `question_markdown` (挖空句) 和包含四个干扰项的 `options`。

### 1.2 Zero-Wait 生成流水线
1. **优先提取原题**：当需要为目标词汇生成 Part 5 Drill 时，`part5-drill.ts` 将查询 `QuestionSeed` 表中 `targetAnswer === targetWord` 并且题型包含 `Part5` 的题目进行填充。
2. **AI 重生成策略**：若匹配的原题选项过时或不足以支撑训练，或词汇在题库中缺失，它通过 `openai` 调用大模型，遵循相应的 prompt (`deterministic-v1-part5` 等) 零成本组装全新的四选项数据帧。
3. **Queue / Redis 队列**：与常规 Mode 共享相同的 `drill-cache`。每个用户的 Part 5 会以一个单独的 namespace (`ARENA_PART5`) 在高可用 Redis 缓冲池中等待。

### 1.3 O(1) 无副效应兜底 (Arena Fallback Mechanism)
为了防止缓存耗尽（Cache Miss）与数据库并发雪崩（N+1 Problem），竞技场实现了专用的 `arena-fallback.ts` 隔离层与降级引擎。特别是考虑到不同题型特征的巨大差异，系统实施了严格的**“题型物理隔离兜底”**原则：

- **Part 5 (单句填空) 兜底轨**：
    - 在拉取备用灵感种子时，**严格约束 `where: { part: 5 }`**。
    - 若极端情况下数据库仍空，则执行**极限正则兜底**（运用 `\b` 边界正则基于词根变化 `s/ed/ing` 生造四个选项），确保无论如何一定有题可做。
    
- **Part 6 (长文多空) 兜底轨**：
    - 绝不允许拿 Part 5 的单句去作为 Part 6 长文的参考，防止两类题型的逻辑属性错位。
    - **严格约束 `where: { part: 6 }`** 并**强制执行联表查询 `include: { passage: true }`**。
    - 借用真实长文作为结构模板供大模型模仿。如果缺少原文上下文的注入，在大模型遇到提取的试题恰好为 `SENTENCE_INSERTION` (考查整个句子插入，题干本身为空) 时，会导致大模型因零锚点而出现严重的逻辑幻觉。

- **前置批查询 (Batch Pre-load)**：在 `get-next-drill.ts` 处理提取时，主动过滤得到缺货的竞技场目标单词，合并为一个 `findMany(in:)` 语句极速取回大盘随机 Seed 模版。

---

## 2. 端到端新增全新题型 (Session Mode) Checklist

要为 Opus 添加一种全新的答题体验及生成逻辑（如 `ARENA_PART6` 或全新的 `GRAMMAR` 模式），需要从底层模型到业务 UI 逐一贯穿。请严格实施以下 7 步打通：

### 步骤 1：全局枚举注册与 UI 路由标识
- [ ] **`types/briefing.ts`**: 将新 Mode 名增加到 `SessionMode` / `SingleScenarioMode` 联合类型。
- [ ] **`lib/constants/modes.ts`**: 将新 Mode 的中文标签（如 `'ARENA_PART6': '完形填空'`）注册至 `MODE_LABELS`，供前端渲染。

### 步骤 2：生成器 (Generator) 逻辑撰写
- [ ] **`lib/generators/`**: 创建专用的生成器文件（如果是 Arena 就放 `/arena/part6-drill.ts`）。引入通用的大模型库，并保证其接受 `VocabDrillInput` 并遵循标准返回 `BriefingPayload` 的接口。
- [ ] **System Prompt**: 设计配套的 AI Prompt 告诉模型应产生的结果（例如限定输出4选项JSON，限制难度等）。

### 步骤 3：库存容量与队列调度打通
- [ ] **`lib/config/mixed-mode-config.ts` 或 `lib/drill-cache.ts`**: 将新 Mode 注册到 `CACHE_LIMIT_MAP` 中，决定它是需要 10 个批次还是 6 个批次的缓存深度限制。(注意 Typescript 检查是否因为 `createSessionModeRecord` 约束而遗漏)。

### 步骤 4：主干调度层与 兜底保障分配
- [ ] **`workers/drill-processor.ts`**: 在处理分流（`switch (mode)`）处加入新模型分支，并接驳至对应的 L1/L2 等执行阶段生成逻辑。
- [ ] **`actions/get-next-drill.ts`**:
    - 如果它属于常规卡片，添加处理预取（Batch Redis Extract）。
    - 赋予兜底策略：如果属于常规记忆，接入 `buildPhraseFallbackDrill`；如果是大题库类实战，在 `lib/templates/arena-fallback.ts` 新开一个分流判断提取其特定 UI 形式的降级方案。
- [ ] (可选) **`actions/queue-admin.ts`**: 为 `getCacheStats()` 的返回类型手动注册该 Mode 名并赋予默认值 `0`。

### 步骤 5：前端 UI 表现对接
- [ ] **`components/admin/operation-panel.tsx`**: 给队列控制台中添加对应的 Trigger / Clear 手动测试按钮。
- [ ] **`components/admin/cache-stats-card.tsx`**: 给总览雷达增加显示它当前 Cache 池的库存量进度条。
- [ ] **`app/session/[mode]/` 或 Dynamic Router**: 构建其实际的用户前台展现。基于 `BriefingPayload` 渲染对应数量的滑动卡片、气泡挑选还是填空区。

### 步骤 6：OMPS 复习调度（如果属于 L2 混合逻辑）
- [ ] **`lib/core/scenario-selector.ts`**: (可选) 如果打算将它并入混合抽查（Mixed）流水线，通过 `MIXED_MODE_SCENARIOS` 配置其根据 Stability 进入哪一个层级的抽题概率池。

### 步骤 7：单元测试与健康审查
- [ ] **`__tests__/get-next-drill.test.ts`**: 更新或者 Mock 它，保证在 Cache Miss 时的路由逻辑能够被单元测试捕捉。
- [ ] **日志审查**: 观察 `npm run worker` 的输出与 `panoramic-audit-system.md` 等日志埋点，确认该题型的请求无冗余 N+1 和异常错误。
