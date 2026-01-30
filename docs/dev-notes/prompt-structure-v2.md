# Opus Drill Engine - Prompt Structure V2.0 (Standard)
> 日期：2026-01-30
> 状态：Standard (Draft)

## 1. 概述
为了支持更丰富的教学场景（如陷阱解析、元数据追踪），Level 0 的 Drill 生成器（Phrase, Blitz 等）已升级为 V2 结构。本规范定义了标准化的 JSON 输出协议。

## 2. 核心结构 (BriefingPayload)

API 输出必须符合 `BriefingPayload` 接口。

```typescript
interface BriefingPayload {
  meta: {
    mode: "PHRASE" | "BLITZ" | "SYNTAX" | ...;
    format: "chat";
    target_word: string;
    // 其他元数据
  };
  segments: DrillSegment[];
}
```

## 3. DrillSegment 详解

### 3.1 文本段 (Text Segment)
用于展示题干或核心词。

```json
{
  "type": "text",
  "content_markdown": "#### TargetWord", // Markdown 格式
  "translation_cn": "中文释义"
}
```

### 3.2 交互段 (Interaction Segment)
核心答题区域。

```json
{
  "type": "interaction",
  "dimension": "C" | "V",
  "task": {
    "style": "bubble_select",
    "question_markdown": "stem string",
    "answer_key": "TargetWord",
    "options": [ ... ], // 见下文
    "explanation": { ... } // 见下文
  }
}
```

---

## 4. 标准化字段

### 4.1 Options (选项)

支持 **简单字符串** (Legacy) 和 **富对象** (Rich, 推荐) 两种格式。UI 层负责兼容。

**Format A: Rich Object (Standard)**
推荐使用此格式，便于前端埋点和分析错误类型。
```json
"options": [
  { 
    "id": "A", 
    "text": "Correct Answer", 
    "is_correct": true, 
    "type": "Correct" 
  },
  { 
    "id": "B", 
    "text": "Trap Answer", 
    "is_correct": false, 
    "type": "POS_Trap" 
  },
  ...
]
```

**Format B: String Array (Legacy)**
仅限于简单场景。
```json
"options": ["Option A", "Option B", "Option C", "Option D"]
```

### 4.2 Explanation (解析)

支持 **Markdown 字符串** (Legacy) 和 **结构化对象** (Rich, 推荐)。

**Format A: Rich Object (Standard)**
```json
"explanation": {
  "title": "💡 Logic Check",
  "correct_logic": "**Formula**: ... \n **Why**: ...", // 正确选项的解析
  "trap_analysis": [ // 干扰项解析数组
    "**Why not B?**: ...",
    "**Why not C?**: ..."
  ]
}
```

**Format B: Markdown String (Legacy)**
```json
"explanation_markdown": "## Logic Check\n\nCorrect logic...\n\n- B: ..."
```

## 5. 校验规则 (Zod)
请参考 `lib/validations/briefing.ts` 获取最新的 Zod Schema 定义。所有生成器 Output 必须通过此 Schema 验证。
