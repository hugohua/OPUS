# 1+N Context Word Selection (Vector Enhanced)

**Version**: 2.0 (Vector-Driven)  
**Date**: 2026-01-27  
**Implementation**: `workers/drill-processor.ts`

## 1. 核心背景 (Background)

Opus 的 Level 0 核心训练机制是 **"1+N" Drill System**：
- **"1" (Target Word)**: 用户当前需要学习的核心词汇。
- **"N" (Context Words)**: 3 个辅助词汇，作为修饰语 (Adjectives/Nouns) 融入 S-V-O 句型中。

原有的选词逻辑是简单的 **Random Selection**，仅仅排除了自身和过短的词。这导致生成的句子语境割裂，上下文与目标词缺乏关联。

## 2. 升级目标 (Objective)

利用数据库中已有的 **Vector Embeddings (1536d)**，实现 **语义相关** 的上下文选词。
同时遵循 **"Reinforce Known Words"** 原则，优先从用户已学过的词中挑选，以巩固记忆。

## 3. 混合选词策略 (Hybrid Strategy)

新的 `getContextWords` 实现采用了三级降级策略 (Waterfall Strategy)：

### 策略 A: 用户复习队列 (User Progress Vector Search) - 优先级最高
*   **逻辑**: 在用户 **正在学习 (LEARNING)** 或 **复习中 (REVIEW)** 的词汇池中，寻找与 Target Word 语义距离最近的词。
*   **计算**: PostgreSQL `vector` 插件的 `<=>` (Cosine Distance) 操作符。
*   **SQL**:
    ```sql
    SELECT v.word
    FROM "UserProgress" up
    JOIN "Vocab" v ON up."vocabId" = v.id
    WHERE up."userId" = ${userId}
      AND up.status IN ('LEARNING', 'REVIEW')
      AND v.id != ${targetVocabId}
      AND v.embedding IS NOT NULL
    ORDER BY v.embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${targetVocabId})
    LIMIT 3;
    ```
*   **价值**: 
    1.  **复习**: 让旧词在新语境中重复出现（Spaced Repetition with Context）。
    2.  **连贯**: 保证生成的句子语意场（Semantic Field）统一。

### 策略 B: 全局语义补全 (Global Vector Search) - 补位
*   **逻辑**: 当用户属于冷启动阶段（已学词汇很少），或已学词汇与目标词相关性极低时，策略 A 可能返回不足 3 个词。此时从 **全局 Vocab 表** 中寻找最语义相关的词进行补全。
*   **限制**: 排除已选中的词。
*   **价值**: 确保即使是新用户，也能获得高质量、强相关的例句。

### 策略 C: 随机兜底 (Random Fallback) - 最后防线
*   **逻辑**: 仅当目标词本身没有 Embedding（数据缺失），或者数据库向量查询异常失败时触发。
*   **行为**: 随机选取 `CHAR_LENGTH > 3` 的词。

## 4. 验证案例

**Target**: `absorb` (v. 吸收；承担)

| 策略 | 选词结果 | 语义距离 (Distance) | 关联度 |
| :--- | :--- | :--- | :--- |
| **Random (Old)** | `rejection`, `persist`, `reading` | N/A | 低 (完全随机) |
| **Vector (New)** | `adopt`, `assume`, `engage` | ~0.25 | **高** (承担责任、采纳建议等商务语境高度重合) |

## 5. 代码实现

```typescript
// workers/drill-processor.ts

async function getContextWords(userId, targetVocabId, targetWord) {
    // 0. Check Embedding Exists
    // 1. Strategy A: User Progress Vector Search
    // 2. Strategy B: Global Vocab Vector Search (if A < 3)
    // 3. Strategy C: Random Fallback (if A+B < 3)
}
```
