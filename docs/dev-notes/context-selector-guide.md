# 上下文智能选词指南 (PRO Max)

`ContextSelector` (`lib/ai/context-selector.ts`) 是系统的核心大脑，负责检索语义相关的词汇。它采用 **"Shopper (采购员) + Chef (厨师)"** 架构，连接原始数据与大模型生成。

## 1. 核心架构：Shopper + Chef

### 🛒 The Shopper (代码层)
**组件**: `ContextSelector`
**角色**: 高精度地获取“食材”（单词）。
**逻辑**:
1.  **Goldilocks Zone (精确区)**: 第一轮搜索，锁定距离 `0.15 < d < 0.5` 的词。
    *   *< 0.15*: 拒绝（太近/同义词）。
    *   *> 0.5*: 拒绝（太远/不相关）。
2.  **Elastic Relaxation (弹性补位)**: 如果第一轮找不到足够的词，自动放宽网兜至 `0.10 < d < 0.7`。
3.  **Fallback (兜底)**: 随机选词（仅作为最后手段）。

### 👨‍🍳 The Chef (LLM层)
**组件**: `lib/prompts/context-sentence.ts`
**角色**: 具备容错能力的“烹饪”（造句）。
**逻辑**:
*   **Soft Filter (软过滤)**: 明确授权 LLM 使用 `dropped_context` 字段**丢弃**任何会导致句子生硬的“食材”。
*   **结果**: 确保所有被使用的词都恰当自然。

---

## 2. 使用场景

| 场景 | 配置策略 | 数量 (Count) | 目的 |
| :--- | :--- | :--- | :--- |
| **Drill Generation** | `['USER_VECTOR', 'GLOBAL_VECTOR', 'RANDOM']` | 3 | 生成包含 Target + 3 个 Context 词的连贯单句。 |
| **Article Generation** | `['USER_VECTOR', 'GLOBAL_VECTOR']` | 15 | 生成包含 15 个相关词的短文/邮件。 |
| **Distractor Gen** | **❌ 禁止使用 (BANNED)** | N/A | 请使用 `DistractorSelector`。Context 词语义太近，做干扰项会导致题目无解。 |

---

## 3. 复用模式 (Pattern)

### Step 1: 采购食材 (Shopper)
调用 `ContextSelector`。它会自动处理混合策略（User -> Global）和弹性搜索。

```typescript
import { ContextSelector } from '@/lib/ai/context-selector';

const context = await ContextSelector.select(userId, targetId, { count: 3 });
// 返回: [{ word: "budget", ... }, { word: "finance", ... }]
```

### Step 2: 烹饪 (Chef)
将食材发送给 LLM，务必使用标准 Prompt。

```typescript
import { CONTEXT_SENTENCE_PROMPT } from '@/lib/prompts/context-sentence';

const prompt = CONTEXT_SENTENCE_PROMPT
  .replace('${targetWord}', target.word)
  .replace('${contextWords}', context.map(w => w.word).join(', '));

// LLM 返回 JSON: { sentence: "...", dropped_context: [] }
```

---

## 4. 边界与隔离

为了防止架构腐化，我们显式隔离了以下能力：

*   **`lib/ai/context-selector.ts`**:
    *   ✅ 用于 **生成 (Generation)** (造句、写文章)。
    *   ✅ 搜索模式: **语义相似性 (Semantic Similarity)**。
*   **`lib/ai/distractor-selector.ts`**:
    *   ✅ 用于 **辨析 (Discrimination)** (做题、多选)。
    *   ✅ 搜索模式: **字形相似 (Visual)**、**词性匹配 (POS)**、**话题冲突 (Topic Clash)**。
    *   ❌ **绝对禁止** 在这里使用 `ContextSelector`，否则会生成“双重正确”的题目。
