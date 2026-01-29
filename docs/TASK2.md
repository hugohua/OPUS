# 🎧 AI-Native Task 2: Audio Gym (L1) 完整需求规格说明书

## 1. 产品定义与定位

* **名称**: Audio Gym (听力健身房)
* **定位**: L1 Bridge (腰部层)。连接“认字”与“实战”。只专注于 **“听觉反射”** 和 **“短语逻辑”**。
* **核心机制**: **Blind Input (盲听输入)** + **CosyVoice Acting (情感演绎)**。
* **场景特征**: 沉浸式，无需盯着屏幕（通勤/走路），依赖听觉捕捉信息。
* **TOEIC 对标**:
* **Part 2**: Question-Response (快速问答逻辑)
* **Part 3/4**: Short Conversations (关键词捕捉)



---

## 2. 数据层需求 (The Seed)

与 L0 类似，数据库不存音频文件，只存“脚本原料”。

### 2.1 `Vocab` 表 (静态元数据)

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| `id` | Int | 单词唯一标识 | 索引 |
| `word` | String | e.g., "Schedule" | Target Word |
| `phonetics` | String | e.g., `/ˈʃedʒ.uːl/` | 辅助 TTS 发音校准 (英/美音) |
| `collocations` | String[] | e.g., `["meeting", "conflict"]` | **1+N 听觉联想**的原料 |
| `confusion_audio` | String[] | e.g., `["skedaddle"]` | **听觉干扰项** (发音相似的词) |

### 2.2 `UserProgress` 表 (FSRS 动态参数)

| 字段 | 说明 | 驱动逻辑 |
| --- | --- | --- |
| `state` | Review (Young/Mature) | 决定**脚本类型** (单词复读 vs 问答 vs 对话) |
| `stability` | 记忆稳定性 | 决定**语速与噪音** (S 越高，语速越快，背景音越嘈杂) |
| `difficulty` | 难度系数 | 决定**情感复杂度** (D 越高，情绪越激动/含糊，模拟真实职场) |

---

## 3. 逻辑层：FSRS 参数驱动的生成矩阵 (The Matrix)

这是 Audio Gym 的核心调度器。我们不再只是播放单词读音，而是根据用户水平生成不同难度的 **“听觉剧本”**。

| 阶段 (Stage) | 触发条件 (Condition) | 教学目标 (Goal) | 剧本策略 (Script Strategy) | 演绎风格 (Acting Style) |
| --- | --- | --- | --- | --- |
| **Stage 1: 声音印记** | `State = Review` <br>

<br> `Stability < 3 days` | **听清发音**<br>

<br>建立音义连接 | **Carrier Phrase (载体短语)**<br>

<br>Target + 简单搭配。<br>

<br>*(e.g., "Check the schedule.")* | **Clear & Slow**<br>

<br>标准新闻播音腔，无背景音。 |
| **Stage 2: 瞬间逻辑** | `State = Review` <br>

<br> `3 < Stability < 15` | **听音反应**<br>

<br>(TOEIC Part 2) | **Q&A Logic (问答)**<br>

<br>生成一个包含 Target 的短问题。<br>

<br>*(e.g., "Who managed the schedule?")* | **Natural Speed**<br>

<br>正常职场语速，轻微口语吞音。 |
| **Stage 3: 关键词捕捉** | `State = Review` <br>

<br> `Stability > 15 days` | **干扰中抓词**<br>

<br>(TOEIC Part 3) | **Dialogue Snippet (对话片段)**<br>

<br>A/B 两人对话，Target 藏在中间。 | **Emotional & Fast**<br>

<br>带情绪（焦急/生气），甚至加入办公室背景白噪音。 |
| **Stage 4: 听觉辨析** | `Difficulty > 7` | **防听错** | **Minimal Pair (最小对立体)**<br>

<br>将 Target 与发音相近词放在一起。 | **Trick Articulation**<br>

<br>故意在相似音上重读。 |

---

## 4. 生成层：LLM + TTS 协同 (The Director)

Worker 接收请求后，分两步走：先让 LLM 写剧本，再让 TTS 演剧本。

### 4.1 Step 1: LLM Script Generation (编剧)

**System Prompt**:

```markdown
You are a TOEIC Audio Scriptwriter.
Goal: Generate audio scripts for listening drills.
Target Word: "${word}"
Constraint: Script must be under 15 words.
Output: JSON with "script", "speaker_role", "emotion_tag", "question_text".

```

**动态 Prompt 模板实例**:

* **针对 Stage 2 (Q&A Logic)**:
* **Prompt**: "Create a short TOEIC Part 2 style question containing 'Schedule'. It should be a 'Who' or 'When' question."
* **Output**: `{"script": "When is the new production schedule being released?", "emotion": "curious", "question_text": "什么时候发布？"}`


* **针对 Stage 3 (Dialogue)**:
* **Prompt**: "Create a 2-turn dialogue snippet. User acts as B. A mentions 'Schedule' with an angry tone."
* **Output**:
* Speaker A: "Why isn't the **schedule** updated yet?" (Emotion: Angry)
* Speaker B: (User needs to respond mentally)





### 4.2 Step 2: 1+N 听觉增强 (The Sound Cluster)

在 Audio Gym 中，**1+N 算法** 的作用是 **"Acoustic Priming" (听觉启动)**。

* 如果 Target 是 `Schedule`，算法找出听觉上常出现的搭配词 `Meeting`, `Time`, `Delay`。
* **LLM 指令**: "Ensure the script includes at least one associated word (${collocations}) to help context."
* **结果**: 脚本变成了 *"Why is the meeting **schedule** delayed?"* (Meeting 和 Delay 辅助用户大脑定位 Schedule)。

### 4.3 Step 3: TTS Rendering (演员)

利用 CosyVoice 或类似高阶 TTS 模型的能力。

* **Input**: Script + Emotion Tag
* **Processing**:
* 若 Stability 低 -> 调用 `Narration` 模型 (清晰)。
* 若 Stability 高 -> 调用 `Spontaneous` 模型 (带有 `umm`, `ahh`, 呼吸声)。


* **Output**: `.mp3` 音频流。

---

## 5. 交互与体验流程 (The Flow)

Audio Gym 的 UI 设计必须遵循 **"Eyes-Free" (解放双眼)** 原则。

### 5.1 界面状态

* **State A: Listening (播放中)**
* 屏幕全黑或只有动态波纹 (Waveform)。
* **没有任何文字**。绝对不能显示单词拼写（否则就变成了阅读题）。
* 播放音频 (由 TTS 生成)。


* **State B: Recall (回忆中)**
* 音频播完。
* 屏幕出现 3-4 个 **中文释义** 或 **逻辑应答** (取决于 Stage)。
* *TOEIC Part 2 模式*: 听到 *"When is the schedule released?"* -> 选项是 A. Tomorrow morning / B. In the office / C. Yes, I do. (考逻辑)


* **State C: Reveal (揭晓)**
* 用户选择后。
* 显示英文原文：*When is the **schedule** released?*
* 高亮 Target Word。
* 提供“再听一遍”按钮（慢速版）。



### 5.2 兜底机制

* **Audio Cache**: 为了防止 TTS 生成延迟，Worker 应该对 **Stage 1 (简单模式)** 的音频进行 LRU 缓存。相同的单词和简单的 Carrier Phrase 可以复用。
* **Stage 3 (复杂模式)** 必须实时生成，保证“无限变奏”。

---

## 6. 总结：核心价值点

1. **True Listening (真听力)**: 彻底切断视觉依赖。很多 App 是看着单词听发音，用户其实是在“读”。Audio Gym 强迫用户只用耳朵。
2. **Emotional Resilience (情绪脱敏)**: 通过模拟愤怒、急促、含糊的语音，让用户适应真实职场环境（和 TOEIC 听力难点）。
3. **Logic Training (逻辑训练)**:
* 在 L0，我们训练 `Negotiate` = `谈判`。
* 在 L1，我们训练 听到 `When... schedule?` -> 反应出 `Time`。
* 这是从“翻译”到“反应”的质变。
