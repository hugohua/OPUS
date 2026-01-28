# OMPS 选词引擎技术规范

> **OMPS** = Opus Mixed-Priority Scheduler  
> 版本: V1.1  
> 更新日期: 2026-01-28

---

## 1. 概述

OMPS 是 Opus 系统的**核心选词引擎**，负责决定用户在任何学习场景中应该学习/复习哪些词汇。它采用**Schedule-First**的设计哲学：先确定"学什么"，再决定"怎么学"。

### 1.1 设计原则

| 原则 | 描述 |
|:-----|:-----|
| **复习优先 (Debt First)** | 70% 配额给到期复习词，防止遗忘曲线崩塌 |
| **新词分层 (Stratified New)** | 新词按难度分层采样 (20% 简单 / 60% 核心 / 20% 困难) |
| **动态溢出 (Spillover)** | 复习债务不足时，自动将配额转移给新词 |
| **统一接口 (Single API)** | Session Drill 和 Article Mode 共用同一选词逻辑 |

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────┐
│                     调用层 (Consumers)                   │
├─────────────────────────────────────────────────────────┤
│  actions/get-next-drill.ts   │  lib/services/WordSelectionService.ts
│  (Session Drill Mode)        │  (Article Mode)
└──────────────────┬───────────┴──────────────┬───────────┘
                   │                          │
                   ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│              lib/services/omps-core.ts                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  fetchOMPSCandidates(userId, limit, config)     │   │
│  │  ├── Phase 1: Macro Scheduler (70/30)           │   │
│  │  │   └── prisma.userProgress.findMany(FSRS)     │   │
│  │  ├── Phase 2: Micro Sampler (Stratified)        │   │
│  │  │   ├── fetchNewBucket(SIMPLE, 20%)            │   │
│  │  │   ├── fetchNewBucket(CORE, 60%)              │   │
│  │  │   └── fetchNewBucket(HARD, 20%)              │   │
│  │  └── Phase 3: Shuffle & Return                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. API 参考

### 2.1 主入口：`fetchOMPSCandidates`

```typescript
import { fetchOMPSCandidates, OMPSCandidate, OMPSConfig } from '@/lib/services/omps-core';

const candidates: OMPSCandidate[] = await fetchOMPSCandidates(
    userId,      // 用户 ID (CUID)
    limit,       // 需要的词汇数量
    config?,     // 可选配置 (覆盖默认比例)
    excludeIds?  // 排除的词汇 ID 列表
);
```

### 2.2 配置接口

```typescript
interface OMPSConfig {
    reviewRatio: number;   // 复习配额 (默认 0.7)
    simpleRatio: number;   // 简单新词 (默认 0.2)
    coreRatio: number;     // 核心新词 (默认 0.6)
    hardRatio: number;     // 困难新词 (默认 0.2)
    posFilter?: string[];  // 词性过滤 (可选)
}
```

### 2.3 返回类型

```typescript
interface OMPSCandidate {
    vocabId: number;
    word: string;
    definition_cn: string;
    type: 'REVIEW' | 'NEW';  // 来源类型
    priority_level: number;
    frequency_score: number;
    commonExample: string | null;
    // ... 其他字段
}
```

---

## 3. 分层逻辑详解

### 3.1 Macro Scheduler (宏观调度)

```
用户请求 10 个词汇
        │
        ▼
┌───────────────────┐
│  Phase 1: 复习债务  │
│  Quota = 70% = 7   │
└─────────┬─────────┘
          │
          ▼
    实际债务 = 3
    (只有 3 个词到期)
          │
          ▼
    Spillover = 7 - 3 = 4
    新词配额 = 30% + 4 = 7
```

### 3.2 Micro Sampler (微观采样)

新词按 `abceed_level` 分层：

| Bucket | Level 范围 | 配额 | 选词逻辑 |
|:-------|:-----------|:-----|:---------|
| SIMPLE | 1-3 | 20% | 建立信心，降低认知负荷 |
| CORE | 4-7 OR `is_toeic_core` | 60% | 高价值词，考试高频 |
| HARD | 8+ | 20% | 防止无聊，保持挑战 |
| FALLBACK | 无限制 | 0% | 仅在其他桶耗尽时启用 |

### 3.3 排序优先级

每个 Bucket 内部的排序：
1. `is_toeic_core: DESC` (核心词优先)
2. `frequency_score: DESC` (高频词优先)

---

## 4. 复用场景

### 4.1 已接入场景

| 场景 | 调用方式 | 配置 |
|:-----|:---------|:-----|
| **Session Drill (SYNTAX)** | `fetchOMPSCandidates(userId, 10, { posFilter: ['v', 'n', ...] })` | 词性过滤启用 |
| **Session Drill (PHRASE)** | `fetchOMPSCandidates(userId, 10)` | 默认配置 |
| **Article Mode** | `fetchOMPSCandidates(userId, 1)` + `ContextSelector` | 获取 1 个主角词 |

### 4.2 建议接入场景

以下场景在未来开发时**必须**使用 OMPS：

- [ ] **Daily Challenge**: 每日挑战词汇选取
- [ ] **Review Session**: 专项复习模式
- [ ] **Vocabulary List**: 用户词汇表排序
- [ ] **Push Notification**: 复习提醒词汇选取

### 4.3 不适用场景

以下场景**禁止**使用 OMPS：

- ❌ **Context Words 选取**: 使用 `ContextSelector` (语义相似性)
- ❌ **Distractor 生成**: 使用 `DistractorSelector` (视觉/语义冲突)

---

## 5. 开发规范

### 5.1 新增场景接入

1. **导入共享模块**：
   ```typescript
   import { fetchOMPSCandidates } from '@/lib/services/omps-core';
   ```

2. **传递正确的 excludeIds**：
   ```typescript
   // 确保不返回用户本次会话已见过的词
   const candidates = await fetchOMPSCandidates(userId, limit, {}, alreadySeenIds);
   ```

3. **处理空结果**：
   ```typescript
   if (candidates.length === 0) {
       // 提示用户词库已学完，或降级到随机选词
   }
   ```

### 5.2 配置覆盖

如需调整配比（需产品确认）：

```typescript
// 例：复习专项模式 (100% 复习，0% 新词)
const reviewOnlyCandidates = await fetchOMPSCandidates(userId, 20, {
    reviewRatio: 1.0,
    simpleRatio: 0,
    coreRatio: 0,
    hardRatio: 0
});
```

### 5.3 测试要求

新增调用方必须编写以下测试：

1. **Mock OMPS 返回值**：不要测试 OMPS 内部逻辑（已覆盖）
2. **验证 excludeIds 传递**：确保无重复词
3. **验证空结果处理**：边界情况

---

## 6. 测试与仿真

### 6.1 单元测试

```bash
npm test lib/services/__tests__/omps-core.test.ts
```

测试套件覆盖：
- Suite A: Macro Scheduler (4 用例)
- Suite B: Micro Sampler (4 用例)
- Suite C: Edge Cases (5 用例)
- Suite D: Integration (3 用例)

### 6.2 仿真测试

```bash
npx tsx scripts/sim-omps-full.ts --userId=<cuid> --batches=10
```

输出报告包含：
- 总体统计 (总数/唯一/重复)
- 来源分布 (cache/fallback)
- 批次详情

---

## 7. 常见问题

### Q1: 为什么 100% 都是 `deterministic_fallback`？

**A**: 这是冷启动的正常表现。Redis 缓存为空时，系统使用确定性兜底确保用户不等待。后台任务 (Batch Emergency) 会自动补货，下次请求将命中缓存。

### Q2: 如何验证复习优先级是否生效？

**A**: 运行仿真脚本并检查日志中的 `reviewCount` / `newCount`：
```
[INFO] OMPS candidates fetched { reviewCount: 7, newCount: 3 }
```
如果 `reviewCount > 0`，说明有复习债务被优先选中。

### Q3: 新词的分层比例可以调整吗？

**A**: 可以，但需产品确认。通过 `OMPSConfig` 传入自定义比例：
```typescript
{ simpleRatio: 0.1, coreRatio: 0.8, hardRatio: 0.1 }
```

---

## 8. 变更日志

| 版本 | 日期 | 变更 |
|:-----|:-----|:-----|
| V1.0 | 2026-01-28 | 初始实现，集成到 `get-next-drill.ts` |
| V1.1 | 2026-01-28 | 抽取为共享模块 `omps-core.ts`，Article Mode 接入 |
