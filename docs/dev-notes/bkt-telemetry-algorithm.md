# BKT 追踪算法与全景遥测机制

## 1. 算法背景 (Bayesian Knowledge Tracing)
Opus 在词汇维度使用 FSRS 算法追踪记忆衰退，但在语法维度使用 BKT 算法追踪知识掌握。因为语法不是死记硬背的离散属性，而是具有推导性的技能。

## 2. 数学模型
核心是一个隐马尔可夫模型 (HMM)，追踪学生处于掌握状态的后验概率 $P(L_n)$。
我们的实现（`lib/algorithm/bkt.ts`）剥离了复杂的全图推断，采用了简化的平滑贝叶斯更新：
- **基础先验 ($L_0$)**：0.3 (假设初学者已有一定语感)
- **学习率 ($T$)**：0.15 (一次正确练习带来的状态跃迁概率)
- **答题滑脱 ($S$)**：0.1 (会做但失误的概率)
- **盲猜正确 ($G$)**：0.25 (四选一盲猜)

**更新公式**：
正确时：$P(L_{n-1} | \text{Correct}) = \frac{P(L_{n-1}) \cdot (1 - S)}{P(L_{n-1}) \cdot (1 - S) + (1 - P(L_{n-1})) \cdot G}$
错误时：$P(L_{n-1} | \text{Incorrect}) = \frac{P(L_{n-1}) \cdot S}{P(L_{n-1}) \cdot S + (1 - P(L_{n-1})) \cdot (1 - G)}$
后验整合：$P(L_n) = P(L_{n-1} | \text{obs}) + (1 - P(L_{n-1} | \text{obs})) \cdot T$

## 3. 降维打击与向上穿透
BKT 算法仅在最小颗粒度 (L3 Knot) 运行。
- **向上穿透**：当某个 L3 节点更新后，后台触发 `propagateMasteryUpward`，按子节点均值重算其父级 L2 和 L1 的分数。这保证了雷达图数据的实时一致性。
- **弱点隔离**：通过 `getActionRequiredNodes（找出分数最低的 L3）` 实现降维诊断，让宏观的（L1 动词薄弱）转化为具象的（L3 现在完成时薄弱）。

## 4. 遥测防抖 (Telemetry Debouncing)
在 `arena-telemetry.ts` 中：
1. 拦截 Arena Part 5 答题结果。
2. 通过原题信息拿到 `grammarNodeId`。
3. 异步触发 `updateGrammarMastery` 纯函数。
(不阻塞 Server Action 返回前端的时间，遵守 Zero-Wait)。
