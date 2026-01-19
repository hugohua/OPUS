# Opus (Mobile) - PRD Master: The Executive Briefing

| 属性 | 内容 |
| --- | --- |
| **项目名称** | Opus (Mobile) |
| **版本** | **3.0 (Final Master)** |
| **核心理念** | **"Don't Study. Execute." (拒绝死记，直接履职)** |
| **产品形态** | **口袋职场模拟器 (Pocket Workplace Simulator)** |
| **技术栈** | Next.js 14+ (App Router), Prisma, pgvector, Gemini/DeepSeek (LLM) |
| **UI 框架** | Shadcn UI + Tailwind CSS + Framer Motion (Mobile First) |
| **更新时间** | 2026-01-19 |

---

## 1. 产品愿景 (Vision)

我们将传统的“背单词 App”重构为一款 **沉浸式商务模拟工具**。
用户身份不再是“学生”，而是虚拟跨国公司的 **“实习高管 (Executive Intern)”**。
用户不是在“做题”，而是在 **Inbox (收件箱)** 中处理 **Briefings (微任务)**。

* **核心策略**: **One Interface, Adaptive Difficulty (一套界面，内容自适应)**。
* **交互原则**: 拇指驱动 (Thumb-Driven)、极速流 (Instant Flow)、全员选择题 (Closed-ended)。

---

## 2. 核心架构：UI 归一化 (Unified UI Architecture)

**设计铁律：前端是“哑巴”，后端是“大脑”。**
前端不再维护“简单版/困难版”两套组件。难度差异完全由 **后端 Prompt 生成的 Markdown 格式** 和 **信息密度** 决定。

### 2.1 难度自适应机制 (The Invisible Hand)

| 用户等级 | **Level 1 (Entry / ~500分)** | **Level 2 (Executive / ~800分)** |
| --- | --- | --- |
| **核心隐喻** | **带辅助轮骑行** (Scaffolding) | **真实路况骑行** (Real World) |
| **V 维度 (校对)** | **Visual Anchors**: 关键词根加粗。<br>

<br>`Display: "The **compet**ition is..."` | **Raw Text**: 无视觉辅助，需自行识别。<br>

<br>`Display: "The competition is..."` |
| **X 维度 (逻辑)** | **Signal Lights**: 逻辑词高亮。<br>

<br>`Display: "Sales fell. <mark>However</mark>, ..."` | **Hidden Logic**: 无高亮，需通读全段寻找逻辑线索。 |
| **信息密度** | **S-V-O**: 主谓宾简单句，无冗余修饰。 | **Complex**: 包含插入语、被动语态、商务客套话。 |
| **实现技术** | `react-markdown` 渲染 `**bold**` 和 `<mark>` | `react-markdown` 渲染纯文本 |

---

## 3. 五维职场模拟系统 (5-Dim Simulation)

基于 **ETL Prompt v1.0** 清洗出的高质量数据，驱动以下五种任务流：

### 3.1 V (形) - Visual Audit (拼写/词性)

* **场景**: 审核文档中的拼写错误或词性误用。
* **数据源**: `Word.word_family` (词性), `Word.confusing_words` (形近词)。
* **交互**: **Binary Swipe (左右滑)**。
* *左滑*: Reject (有错)。
* *右滑*: Approve (无错)。



### 3.2 C (搭) - Drafting (拟写)

* **场景**: 补全邮件草稿中的固定搭配。
* **数据源**: `Word.collocations` (需区分 `abceed` 原生和 `ai` 生成)。
* **交互**: **Bubble Select (气泡填空)**。
* 底部悬浮 2-3 个气泡选项 (Chips)。



### 3.3 M (义) - Decision (决策)

* **场景**: 确认合同条款含义，或进行商务同义替换。
* **数据源**: `Word.synonyms` (必须是 Formal Business 词汇)。
* **交互**: **Flash Card (翻转/二选一)**。
* 考察点：`competitive` = `economical` (实惠的)，而非 `aggressive` (好斗的)。



### 3.4 X (境) - Logic (逻辑) *[Phase 2]*

* **场景**: 句子插入题 / 逻辑连接词选择。
* **交互**: **Slot Machine (行内填空)**。

### 3.5 Multi - Cross-Check (核对) *[Phase 4]*

* **场景**: 双文档信息比对 (Part 7)。
* **交互**: **Serial View (串行阅读)**。

---

## 4. "1+N" 内容引擎 (Engine V3.0)

后端 Server Action 负责实时生成 Briefing。

### 4.1 数据流 (Data Flow)

1. **Fetch**: 从 DB 获取 `Target Word` 及其静态元数据 (由 ETL 脚本预处理好的)。
2. **Context**: 通过 pgvector 查找 3 个相关词 (Context Words)。
3. **Generate**: 调用 LLM (Gemini/DeepSeek)，传入 **Briefing Prompt**。
4. **Render**: 前端接收 JSON，渲染为 Markdown 卡片。

### 4.2 输出数据结构 (Standardized JSON)

```typescript
interface BriefingPayload {
  meta: {
    format: "email" | "memo" | "chat"; // 决定容器皮肤
    sender: string;
    kpi_impact: "HIGH" | "MEDIUM"; // 决定反馈震动强度
  };
  segments: [
    {
      type: "text",
      content_markdown: "Subject: Re: <mark>Urgent</mark> Update...", // 带样式的文本
    },
    {
      type: "interaction",
      dimension: "V", // 或 "C", "M"
      task: {
        style: "swipe_card", // 或 "bubble_select"
        question_markdown: "Is the word **minute** used correctly?",
        options: ["Yes", "No"],
        answer_key: "Yes",
        explanation_markdown: "**Minute** here means *meeting record*."
      }
    }
  ];
}

```

---

## 5. 开发路线图 (Vibe Coding Roadmap)

### Phase 0: Data Foundation (已锁定)

* ✅ **Schema**: `word_family`, `synonyms`, `confusing_words` 字段已定义。
* ✅ **ETL Prompt v1.0**: 锁定 **Gemini Flash + Temp 0.1**，确保多义词隔离 (minute ≠ micro) 和商务语境纯度。
* 🔄 **Action**: 执行 `scripts/enrich-vocab.ts` 和 `prisma/seed.ts`。

### Phase 1: The Engine (当前重点)

* 开发 `generateBriefing` Server Action。
* 实现 **Fallback 机制**：当 AI 超时时，返回硬编码的“会议延期通知”邮件模板。

### Phase 2: The Inbox UI

* 实现 **Stack View** (卡片堆叠) 或 **Infinite Scroll**。
* 开发 **Markdown Renderer** 组件 (配置 `rehype-raw` 支持 `<mark>`)。

### Phase 3: Feedback Loop

* 实现 Haptic Feedback (触感反馈)。
* 实现 KPI 结算动画。

---

## 6. 给 LLM Copilot 的元指令 (Meta-Instructions)

1. **Mobile First**: 所有 UI 组件宽度锁定 `max-w-md`，高度 `min-h-screen`。
2. **No Loading Spinners**: 尽量使用 Skeleton (骨架屏) 或 Optimistic UI。AI 生成慢时，先显示上一张卡片的结算动画。
3. **Strict Typing**: 所有数据库操作必须通过 Zod 校验，确保 ETL 进来的 JSON 字段不为空。
4. **Error Boundary**: 这是一个模拟器。如果数据出错了，显示 "Connection Lost: Reconnecting to HQ..." 而不是 "500 Error".