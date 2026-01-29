# 🧪 AI-Native Task 3: Context Lab (L2) 完整需求规格说明书

## 1. 产品定义与定位

* **名称**: Context Lab (语境实验室)
* **定位**: L2 Apex (塔尖层)。不再考“认词”，不再考“听音”，只考 **“逻辑与应用”**。
* **核心机制**: **1+N Vector Injection (向量注入)** + **Socratic Reasoning (苏格拉底推理)**。
* **场景特征**: 深度学习模式（15-30秒/题），需要逻辑思考，模拟真实考试压迫感。
* **TOEIC 对标**:
* **Part 5**: Incomplete Sentences (长难句逻辑填空)
* **Part 6**: Text Completion (段落填空，考上下文连贯性)
* **Part 7**: Reading Comprehension (同义替换/推断)



---

## 2. 数据层需求 (The Seed & The Map)

L2 极其依赖向量数据库来寻找“语境素材”。

### 2.1 `Vocab` 表 (基础数据)

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| `id` | Int | - | - |
| `word` | String | e.g., "Strategy" | Target Word |
| `embedding` | Vector(1536) | OpenAI `text-embedding-3-small` | **1+N 算法的核心地图**。用于寻找 N 个关联词。 |
| `synonyms` | String[] | e.g., `["plan", "tactic"]` | 用于生成 **Nuance (辨析题)** 的干扰项。 |

### 2.2 `UserProgress` 表 (FSRS 动态参数)

| 字段 | 说明 | 驱动逻辑 |
| --- | --- | --- |
| `state` | Review (Mature) | 必须是 **Mature (熟词)** 才能进入 Context Lab。 |
| `stability` | > 21 days | 决定 **语境复杂度** (S 越高，生成的句子越长，逻辑转折越多)。 |
| `retrievability` | R 值 | R 值越低（快忘了），生成的语境线索要越明显（Hint）。 |

---

## 3. 逻辑层：1+N 驱动的生成矩阵 (The Matrix)

L2 的核心挑战在于：**如何让 LLM 生成既相关又难的题目？**
答案是 **1+N 算法**。我们不让 LLM 瞎编，而是先用向量搜索找出“语义星座”，强迫 LLM 把这些词编织在一起。

| 阶段 (Stage) | 触发条件 (Condition) | TOEIC 考点 (Goal) | 1+N 选词策略 (The Shopper) | 生成策略 (The Chef) |
| --- | --- | --- | --- | --- |
| **Stage 1: 逻辑搭配** | `Mature` <br>

<br> `Stability < 45d` | **Part 5 词义辨析**<br>

<br>考查固定搭配在长句中的应用。 | **Close Neighbors**<br>

<br>找距离最近的搭配词。<br>

<br>*(Target: Strategy -> N: Plan, Business)* | **Single Sentence Cloze**<br>

<br>生成单句，挖掉 Target。<br>

<br>选项是语义相近但搭配错误的词。 |
| **Stage 2: 上下文推断** | `Mature` <br>

<br> `Stability > 45d` | **Part 6 段落填空**<br>

<br>考查前后句逻辑关联。 | **Thematic Cluster**<br>

<br>找同一主题但在不同维度的词。<br>

<br>*(Target: Strategy -> N: Competitor, Market, Share)* | **Micro-Paragraph (2-3 sentences)**<br>

<br>Target 是连接前后逻辑的关键。<br>

<br>不读完后半句选不出来。 |
| **Stage 3: 极致辨析** | `Critical` <br>

<br> (曾多次做错辨析题) | **Part 7 同义替换**<br>

<br>考查 Nuance (细微差别)。 | **Synonym Cluster**<br>

<br>找意思极像的同义词。<br>

<br>*(Target: Strategy -> N: Tactic, Approach)* | **Nuance Trap**<br>

<br>语境必须极度精确，只有 Strategy 这种“宏观”词能用，Tactic 这种“微观”词不能用。 |

---

## 4. 生成层：双引擎协同 (The Engines)

### 4.1 Step 1: The Shopper (Python + pgvector)

**任务**: 为 LLM 采购“食材”。

* **Input**: Target Word = `Compliance` (合规)
* **Algorithm**:
* 在向量空间搜索 `Cosine Distance` 介于 `0.2` 到 `0.4` 之间的词。
* *为什么要这个区间？* 太近是同义词（做干扰项），太远不相关。这个区间通常是 **Topic Context (话题词)**。


* **Output (The N)**: `Regulation`, `Safety`, `Audit`, `Penalty`.

### 4.2 Step 2: The Chef (LLM Prompting)

**任务**: 用采购的食材炒出一道 TOEIC 难题。

**Prompt 模板 (针对 Stage 2: 上下文推断)**:

```markdown
You are a TOEIC Part 6 Content Generator.
Target Word: "${word}" (Compliance)
Context Seeds (Required): [${N_words}] (Regulation, Audit, Penalty)

Task: Write a formal business email snippet (2-3 sentences).
Constraint 1: The text must logically flow from identifying a risk (Audit) to the consequence (Penalty), making the Target (${word}) the only logical solution.
Constraint 2: Do NOT make it easy. The user must understand the "Audit" context to select "Compliance".

Distractors: Generate 3 words that fit grammatically (Nouns) but fail logically in this specific context (e.g., "Satisfaction", "Distance", "Alliance").

```

**生成的题目**:

> **Subject: Audit Results**
> Due to the recent safety audit failure, we are facing a significant penalty. To avoid further fines, we must ensure strict ______ with the new regulations immediately.
> A. **Compliance** (✅ 只有它能解决 audit/penalty 问题)
> B. Alliance (❌ 语法通，逻辑不通)
> C. Resistance (❌ 反义逻辑)
> D. Distance (❌ 无关)

---

## 5. 交互与反馈 (The Experience)

L2 的体验核心是 **"Thinking" (思考)** 和 **"Reasoning" (推理)**。

### 5.1 界面状态

* **Zone A (Context)**:
* 不再是大字单词，而是 **一段文本块**。
* 字体对齐方式模拟真实文档（Email 格式 / Memo 格式）。
* Target 处是一个下划线 `______`。


* **Zone B (Options)**:
* 4 个选项。
* *注意*: 在 L2 阶段，绝对**不显示中文释义**。必须是全英文选项，模拟真实考试环境。



### 5.2 错误反馈：AI 苏格拉底私教 (Socratic Tutor)

这是 Context Lab 的杀手锏。当用户选错时，不要直接给答案。

* **Trigger**: 用户选了 `B. Alliance`。
* **Logic**: 前端调用 LLM 的 `explain` 接口（或预生成的解析）。
* **UI**: 底部弹出 "AI Tutor"。
* **Content (LLM Generated)**:
> *"你选择了 **Alliance (联盟)**。*
> *看看前一句提到的 'penalty' (罚款) 和 'audit' (审计)。*
> *通常我们通过与谁结盟来避免罚款吗？还是通过**遵守 (Compliance)** 规则来避免罚款？*
> *再试一次。"*



---

## 6. 兜底与预加载 (Zero-Wait)

L2 的生成成本最高（GPT-4o 处理长文本），延迟最长。

* **Prefetch Strategy (预加载)**:
* 当用户在首页点击 `Start` 时，系统立刻识别出今日 `Due` 的 L2 单词（通常只有 3-5 个）。
* **优先队列**: 立即将这 3-5 个 L2 单词的生成任务推入 Worker。
* 用户在做前几道 L0 (Speed Run) 题目时，L2 的长难句正在后台生成。


* **Fallback (降级)**:
* 如果 1+N 搜索失败或 LLM 超时。
* **降级方案**: 使用 `Vocab.example_sentence` (数据库里存的一句静态例句) 进行挖空。
* *虽然体验降级，但保证了功能可用。*



---

## 7. 总结：核心价值点

1. **Anti-Memorization (反背诵)**:
* 传统的“例句挖空”做两次就背住了答案。
* Context Lab 利用 **1+N** 每次抓取不同的关联词（这次抓 `Audit`，下次抓 `Legal`），生成的语境永远在变。用户必须**读懂句子**才能做对。


2. **Logic Training (逻辑闭环)**:
* 通过强制 LLM 使用 `Regulation`, `Penalty` 等词构建语境，我们确保了题目考察的是 **Contextual Logic**，而不仅仅是词汇量。


3. **Simulation (全真模拟)**:
* 字体、排版、全英文选项、干扰项设计，完全复刻 TOEIC Part 5/6 考场体验。

