# Opus Drill Scenarios Index (UX Design Reference)

本文档整理了 L0、L1、L2 三个阶段共计 12 种答题场景的核心交互特征，供 UX/UI 设计参考。

## 🎯 Task 1: Speed Run (L0) - 极速刷词
**核心体验**: 唯快不破 (Blitz)。不考长难句，只考核心搭配与形义连接。

| 场景 ID | 场景名称 | 触发条件 | UX 核心特征 (Interaction) | 视觉重点 (Visual Focus) |
| :--- | :--- | :--- | :--- | :--- |
| **L0-1** | **SVO Core** <br>(SVO 微语境) | New / Learning | **Swipe Card / Bubble Select** <br> 快速二选一或四选一。 | **Term Highlighting** <br> 高亮 SVO 中的 Target 和 Collocation。 |
| **L0-2** | **POS Trap** <br>(词性陷阱) | Review (<7d) | **Bubble Select (4 Options)** <br> 选项必须包含词性变化 (e.g., *Negotiate, Negotiation*)。 | **Gap Context** <br> 强调 Gap 前后的语法线索词。 |
| **L0-3** | **Semantic Switch** <br>(语义精读) | Review (7-21d) | **Bubble Select (4 Options)** <br> 选项是语义相近但搭配错误的词。 | **Collocation Focus** <br> 强调与 Target 搭配的 Object 或 Modifier。 |
| **L0-4** | **Visual Trap** <br>(抗干扰) | Review (>21d) | **Bubble Select (4 Options)** <br> 选项包含拼写极像的干扰项 (e.g., *Adapt, Adopt*)。 | **Spelling Detail** <br> 字体需清晰，便于区分细微拼写差异。 |
| **L0-5** | **Alternative SVO** <br>(补救模式) | Relearning | **Swipe Card** <br> 失败后的降级重试，结构更简单。 | **Simplicity** <br> 排除无关修饰，只留主干。 |

---

## 🎧 Task 2: Audio Gym (L1) - 听力健身房
**核心体验**: 解放双眼 (Eyes-Free)。先听后选，依靠听觉残像做题。

| 场景 ID | 场景名称 | 触发条件 | UX 核心特征 (Interaction) | 视觉重点 (Visual Focus) |
| :--- | :--- | :--- | :--- | :--- |
| **L1-1** | **Carrier Phrase** <br>(声音印记) | Review (<3d) | **Listen & Reveal** <br> 播放时屏幕无文本 -> 播放后显示文本和中文。 | **Waveform / Play Button** <br> 强调听觉输入，隐藏文本干扰。 |
| **L1-2** | **Q&A Logic** <br>(瞬间逻辑) | Review (3-15d) | **Binary Choice (Yes/No)** <br> 听到问题，快速判断逻辑对错。 | **Minimal UI** <br> 仅显示巨大的 Yes/No 按钮。 |
| **L1-3** | **Dialogue Snippet** <br>(关键词捕捉) | Review (>15d) | **Context Choice** <br> 听到对话 -> 选择对话发生场景或意图。 | **Scenario Icon** <br> 辅助图标 (Office, Phone, Meeting)。 |
| **L1-4** | **Minimal Pair** <br>(听觉辨析) | Difficulty > 7 | **A/B Sound Check** <br> 播放两个相似音，选择包含 Target 的那个。 | **Sound Comparison** <br> 左右两个播放按钮对比。 |

---

## 🧪 Task 3: Context Lab (L2) - 语境实验室
**核心体验**: 深度思考 (Deep Dive)。模拟 TOEIC Part 5/6/7，重逻辑推理。

| 场景 ID | 场景名称 | 触发条件 | UX 核心特征 (Interaction) | 视觉重点 (Visual Focus) |
| :--- | :--- | :--- | :--- | :--- |
| **L2-1** | **Sentence Cloze** <br>(逻辑搭配) | Stability < 45d | **Slot Machine / Text Input** <br> 单句挖空，上下文线索明确。 | **Keyword Linking** <br> 视觉上连接 Target 与线索词 (Hint)。 |
| **L2-2** | **Micro-Paragraph** <br>(上下文推断) | Stability > 45d | **Typeface Reader** <br> 2-3 句短文，模拟真实 Email/Memo 排版。 | **Document Style** <br> 邮件头、备忘录格式，沉浸感强。 |
| **L2-3** | **Nuance Trap** <br>(极致辨析) | Critical History | **Nuance Picker** <br> 选项是近义词，需根据语境微调选择。 | **Precision Highlight** <br> 高亮决定性的修饰语 (Adjectives/Adverbs)。 |

---

## 💡 UX 设计通用建议

1.  **Feedback Speed**: L0 必须是 **Instant (<200ms)**，L2 可以有 **Thinking Time**。
2.  **Error Handling**:
    *   L0 错误: 立即弹出简短解析，点击即走。
    *   L2 错误: 弹出 Socratic Tutor (苏格拉底助手)，引导思考，而非直接给答案。
3.  **Visual Hierarchy**:
    *   **L0**: 单词 > 句子。
    *   **L1**: 声音 > 按钮 > 文字。
    *   **L2**: 语境(文章) > 选项。
