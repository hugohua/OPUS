# 🧩 AI-Native Task 1.5: Chunking Gym (L1.5) 完整需求规格说明书

## 1. 产品定义与定位

* **名称**: Chunking Gym (语块排序)
* **别名**: The Boardroom Assembler (会议室组装工)
* **定位**: L1.5 Bridge-Prep (预腰部层)。连接 L0 "简单 SVO" 与 L2 "整段阅读" 之间的认知断层。
* **核心机制**: **Sentence Reordering (语块排序)** + **Three-Layer Analysis (三层解析法)**。
* **场景特征**: 训练用户处理 TOEIC Part 5/6 中的长难句，培养意群断句能力。

---

## 2. 与 L0 PHRASE 的差异

| 维度 | L0 PHRASE | L1.5 CHUNKING |
| --- | --- | --- |
| **句型复杂度** | 简单 SVO (5-10 词) | 复杂句 (15-25 词) |
| **结构要求** | 无从句 | 必须含从句/介词短语 |
| **交互模式** | 被动学习 + FSRS 自评 | 拖拽排序 / 多余项剔除 |
| **目标** | 形义连接 | 逻辑组装、长句拆解 |

---

## 3. 数据层需求 (The Seed)

### 3.1 输入字段 (ChunkingGeneratorInput)

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `targetWord` | String | 目标词汇，句子的语义锚点 |
| `meaning` | String (可选) | 词汇释义 |
| `context` | String (可选) | 商务场景 (e.g., "Contract renewal") |

### 3.2 输出结构 (ChunkingDrillOutput)

```typescript
interface ChunkingDrillOutput {
  target_word: string;
  full_sentence: string;      // 15-25 词复杂句
  translation_cn: string;
  grammar_point: string;      // 语法点 (e.g., "Adverbial Clause of Concession")
  complexity_level: "Medium" | "High";

  chunks: Array<{
    id: number;
    text: string;
    type: "S" | "V" | "O" | "MOD" | "CONJ";
  }>;

  distractor_chunk: string | null;  // 可选干扰项

  analysis: {
    skeleton: { subject: string; verb: string; object: string };
    links: Array<{ from_chunk_id: number; to_chunk_id: number; reason: string }>;
    business_insight: string;
  };
}
```

---

## 4. 逻辑层：三层解析法 (The Analysis)

### Layer 1: 骨架透视 (Skeleton View)
- 提取主干：**谁 (Subject) + 做了什么 (Verb) + 结果 (Object)**
- 目的：让用户一眼看到句子核心

### Layer 2: 接口分析 (Linkage Analysis)
- 解释 **Chunk A 的尾巴** 为什么能接 **Chunk B 的头**
- 数组长度 = chunks.length - 1
- 示例：`"关系代词 'that' 指代 'compromise'，引导定语从句说明细节。"`

### Layer 3: 商务洞察 (Business Insight)
- 解释这种语序在商务场景下的作用
- 示例：`"在谈判汇报中，常用 Although 先抑后扬，突出最终成果。"`

---

## 5. 生成层：LLM Prompt 设计

### 5.1 句子复杂度要求

```
1. **Length**: 15 - 25 words (Strict)
2. **Complexity**: MUST include at least ONE of:
   - Subordinate Clause (Although, Since, If, While...)
   - Relative Clause (who, which, that...)
   - Participle Phrase (Doing..., Done...)
   - Prepositional Chain (in addition to, due to the lack of...)
3. **Tone**: Formal, Professional, Corporate
```

### 5.2 切分规则 (Chunking Logic)

```
Split the sentence into 3 to 5 logical chunks.
**DO NOT split single words.** Split by "Sense Groups".

Valid Splits:
- [Despite the unexpected delay] [in the supply chain,] [we managed to meet] [the deadline.]
- [The marketing manager,] [who was recently hired,] [proposed a new strategy] [for the campaign.]

Chunk Size: Minimum 3 words unless it's a transition word.
```

---

## 6. 交互与体验流程 (The Flow)

### 6.1 玩法 A：拖拽排序 (Drag & Reorder)

1. 屏幕随机散落 3-5 个块
2. 用户拖拽按顺序组装
3. 考核点：连词位置、定语从句紧跟先行词

### 6.2 玩法 B：多余项剔除 (Odd One Out)

1. 显示正确的 chunks + 1 个 `distractor_chunk`
2. 用户先剔除错误块，再排序
3. 考核点：逻辑辨析 (Although vs Because)

### 6.3 前端展示建议

#### 骨架透视 View
- 修饰成分变灰 (Fade out)
- 主谓宾高亮 (Bold & Color)

#### 链条高亮 View
- chunk 连接处显示 🔗 图标
- 点击弹出气泡解释

---

## 7. 示例数据

**输入**: `{ "targetWord": "negotiate", "context": "Contract renewal" }`

**输出**:
```json
{
  "target_word": "negotiate",
  "full_sentence": "Although the initial terms were unfavorable, we successfully negotiated a compromise that satisfied both parties.",
  "translation_cn": "虽然最初的条款不利，但我们成功通过谈判达成了一个让双方都满意的折中方案。",
  "grammar_point": "Adverbial Clause of Concession (Although)",
  "complexity_level": "Medium",
  "chunks": [
    { "id": 1, "text": "Although the initial terms", "type": "CONJ" },
    { "id": 2, "text": "were unfavorable,", "type": "MOD" },
    { "id": 3, "text": "we successfully negotiated", "type": "S" },
    { "id": 4, "text": "a compromise", "type": "O" },
    { "id": 5, "text": "that satisfied both parties.", "type": "MOD" }
  ],
  "distractor_chunk": "because the terms",
  "analysis": {
    "skeleton": { "subject": "we", "verb": "negotiated", "object": "a compromise" },
    "links": [
      { "from_chunk_id": 1, "to_chunk_id": 2, "reason": "连词 'Although' 引导让步状语从句，'were unfavorable' 补全从句谓语。" },
      { "from_chunk_id": 2, "to_chunk_id": 3, "reason": "逗号分隔。让步从句结束，主句 'we negotiated' 开始。" },
      { "from_chunk_id": 3, "to_chunk_id": 4, "reason": "及物动词 'negotiated' 后需接宾语 'a compromise'。" },
      { "from_chunk_id": 4, "to_chunk_id": 5, "reason": "关系代词 'that' 指代 'compromise'，引导定语从句说明细节。" }
    ],
    "business_insight": "在谈判汇报中，常用 Although 先抑后扬，突出最终成果，展现问题解决能力。"
  }
}
```

---

## 8. 总结：核心价值点

1. **Bridge the Gap (弥补断层)**: L0 简单句到 L2 长难句之间的认知阶梯。
2. **Linkage Analysis (接口解析)**: 告诉用户"积木的接口"——为什么块与块之间能连接。
3. **Business Logic (商务逻辑)**: 解释语序在商务场景的作用，而非死背语法规则。

这种 **"Step-by-Step Linkage Analysis"** 是市面上英语学习 App 极其缺乏的差异化功能。
