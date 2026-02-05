# 📄 Opus PRD: Weaver Lab & Magic Wand (v2.0)

> **版本**: 2.0
> **状态**: 🔴 待评审
> **核心目标**: 实现"单词在语境中的闭环学习" —— 从 FSRS 队列生成文章 (Weaver)，在阅读中即时获取深度解析 (Wand)。

---

## 1. 核心业务流程 (User Journey)

我们不只是做"阅读器"，我们做的是 **"闭环复习流"**：

1. **Trigger (触发)**: FSRS 算法计算出用户今日有 15 个单词即将遗忘 (Due)。
2. **Generate (编织)**: 用户选择"金融 (Finance)"场景 -> **Weaver Lab** 将这 15 个词编织成一篇财经短文。
3. **Consume (消费)**: 用户阅读文章。
   - 遇到不懂的词/长难句 -> 触发 **Magic Wand**。
   - Magic Wand 优先调取本地 `Etymology` (词源) + 实时 AI 解析。
4. **Feedback (反馈)**: 阅读完成，系统记录这些词获得了"语境曝光 (Context Exposure)"，反哺 FSRS（可选）。

---

## 2. 功能模块一：Weaver Lab (文章生成实验室)

**定义**: 基于用户生词本和 FSRS 队列，利用 LLM 动态生成的个性化阅读材料引擎。

### 2.1 功能需求 (FR)

| ID | 功能点 | 详细描述 | 优先级 | 依赖模块 |
| --- | --- | --- | --- | --- |
| **WL-01** | **智能食材装填** | 系统需自动从 FSRS 数据库抓取：<br>1. **Priority Words**: 状态为 `Due` 或 `New` 的词 (8-12个)。<br>2. **Filler Words**: 已熟记但需保鲜的词 (3-5个)。 | P0 | FSRS (L1) |
| **WL-02** | **场景选择** | 用户选择生成主题 (e.g., HR, Finance, Marketing, R&D)。Prompt 需强制设定 Tone 为 "Formal Business"。 | P0 | - |
| **WL-03** | **流式生成** | 调用 LLM 生成文章。UI 必须支持 Streaming（打字机效果），减少等待焦虑。 | P0 | Vercel AI SDK |
| **WL-04** | **目标词高亮** | 生成的 JSON 或 Markdown 中，必须标记出 Target Words（例如用 `**bold**` 或 `<tag>`），前端需高亮显示。 | P1 | - |
| **WL-05** | **生成历史** | 用户的生成记录需保存（Title, Content, Target Words ID），支持回看。 | P2 | DB |

### 2.2 算法逻辑 (The Recipe)

- **Input**: `TargetWords[]`, `Scenario`, `UserLevel` (e.g. B2)
- **Prompt Strategy**:
  > "Write a coherent business article about [Scenario]. Strictly embed the following words: [List]. The tone must be professional TOEIC level. Output logical paragraphs."
- **Constraints**:
  - 文章长度：200-300 词。
  - 目标词密度：平均每段 2-3 个目标词，避免堆砌。

---

## 3. 功能模块二：Magic Wand (魔法棒 - AI 辅助阅读)

**定义**: 阅读过程中的即时解析工具。它不是查字典，而是**"上下文感知的 AI 助教"**。

### 3.1 交互设计

用户在阅读界面（Weaver 生成的文章或外部导入文章）**长按**单词或**选中**句子时，底部弹窗 (Bottom Sheet) 唤起魔法棒。

### 3.2 功能需求 (FR)

| ID | 功能点 | 详细描述 | 数据源策略 (关键) | 优先级 |
| --- | --- | --- | --- | --- |
| **MW-01** | **单词：基础释义** | 显示音标、当前语境下的简明释义。 | 本地词典表 (Vocab) | P0 |
| **MW-02** | **单词：词源基因** | 展示词根拆解、记忆钩子 (Logic CN)。**这是核心差异化功能。** | **本地 `Etymology` 表** (JSONB) | P0 |
| **MW-03** | **单词：语境搭配** | 展示该词在**当前句子**中的用法搭配 (Collocation)。 | 实时 LLM (Context Aware) | P1 |
| **MW-04** | **句子：句法分析** | 选中长句，分析主谓宾结构，拆解复杂从句。 | 实时 LLM | P1 |
| **MW-05** | **句子：润色/重写** | "Make it simpler" (降维打击) 或 "Make it formal" (升维)。 | 实时 LLM | P2 |

### 3.3 数据获取策略 (混合模式)

为了性能和成本，魔法棒的数据加载必须遵循 **"Cache-First, AI-Fallback"** 策略：

1. **第一层 (Instant)**: 用户点击单词 -> **立刻**从 `Etymology` 表读取 `mode`, `memory_hook`, `data`。
   - *前端渲染*: 直接画出词根树或显示"故事卡"。(耗时 < 50ms)

2. **第二层 (Async)**: 同时异步请求 LLM。
   - *Prompt*: "基于句子 context，解释这个词的 nuance。"
   - *前端渲染*: 当 AI 返回后，渐入显示"语境深度解析"。(耗时 ~1s)

---

## 4. 数据结构与接口定义 (API Spec Preview)

为了指导 Hurl 测试，我们预定义核心接口。

### 4.1 Weaver Generate API

- **Endpoint**: `POST /api/weaver/generate`
- **Input**:
```json
{
  "scenario": "finance",
  "target_word_ids": [101, 102, 103],
  "mock_mode": false
}
```

- **Output (Stream)**: Returns Text chunks first, then Metadata json.

### 4.2 Magic Wand Lookup API (单词级)

- **Endpoint**: `GET /api/wand/word?word=predict&context_id=...`
- **Output (Composite JSON)**:
```json
{
  "vocab": { "phonetic": "/prɪˈdɪkt/", "meaning": "..." },
  "etymology": {
    "mode": "ROOTS",
    "memory_hook": "pre(预先)+dict(说)→预言",
    "data": { "roots": [...] }
  },
  "ai_insight": null
}
```

> **Note**: `etymology` 字段直接来自项目现有的 `Etymology` 表（参见 `prisma/schema.prisma`）。

---

## 5. 埋点与审计 (Audit Requirements)

结合"全景审计系统"（参见 `docs/dev-notes/panoramic-audit-system.md`），这两个功能必须埋点：

1. **Weaver Selection Audit**:
   - 记录 Weaver 到底选了哪些词？是否包含了 FSRS 的 `Due` 词？
   - *Log Action*: `WEAVER_SELECTION`

2. **Magic Wand Quality Audit**:
   - 记录用户对哪个词使用了魔法棒？（侧面反映该词是难点，可能需要缩短 FSRS 间隔）。
   - *Log Action*: `WAND_LOOKUP`

---

## 6. 与现有系统的关联 (System Integration)

| PRD 概念 | 现有实现 | 参考文档 |
| --- | --- | --- |
| `LexicalDNA` 表 | `Etymology` 模型 | `docs/dev-notes/etymology-generation-feature.md` |
| FSRS 队列 | `UserVocab` + `fsrs-scheduler` | `lib/services/fsrs-scheduler.ts` |
| 流式生成 | SSE Streaming | `docs/dev-notes/sse-streaming-architecture.md` |
| 审计埋点 | `DrillAudit` + `audit-service` | `docs/dev-notes/panoramic-audit-system.md` |

---

## 7. 开发里程碑 (Milestones)

| Phase | 目标 | 交付物 |
| --- | --- | --- |
| **M1: API Spec** | 确定完整 API 契约 | `.hurl` 测试文件 |
| **M2: Backend Core** | Weaver 生成 + Wand 查询 | Server Actions / API Routes |
| **M3: Frontend UI** | 阅读界面 + Bottom Sheet | React Components |
| **M4: Integration** | FSRS 反馈闭环 | 端到端测试 |
