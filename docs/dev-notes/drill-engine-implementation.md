# Opus Drill 引擎与懒加载实现记录
> 日期：2026-01-23
> 背景：重构训练逻辑、修复遗留代码、实现懒加载

## 1. 概述
本文档总结了本会话期间 **Drill Engine (Level 0)**、**懒加载 (Lazy Loading)** 机制以及 **架构规范** 更新的实现细节。旨在为后续开发提供上下文参考。

## 2. 核心架构：Drill 引擎

核心逻辑位于 `actions/get-next-drill.ts`。它充当 PRD 中规定的“智能后端”。

### 2.1 "30/50/20" 协议 (候选词选择)
我们实施了一个严格的漏斗模型，优先考虑“生存 (Survival)”（救援）而非“习得 (Acquisition)”（新内容）：
1.  **救援 (Rescue, 30%)**: `dim_v_score < 30` 的单词（句法薄弱）。
2.  **复习 (Review, 50%)**: FSRS 判定到期的单词 (`next_review_at <= NOW`)。
3.  **新词 (New, 20%)**: 高频词，通过词性 (POS) 过滤。

### 2.2 "1+N" 上下文规则
为了确保训练有意义，每个目标词都丰富了 **上下文单词 (Context Words)**：
- **来源**: `getContextWords` 函数查询数据库，随机选取 3 个与目标词不同的单词（名词/形容词）。
- **未来升级**: 在 Phase 2 (Nuance Mode) 中，这种随机选择将被向量搜索 (`pgvector`) 取代，以增加干扰性。

### 2.3 批量生成与 Prompt 工程
- **位置**: `lib/prompts/drill.ts`
- **逻辑**: 我们从单卡片生成转向 **批量生成 (Batch Generation)**，以节省 Token 并提高一致性。
- **约束**:
    - 严格的 S-V-O 结构 (Level 0)。
    - 句法标记 (`<s>`, `<v>`, `<o>`) 用于 UI 高亮。
    - 通过 Zod Schema 强制执行 JSON 输出。

### 2.4 FSRS 智能路由 (Smart Dispatch)
> 更新于 V2.1 (2026-01-30)

为了解决 L0 生成器单一化问题，实现了基于 FSRS 状态的**主要路由逻辑**：

- **Stage 1 (Foundation)**:
    - 条件: `New` 或 `Stability < 7` (基础期)
    - 路由: **Syntax Generator** (S-V-O 结构，侧重句法与词性陷阱)
- **Stage 2 (Mastery)**:
    - 条件: `Stability >= 7` (进阶期)
    - 路由: **Blitz Generator** (搭配词/形近词，侧重语义深度)

此逻辑在 `drill-processor.ts` 中通过并行 `Promise.all` 执行，支持混合批次处理。

## 3. 功能特性：懒加载 (无限列表)

为了支持长时间会话而无需漫长的初始等待，我们实现了懒加载模式。

### 3.1 后端 (`get-next-drill.ts`)
- **分页**: 在 `GetBriefingSchema` 中添加了 `limit` (默认 10) 和 `excludeVocabIds`。
- **排除逻辑**: DB 查询使用 `{ id: { notIn: excludeIds } }`，确保后续批次不会包含当前会话中已存在的单词。

### 3.2 前端 (`session-runner.tsx`)
- **状态**: 维护 Drill Cards 队列 (`queue`) 和已加载词 ID 集合 (`loadedVocabIds`)。
- **触发器**: 当用户到达 `LAST_INDEX - 5` 时，触发 `loadMore()`。
- **UX**: 计数器中显示加载 Loading 动画；新卡片静默追加 ("Reinforcements arrived")。
- **初始加载**: 服务端组件 (`page.tsx`) 请求前 10 张卡片，以最小化交互时间 (TTI)。

## 4. 关键修复与调试

### 4.1 POS 过滤器 Bug
- **问题**: 数据库使用 `v.`、`n.` (带点) 或中文标签 (`名詞`)，但代码只过滤了 `v`、`n`。
- **修复**: 扩展 `posFilter` 以包含：`['v', 'n', 'v.', 'n.', 'vi', 'vt', 'vi.', 'vt.', 'noun', 'verb', '名詞', '動詞']`。

### 4.2 遗留代码清理
- 删除了 `actions/game-loop.ts` (旧入口)。
- 删除了 `actions/generate-briefing.ts` (旧单卡生成器)。
- 删除了 `components/briefing/inbox-client.tsx` (旧 UI)。
- 更新了根 `page.tsx` 直接重定向到 `/dashboard`。

## 5. 架构规范更新
- **本地化**: 在 `architecture-rules.md` 中添加了严格规则：
    - "代码中的注释，统一用中文。"
    - "所有文件头部必须包含中文注释说明该文件的作用。"
- **脚本**: 验证了 Node.js 脚本的维护性 (如 `scripts/db-vocab-stats.ts`)。

## 6. 后续步骤
- **Chunking Mode**: 实现 Phase 2 功能。
- **Vector Search**: 升级 `getContextWords` 以使用语义相似度。
- **Audio**: 集成 TTS (Dimension A)。
