Hugo，明白。你提供的这份文档结构非常清晰（Executive Briefing 风格），非常适合作为移动端开发的指导纲领。

我将遵循 **"保持原有结构，注入最新内核"** 的原则，将我们刚才确定的 **V1.4 (模式驱动 + FSRS + 无限流)** 逻辑无缝融合进这份文档。

主要调整点：

1. **架构升级**：将 "User Level" 表格替换为 **"Session Mode" (训练模式)**。
2. **调度逻辑**：将 "Daily Queue" 替换为 **"Infinite Batch + Anti-Overload"**。
3. **算法内核**：明确写入 **FSRS v5** 和 **Vector Strategy**。

以下是微调后的完整版本，你可以直接保存覆盖。

---

# Opus (Mobile) - PRD Master: The Executive Briefing

| 属性 | 内容 |
| --- | --- |
| **项目名称** | Opus (Mobile) |
| **版本** | **v1.5 (The "Immersion" Release)** |
| **状态** | **Active Development** |
| **核心理念** | **"Toolbox, Not Levels." (拒绝被动分级，提供主动工具箱)** |
| **产品形态** | **口袋职场模拟器 (Pocket Workplace Simulator)** |
| **技术栈** | Next.js 14+ (App Router), Prisma, **ts-fsrs**, pgvector (1536 dim) |
| **UI 框架** | Shadcn UI + Tailwind CSS + Framer Motion (Mobile First) |
| **更新时间** | 2026-01-23 |

---

## 0. Change Log

* **v1.5 (Current)**:
  * [Feature] **Commute Mode (Audio Stream)**: 引入“智能磨耳”模式，基于 FSRS 队列生成 TTS 播放列表，支持离线复习。
  * [Feature] **Magic Paste (Context Injection)**: 支持用户粘贴工作文档/邮件，AI 自动萃取商务核心词并生成原句填空卡片。
  * [UI] **Phrase X-Ray**: 单词详情页引入“短语透视镜”视图，强化搭配词的纵向对齐视觉记忆。
* **v1.4**: Mode-Driven 架构 (Syntax/Chunking/Nuance) 及智能高亮。
* **v1.3**: 无限流、FSRS v5、向量化。

---

## 1. 产品愿景 (Vision)

我们将传统的“背单词 App”重构为一款 **自适应职场复健工具箱**。
用户不再被动地被锁定在某个等级，而是根据今日状态，**主动选择** 进入哪种“训练模式 (Session Mode)”进行复健或进阶。

* **核心策略**: **Mode-Driven Architecture (模式驱动架构)**。
* **交互原则**: 拇指驱动 (Thumb-Driven)、极速无限流 (Infinite Flow)、**心理安全 (Psychological Safety)**。

---

## 2. 核心架构：模式驱动 UI (Mode-Driven UI)

**设计铁律：前端只负责渲染 "Briefing"，后端负责根据 Mode 组装难度。**
用户在首页选择三种模式之一进入 Session。

### 2.1 训练模式矩阵 (The Mode Matrix) [Updated]

| 模式选择 | **🛠️ Syntax Core (句法重构)** <br>

<br>*(原 Level 0)* | **🔗 Chunking Flow (语块扩容)** <br>

<br>*(原 Level 1)* | **🎯 Biz Nuance (精准职场)** <br>

<br>*(原 Level 2)* |
| --- | --- | --- | --- |
| **核心价值** | **Cognitive Rehab (复健)**<br>

<br>修复破碎语感，建立信心。 | **Fluency (连贯)**<br>

<br>加入介词与短语，扩充肺活量。 | **Precision (精准)**<br>

<br>近义词辨析，像专家一样思考。 |
| **Briefing 形态** | **Micro-Sentence (单句)**<br>

<br>强制 S-V-O，严禁介词短语。 | **Short Email (短邮件)**<br>

<br>包含介词短语 (Prep Phrases)。 | **Memo / Report (报告)**<br>

<br>复杂句、被动语态、虚拟语气。 |
| **视觉辅助** | **Syntax Highlighter (强)**<br>

<br>🟢主语 🔴谓语 🔵宾语 | **Phrase Highlight (中)**<br>

<br>仅高亮短语/介词。 | **Hidden Logic (弱)**<br>

<br>无辅助，全真模拟。 |
| **Batch Size** | **20** words / group | **30** words / group | **50** words / group |
| **FSRS 节奏** | **0.95 Retention** (高频呵护) | **0.90 Retention** (标准) | **0.85 Retention** (高效率) |

### 2.2 视觉高亮系统 (Visual Systems) [New]

* **Syntax Mode**: 解析 XML 标签 (`<s>`, `<v>`, `<o>`)，渲染红绿蓝骨架。
* **Smart Highlight**: 解析 `word_family`，在短语中智能高亮变形词（如在 *running* 中高亮 *run*），**严禁高亮中文翻译**。

### 2.3 Phrase X-Ray (Collocation View)

在单词详情页或卡片背面，采用“纵向对齐”方式展示短语，利用视觉格式塔原理强化记忆。

* **UI Pattern**:
```text
[ run ] a business
[ run ] out of time
[ run ] into problems
```

---

## 3. 五维职场模拟系统 (5-Dim Simulation)

基于 **ETL Prompt v1.1** 清洗出的高质量数据，驱动以下任务流。

### 3.1 V (形) - Visual Audit (拼写/词性)

* **Syntax Mode**: 权重 **80%**。主要考察动词变位 (Sign vs Signed)。
* **交互**: **Binary Swipe (左右滑)**。

### 3.2 C (搭) - Drafting (拟写)

* **Chunking Mode**: 权重 **50%**。重点考察介词填空 (`in`, `on`, `with`) 和短语补全。
* **交互**: **Bubble Select (气泡填空)**。

### 3.3 M (义) - Decision (决策)

* **Nuance Mode**: 权重 **60%**。考察近义词辨析 (e.g., *Change* vs *Modify*)。
* **干扰项**: 基于 **向量相似度 (Vector Similarity)** 生成高干扰选项。
* **交互**: **Flash Card (二选一)**。

### 3.4 A (音) - Audio Scaffolding [New]

* **全模式通用**: 建立音形联系。
* **交互**: **TTS Auto-play**。卡片加载时自动播放当前句子的朗读音频。

---

## 4. "1+N" 内容引擎 (Engine V4.0)

后端 Server Action (`actions/get-next-drill`) 负责根据 `mode` 参数生成内容。

### 4.1 数据流 (Data Flow) [Updated]

1. **Request**: 前端请求 `getNextBatch(userId, mode='SYNTAX')`。
2. **Anti-Overload Check**: 检查积压量。如果积压过高，强制覆盖配方为“全复习”。
3. **Fetch**: 混合取词引擎抓取 20/30/50 个词。
4. **GenAI**: 调用 Gemini 3 Flash，加载对应版本的 System Prompt (v2.7/v3.0/v4.0)。
5. **Render**: 前端接收 JSON 渲染。

### 4.2 输出数据结构 (Standardized JSON)

```typescript
interface BriefingPayload {
  meta: {
    format: "chat" | "email" | "memo"; 
    mode: "SYNTAX" | "CHUNKING" | "NUANCE"; // 指示前端渲染逻辑
  };
  segments: [
    {
      type: "text",
      // Syntax Mode: "<s>The manager</s> <v>signed</v> <o>the contract</o>."
      // Chunking Mode: "Please send it <prep>to</prep> the client."
      content_markdown: string; 
      audio_text?: string;
    },
    {
      type: "interaction",
      dimension: "V", 
      task: {
        style: "swipe_card", // or "bubble_select"
        options: ["sign", "signed"],
        answer_key: "signed",
        // Nuance Mode 会包含 detailed distinction
        explanation_markdown: "Past tense required..." 
      }
    }
  ];
}

```

---

## 5. 后端逻辑：智能调度器 (Scheduler V4.1)

*(核心变动：引入 FSRS 与 反积压机制)*

### A. 交互模式：无限批次 (Infinite Batch)

* **机制**: 无每日硬上限。用户完成一组 (20/30/50) 后，可立即开启下一组。
* **防沉迷/防积压**: 虽然允许无限刷，但通过**动态配方**控制债务。

### B. 反积压风控 (Anti-Overload Regulator)

在取词前，计算 `Backlog` (已过期复习词数)。

* **健康 (Green)**: 100% 新词 (给用户爽感)。
* **警告 (Yellow)**: 50% 新词 + 50% 复习 (隐形还债)。
* **熔断 (Red)**: 0% 新词 + 100% 复习 (UI提示: "Clear backlog to unlock new words")。

### C. 混合取词 (Hybrid Fetch V3.0)

确定配额后，通过 SQL `UNION ALL` 执行优先级抓取：

1. **抢救队列 (Resurrection)**: `V-Score < 3` (最高优)。
2. **复习队列 (Review)**: `next_review_at <= NOW()` (FSRS 计算出的时间)。
3. **新词队列 (New)**:
* *Syntax Mode*: 仅 `pos IN ('v', 'n')`。
* *Other Modes*: 逐步放开词性限制。
* **排序**: 动词优先 > Abceed 热度 > 单词长度。



---

## 6. 核心算法 (Dual-Engine)

1. **Time Engine**: **FSRS v5 (`ts-fsrs`)**
* 负责计算 `next_review_at`。
* Syntax Mode 下 `retention=0.95` (高频)；Nuance Mode 下 `retention=0.85` (高效)。
* 写入数据库时增加 **±5% Fuzzing** (随机抖动) 以防止复习雪崩。


2. **Game Engine**: **RPG V-Score**
* `dimension_v_score` (0-5)。
* **Mastery Exit**: 分数 >= 5 时，Status -> MASTERED，永久移出 Target 队列。



---

## 7. 开发路线图 (Vibe Coding Roadmap)

### Phase 1: The Foundation (Syntax Mode) [Current]

* **DB**: 更新 Schema (Mode Enums, FSRS fields, Vector)。
* **Engine**: 实现 `getNextBatch` (无限流 + 反积压) 和 Prompt v2.7 (S-V-O)。
* **UI**: 实现 **Syntax Highlighter** 和 **Session Summary** 页面。

### Phase 2: The Expansion (Chunking Mode)

* **Engine**: 实现 Prompt v3.0 (介词生成) 和 `PhraseHighlighter`。
* **DB**: 导入 `collocations` 数据。

### Phase 3: The Mastery (Nuance Mode)

* **Engine**: 实现 Vector Search (干扰项生成) 和 Prompt v4.0 (辨析)。
* **Feature**: 触感反馈 (Haptic) 与 长期记忆可视化。

---

## 8. Feature: Audio Stream (Commute Mode)

* **Goal**: 利用通勤/健身等碎片时间，通过听觉强化 FSRS 记忆队列。
* **Logic**:
  1. **Queue Fetch**: 获取今日 `status='LEARNING'` 且 `next_review_at <= NOW()` 的前 20-50 个单词。
  2. **Playlist Generation**: 为每个单词动态合成音频流片段。
     * `[Sound Effect]` (Soft Ding)
     * **Target Word** (EN, Slow)
     * *2s Silence* (Active Recall Window)
     * **Definition** (CN, Business Brief, Fast)
     * **Example Sentence** (EN, Normal Speed)
     * *5s Silence* (Shadowing Window)
  3. **Looping**: 播放列表循环直到用户停止。
* **Tech Stack**:
  * **TTS Provider**: Aliyun CosyVoice (保持音色一致性).
  * **Player**: HTML5 Audio / PWA Background Play Support.

## 9. Feature: Magic Paste (Context Injection)

* **Goal**: 解决 Level 2 用户“学以致用”的需求，将用户真实工作语料转化为 Drill。
* **Entry**: Navigation Bar -> "Capture" Button.
* **Process**:
  1. **Input**: 用户粘贴一段英文文本 (Email, Tech Doc, News).
  2. **Extraction (AI)**:
     * Identify verbs/nouns that match **TOEIC/Business Core** list.
     * Filter out Stop Words (is, the, a) & Rare Proper Nouns.
  3. **Generation**:
     * 使用**用户提供的原句**作为 Context。
     * 挖空识别出的 Core Word。
     * 生成卡片并存入 `UserWordProgress` (Status=NEW, Source=USER_PASTE).
* **Prompt Strategy**:
  > "Analyze provided text. Extract key business verbs. Create fill-in-the-blank drills using the ORIGINAL sentences. Ignore simple words."

---

## 10. 给 LLM Copilot 的元指令 (Meta-Instructions)

1. **Context Aware**: 在编写代码时，首先检查传入的 `mode` 参数，根据 `OPUS_RULES[mode]` 获取配置，严禁硬编码。
2. **Safety First**: 在处理 FSRS 调度时，必须包含 `fuzzing` 逻辑，防止所有单词在同一分钟到期。
3. **Vector Policy**: 向量化时必须使用 **"Semantic Sandwich"** 策略 (Word + Definition + Context)，严禁只向量化单词本身。
4. **Error Boundary**: 若 GenAI 失败，Level 0/Syntax Mode 应降级使用数据库中的 `definition_cn` 和 `commonExample` 构建简单卡片。