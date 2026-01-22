# Opus (Mobile) - PRD Master: The Executive Briefing

| 属性 | 内容 |
| --- | --- |
| **项目名称** | Opus (Mobile) |
| **版本** | **3.4 (Hybrid Fetch / Compiler Edition)** |
| **核心理念** | **"Survive First, Then Upgrade." (拒绝死记，先活下来，再履职)** |
| **产品形态** | **口袋职场模拟器 (Pocket Workplace Simulator)** |
| **技术栈** | Next.js 14+ (App Router), Prisma, pgvector, Gemini 3 Flash (ETL/GenAI) |
| **UI 框架** | Shadcn UI + Tailwind CSS + Framer Motion (Mobile First) |
| **更新时间** | 2026-01-22 |

---

## 1. 产品愿景 (Vision)

我们将传统的“背单词 App”重构为一款 **沉浸式商务模拟工具**。
用户身份从跨国公司的 **“Trainee (新兵/培训生)”** 起步，通过认知复健建立信心，逐步晋升为 **“Executive (高管)”**。
用户不是在“做题”，而是在 **Inbox (收件箱)** 中处理 **Briefings (微任务)**。

* **核心策略**: **One Interface, Adaptive Difficulty (一套界面，内容自适应)**。
* **交互原则**: 拇指驱动 (Thumb-Driven)、极速流 (Instant Flow)、**心理安全 (Psychological Safety)**。

---

## 2. 核心架构：UI 归一化 (Unified UI Architecture)

**设计铁律：前端是“哑巴”，后端是“大脑”。**
前端不再维护“简单版/困难版”两套组件。难度差异完全由 **后端 Prompt 生成的 Markdown 格式** 和 **信息密度** 决定。

### 2.1 难度自适应矩阵 (The Invisible Hand) [Updated]

> **增量说明**: 新增 **Level 0** 列，专门服务于 1500 词汇量的复健期用户。

| 用户等级 | **Level 0: Trainee (新兵)** <br>

<br> *(Phase 1 重点)* | **Level 1: Intern (实习)** <br>

<br> *(原 Level 1)* | **Level 2: Executive (高管)** <br>

<br> *(原 Level 2)* |
| --- | --- | --- | --- |
| **核心隐喻** | **认知复健** (Rehab) | **带辅助轮骑行** (Scaffolding) | **真实路况骑行** (Real World) |
| **Briefing 形态** | **Micro-Sentence (单句指令)** <br>

<br> 强制 S-V-O 结构，无从句。 | **Short Email (短邮件)** <br>

<br> 简单商务段落。 | **Memo / Report (报告)** <br>

<br> 复杂长难句。 |
| **X 维度 (逻辑)** | **Syntax Highlighter (句法高亮)** <br>

<br> 🟢主语 🔴谓语 🔵宾语 | **Visual Anchors** <br>

<br> 关键词根加粗。 | **Hidden Logic** <br>

<br> 无辅助。 |
| **翻译策略** | **Full Translation** <br>

<br> 卡片背面全句中译。 | **Hint Only** <br>

<br> 仅难词提示。 | **None** <br>

<br> 无翻译。 |
| **每日限制** | **20 Cards (熔断保护)** <br>

<br> 防止报复性学习导致的挫败。 | 无限制 | 无限制 |

### 2.2 句法高亮系统 (Syntax Highlighter) [New]

针对 Level 0 用户，前端需解析后端生成的 XML 标签并渲染颜色，辅助识别句子骨架：

* `<s>Subject</s>` → **绿色下划线** (主语)
* `<v>Verb</v>` → **红色粗体** (谓语/核心)
* `<o>Object</o>` → **蓝色背景** (宾语)

---

## 3. 五维职场模拟系统 (5-Dim Simulation)

基于 **ETL Prompt v1.1** 清洗出的高质量数据，驱动以下五种任务流。

### 3.1 V (形) - Visual Audit (拼写/词性)

* **场景**: 审核文档中的拼写错误或词性误用。
* **Level 0 特性**: **权重 80%**。主要考察 `word_family` (如 `sign` vs `signature`)，这是 Part 5 提分最快的路径。
* **交互**: **Binary Swipe (左右滑)**。

### 3.2 C (搭) - Drafting (拟写)

* **场景**: 补全邮件草稿中的固定搭配。
* **Level 0 特性**: **权重 20%**。积累高频语块。
* **交互**: **Bubble Select (气泡填空)**。

### 3.3 M (义) - Decision (决策)

* **场景**: 确认合同条款含义，或进行商务同义替换。
* **Level 0 特性**: **关闭**。避免认知过载。
* **Level 1+**: 开启，使用 **Flash Card (翻转/二选一)**。

### 3.4 X (境) - Logic (逻辑) *[Phase 2]*

* **场景**: 句子插入题 / 逻辑连接词选择。
* **交互**: **Slot Machine (行内填空)**。

### 3.5 Multi - Cross-Check (核对) *[Phase 4]*

* **场景**: 双文档信息比对 (Part 7)。
* **交互**: **Serial View (串行阅读)**。

### 3.6 A (音) - Audio Scaffolding [New]

* **场景**: 建立音形联系，辅助听力复健。
* **交互**: **TTS Auto-play**。卡片加载时自动播放当前句子的朗读音频。

---

## 4. "1+N" 内容引擎 (Engine V3.3)

后端 Server Action 负责实时生成 Briefing。

### 4.1 数据流 (Data Flow) [Updated]

1. **Fetch**: 获取 `Target Word`。
2. **Route**:
* 若 `Level == 0`: 调用 **Drill Prompt** (强制生成 S-V-O 单句)。
* 若 `Level > 0`: 调用 **Scenario Prompt** (生成邮件)。


3. **Generate**: 调用 LLM (Gemini 3 Flash)。
4. **Render**: 前端接收 JSON。

### 4.2 输出数据结构 (Standardized JSON) [Updated]

```typescript
interface BriefingPayload {
  meta: {
    format: "chat" | "email" | "memo"; // Level 0 使用 "chat" 气泡样式
    sender: string;
    level: 0 | 1 | 2; // [New] 指示前端开启何种辅助模式
  };
  segments: [
    {
      type: "text",
      // Level 0 Example: "<s>The manager</s> <v>signed</v> <o>the contract</o>."
      // Level 1 Example: "Subject: Re: <mark>Urgent</mark> Update..."
      content_markdown: string; 
      
      // [New] 音频播放文本
      audio_text?: string;
    },
    {
      type: "interaction",
      dimension: "V", 
      task: {
        style: "swipe_card",
        question_markdown: "The manager _______ the contract.", // Level 0 填空
        options: ["sign", "signed"],
        answer_key: "signed",
        explanation_markdown: "Past tense is required."
      }
    }
  ];
}
```

## 4.5 后端逻辑：调度器 (混合取词 V3.0)

*(替换原有的随机取词逻辑)*

**核心目标**: 构建每日学习队列 (Daily Queue, 20个坑位)，严格执行 **30/50/20** 的黄金配比，平衡“生存(新学)”与“复健(复习)”。

### A. 选词算法 (三级漏斗模型)

后端服务 (`actions/get-next-drill.ts`) 必须通过 SQL `UNION ALL` 执行以下优先级瀑布流：

1.  **优先级 1: 抢救队列 (The "Weak Syntax" Queue) [上限 6 个]**
    *   **目标**: 那些“由于句法薄弱而反复做错”的夹生词。
    *   **筛选条件**: `status = 'LEARNING'` AND `dim_v_score < 30` (V维度 < 30分)。
    *   **排序**: `next_review_at ASC` (优先处理急需复习的)。

2.  **优先级 2: 复习队列 (SRS Due) [上限 4 个]**
    *   **目标**: 根据 SRS 算法今天到期需要复习的词。
    *   **筛选条件**: `status = 'LEARNING'` AND `next_review_at <= NOW()`。
    *   **排序**: `frequency_score DESC` (高频词/高ROI词优先)。

3.  **优先级 3: 新词填充 (New Acquisition) [填满剩余坑位]**
    *   **目标**: 高价值的新词。
    *   **筛选条件**: `status = 'NEW'` AND `level <= 1`。
    *   **排序 (生存优先排序 Survival Sort)**:
        1.  **词性 (POS)**: **动词 (v) > 名词 (n)**。
            *   *Impl Note*: 优先读取 `partOfSpeech`；若为空，则解析 `word_family` JSON (`v` 字段存在即视为动词)，确保 S-V-O 核心词优先。
        2.  **市场热度**: `frequency_score DESC` (Abceed 出题概率，热度高者优先)。
        3.  **认知负荷**: `LENGTH(word) ASC` (短词优先，降低拼写焦虑)。

### B. "1+N" 语境词选取规则

当为核心词 (Target Word) 抓取 **语境词 (Context Words, N)** 时：

*   **过滤条件**: 必须拥有名词或形容词形式 (`word_family->>'n'` 存在 或 `word_family->>'adj'` 存在)。
*   **禁忌**: 纯动词 (Pure Verbs) **严禁** 作为语境词出现，以防止破坏 S-V-O 结构。

### C. 架构决策：五维得分全字段化

为了支持从 `masteryMatrix` JSON 中高效筛选（如 `dim_v_score < 30`），我们在 V1.2 版本决定将五维得分（V/C/M/X/A）全部提升为 `UserProgress` 表的独立字段。

---

## 5. 开发路线图 (Vibe Coding Roadmap)

> **增量说明**: 调整了 Phase 1 的优先级，优先开发 Level 0 复健模式。

### Phase 0: Data Foundation (已锁定)

* ✅ **Schema**: `word_family`, `synonyms`, `priority` 字段已定义。
* ✅ **ETL Prompt v1.1**: 锁定 Gemini 3 Flash，确保多义词隔离。
* 🔄 **Action**: 执行 `scripts/enrich-vocab.ts` (Batch Size 6, Rate Limit Enabled)。

### Phase 1: The Bootcamp (Level 0 MVP) [Current Focus]

* **Engine**: 实现 `Drill Prompt` (单句生成) 和 `Daily Cap` (每日20条熔断)。
* **UI**: 开发 **Syntax Highlighter** 组件 (`<s>`标签渲染) 和 **TTS Auto-play**。
* **Interaction**: 实现 V 维度二选一交互。

### Phase 2: The Intern (Level 1 Upgrade)

* **Engine**: 实现 `Scenario Prompt` (邮件生成)。
* **UI**: 实现标准邮件卡片和 Markdown 渲染。

### Phase 3: The Executive & Feedback

* 实现 Haptic Feedback (触感反馈)。
* 实现 KPI 结算动画。

---

## 6. 给 LLM Copilot 的元指令 (Meta-Instructions)

1. **Mobile First**: 所有 UI 组件宽度锁定 `max-w-md`，高度 `min-h-screen`。
2. **Cognitive Safety [New]**: 在 Level 0 代码中，必须包含“每日上限”检查逻辑。如果今日已完成 20 条，直接返回 "Rest Card"。
3. **Strict Typing**: 使用 `lib/safe-json.ts` 中的 Zod Helper 校验所有数据库 JSON。
4. **Error Boundary**: 如果 LLM 生成超时，Level 0 应降级显示数据库中的 `commonExample` 字段，确保应用不崩溃。