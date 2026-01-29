# 📝 AI-Native Task 1: Speed Run (L0) 完整需求规格说明书

## 1. 产品定义与定位

* **名称**: Speed Run (极速刷词)
* **定位**: L0 Foundation (基座层)。不考长难句，不考听力。只专注于建立单词的 **“形-义”连接** 和 **“基础搭配 (SVO)”**。
* **核心机制**: **JIT (Just-in-Time) 实时生成**。利用 LLM 实时构建微语境，拒绝死记硬背，拒绝固定题库。
* **场景特征**: 碎片化时间，高频快节奏（平均 3-5秒/题）。

---

## 2. 数据层需求 (The Seed)

数据库不再存储静态题目，仅存储 LLM 生成所需的“原料”。

### 2.1 `Vocab` 表 (静态元数据)

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| `id` | Int | 单词唯一标识 | 索引 |
| `word` | String | e.g., "Negotiate" | Target Word |
| `meaning` | String | e.g., "v. 谈判，协商" | 基础释义兜底 |
| `pos` | String[] | e.g., `["verb"]` | 决定生成的句法结构 (词性陷阱原料) |
| `collocations` | String[] | e.g., `["contract", "deal", "terms"]` | **SVO 生成的核心原料**。必须是 TOEIC 高频搭配。 |
| `confusing_words` | String[] | e.g., `["navigate"]` | **形近词陷阱的核心原料**。由 Python Levenshtein 脚本预算。 |

### 2.2 `UserProgress` 表 (FSRS 动态参数)

| 字段 | 说明 | 驱动逻辑 |
| --- | --- | --- |
| `state` | New / Learning / Review / Relearning | 决定**题目类型** (SVO vs 语法 vs 辨析) |
| `stability` | 记忆稳定性 (天数) | 决定**题目复杂度** (S < 7天考语法, S > 21天考辨析) |
| `difficulty` | 难度系数 (1-10) | 决定**干扰项强度** (D 越高，干扰项越弱；D 越低，干扰项越强) |

---

## 3. 逻辑层：FSRS 参数驱动的生成矩阵 (The Matrix)

这是本模块的**大脑**。后端 Worker 需根据 FSRS 参数，将请求路由到不同的 Prompt 模板。

| 阶段 (Stage) | 触发条件 (Condition) | 教学目标 (Goal) | 生成策略 (Strategy) | 干扰项逻辑 (Distractors) |
| --- | --- | --- | --- | --- |
| **Stage 1: 建立连接** | `State = New / Learning` | **混个脸熟** | **SVO Core (High Freq)**<br>

<br>只考最核心的搭配，结构极简。 | **随机无关名词**<br>

<br>语义距离远，一眼能排除。<br>

<br>*(e.g., Apple, Sky)* |
| **Stage 2: 语法意识** | `State = Review` <br>

<br> `Stability < 7 days` | **词性区分**<br>

<br>(TOEIC Part 5) | **POS Trap (词性陷阱)**<br>

<br>构造强语法约束的句子，挖空处词性唯一。 | **同根变形词**<br>

<br>词根相同，后缀不同。<br>

<br>*(e.g., Negotiation, Negotiable)* |
| **Stage 3: 语义精读** | `State = Review` <br>

<br> `7 < Stability < 21` | **语义精准**<br>

<br>防止记混 | **Semantic Switch**<br>

<br>更换搭配词，扩展语义网。 | **近义词/反义词**<br>

<br>商务语境下的错误选项。<br>

<br>*(e.g., Debate, Argue)* |
| **Stage 4: 抗干扰** | `State = Review` <br>

<br> `Stability > 21 days` | **精准辨析**<br>

<br>(防眼花) | **Visual Trap (形近词)**<br>

<br>针对性辨析长得像的词。 | **形近词 (Lookalikes)**<br>

<br>读取 `confusing_words`。<br>

<br>*(e.g., Navigate)* |
| **Stage 5: 补救** | `State = Relearning` | **多点挂钩** | **Alternative SVO**<br>

<br>绝对不能和上次错的一样，换个角度切入。 | **弱干扰项**<br>

<br>降低难度，重建信心。 |

---

## 4. 生成层：LLM Prompt 设计 (The Chef)

系统将使用统一的 `System Prompt` 配合动态的 `User Prompt`。

### 4.1 System Prompt

```markdown
You are an expert TOEIC Exam Content Generator. 
Your goal is to generate high-quality "Speed Run" drills based on specific constraints.
Context: Strictly Business / Corporate / Office scenarios.
Output Format: JSON only.
Structure: 
{
  "stem": "The question text with ____",
  "options": [
    {"text": "Option A", "isCorrect": true, "analysis": "Why correct"},
    {"text": "Option B", "isCorrect": false, "analysis": "Why incorrect"}
    ... (4 options total)
  ],
  "svo_type": "subject_verb | verb_object | grammar_pos"
}

```

### 4.2 动态 Prompt 模板实例

#### A. 针对 Stage 1 (New) - 基础搭配

* **Template**:
> Target: `"${word}"`.
> Task: Generate a simple **Verb + Object** phrase using the most common collocation from this list: `[${collocations}]`.
> Distractors: 3 concrete nouns totally unrelated to business (e.g., animals, food, nature).


* **Result**:
> Stem: **Negotiate the ______**
> Options: **Contract** (True), Banana, River, Sleep.



#### B. 针对 Stage 2 (Review < 7d) - 词性陷阱

* **Template**:
> Target: `"${word}"` (POS: {pos}**.
> Distractors: Generate 3 morphological derivations (word family) of the target.


* **Result**:
> Stem: **We need to ______ the price immediately.**
> Options: **Negotiate** (True), Negotiation, Negotiable, Negotiator.



#### C. 针对 Stage 4 (Master) - 形近词找茬

* **Template**:
> Target: `"${word}"`.
> Constraint: Include `"${confusing_words[0]}"` as a distractor.
> Task: Write a short TOEIC business sentence where ONLY the Target makes logical sense, but the distractor looks visually similar.


* **Result**:
> Stem: **Please ______ the final details of the agreement.**
> Options: **Negotiate** (True), Navigate (Visual Trap), Notice, Negate.



---

## 5. 交互与体验流程 (The Flow)

### 5.1 前端展示 (Speed Run Mode)

为了保持“刷题”的快感，UI 需极简。

* **Zone A (Stimulus)**:
* 显示生成的 **SVO 微语境** (例如: *Negotiate the ______*)。
* **高亮**上下文关键词 (例如高亮 *Contract*)，辅助快速聚焦。


* **Zone B (Response)**:
* 4 个大按钮。
* 点击后 **0延迟** 反馈（绿/红）。


* **Zone C (Feedback - AI Snippet)**:
* 做对：自动进入下一题 (时间 < 0.5s)。
* 做错：暂停，弹出底部 Sheet。
* **LLM 预生成的解析**: *"Contract (合同) 是商务中常用的 Negotiate 对象。Banana (香蕉) 逻辑不通。"*



### 5.2 兜底机制 (Fail-safe)

由于依赖实时生成，必须考虑 LLM 故障或生成超时。

* **Plan B**: 如果 LLM 在 2秒内未返回：
* **降级策略**: 回退到数据库查表模式。
* **显示**: 单词 (Big Text) + 4个中文释义选项。
* **记录**: 标记该词本次生成失败，加入重试队列。



---

## 6. 总结：核心价值点

1. **Anti-Boredom (抗枯燥)**: 用户永远不会遇到两道完全一样的题。即使是同一个词 `Negotiate`，今天考搭配 `Contract`，明天考词性 `Negotiation`。
2. **Exam-Oriented (应试导向)**: 所有生成的微语境（SVO）都直接对应 TOEIC Part 5 (语法) 和 Part 7 (阅读) 的考点，而非单纯的背字典。
3. **Adaptive (自适应)**: FSRS 自动控制难度。新手不会遇到变态的形近词干扰，大师不会做无聊的“选中文”题。

此方案实现了 **“数据轻量化 (只存词)”** 与 **“体验重量化 (AI 生成)”** 的完美平衡。