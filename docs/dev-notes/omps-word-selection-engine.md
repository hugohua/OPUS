# OMPS 选词引擎技术规范

> **OMPS** = Opus Mixed-Priority Scheduler
> 版本: V3.1 (Arena Protocol + Word-Level Mastery)
> 更新日期: 2026-05-05

---

## 1. 概述

OMPS 是 Opus 系统的**唯一选词引擎**，负责决定用户在任何学习场景中应该学习/复习哪些词汇。它采用**Schedule-First**的设计哲学：先确定"学什么"，再决定"怎么学"。

### 1.1 设计原则

| 原则 | 描述 |
|:-----|:-----|
| **库存优先 (Inventory-First)** | Phase 0: 优先选择 Redis 中已有缓存的单词，避免 Fallback |
| **救援优先 (Rescue-First)** | Phase 0.5: 语法漏洞词 (dim_v < 30) 强制修补 |
| **复习优先 (Debt First)** | Phase 1: 到期复习词优先，防止遗忘曲线崩塌 |
| **新词分层 (Stratified New)** | Phase 2: 新词按难度分层采样 (20% 简单 / 60% 核心 / 20% 困难) |
| **词汇级排除 (Word-Level Mastery)** | 目标训练词统一排除 `UserVocabState.status = MASTERED` |
| **动态溢出 (Spillover)** | 任一桶不足时，名额自动转移给下一桶 |
| **统一接口 (Single API)** | 所有场景（Dojo/Arena/Blitz/Drive）共用同一选词逻辑 |

### 1.2 架构图

```
┌───────────────────────────────────────────────────────────┐
│                     调用层 (Consumers)                      │
├──────────┬──────────┬──────────┬───────────┬──────────────┤
│ Session  │ Article  │  Blitz   │   Drive   │ fetch-queue  │
│  Drill   │  Mode    │ Session  │ DISCOVERY │   (Admin)    │
└────┬─────┴────┬─────┴────┬─────┴─────┬─────┴──────┬───────┘
     │          │          │           │            │
     └──────────┴──────────┴─────┬─────┴────────────┘
                                 ▼
┌───────────────────────────────────────────────────────────┐
│              lib/services/omps-core.ts                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  fetchOMPSCandidates(userId, limit, config, ...)    │  │
│  │  ├── Phase 0:   Inventory-First (Redis Scan)        │  │
│  │  │   └── source: 'hot'                              │  │
│  │  ├── Phase 0.5: Rescue Queue [V3]                   │  │
│  │  │   └── dim_v_score < 30 → source: 'rescue'        │  │
│  │  ├── Phase 1:   Review Queue (FSRS Due)             │  │
│  │  │   └── source: 'review'                           │  │
│  │  ├── Phase 2:   New Words (Stratified)              │  │
│  │  │   ├── SIMPLE (20%) → abceed_level ≤ 3            │  │
│  │  │   ├── CORE   (60%) → TOEIC Core / Level 4-7     │  │
│  │  │   ├── HARD   (20%) → Level 8+                    │  │
│  │  │   └── source: 'new'                              │  │
│  │  └── Phase 3:   Shuffle & Audit                     │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## 2. 协议预设 (Protocol Presets)

OMPS 通过不同的 `OMPSConfig` 支持多种选词协议：

| 协议 | 常量 | Rescue | Review | New | 适用场景 |
|:-----|:-----|:-------|:-------|:----|:---------|
| **Dojo** | `OMPS_DOJO_CONFIG` | 0% | 70% | 30% | Session Drill (SYNTAX/PHRASE) |
| **Arena** | `OMPS_ARENA_CONFIG` | 30% | 50% | 20% | Blitz / fetch-queue / Arena |

```typescript
import { OMPS_DOJO_CONFIG, OMPS_ARENA_CONFIG } from '@/lib/services/omps-core';

// Dojo: 专注复习 + 新词
await fetchOMPSCandidates(userId, 10, OMPS_DOJO_CONFIG, [], 'SYNTAX');

// Arena: 含 Rescue 补救
await fetchOMPSCandidates(userId, 20, OMPS_ARENA_CONFIG, [], 'BLITZ');
```

---

## 3. API 参考

### 3.1 主入口：`fetchOMPSCandidates`

```typescript
import { fetchOMPSCandidates, OMPSCandidate, OMPSConfig } from '@/lib/services/omps-core';

const candidates: OMPSCandidate[] = await fetchOMPSCandidates(
    userId,      // 用户 ID (CUID)
    limit,       // 需要的词汇数量
    config?,     // 可选配置 (覆盖默认比例)
    excludeIds?, // 排除的词汇 ID 列表
    mode?        // 当前模式 (用于 Track 路由)
);
```

### 3.2 配置接口

```typescript
interface OMPSConfig {
    reviewRatio: number;   // 复习配额 (默认 0.7)
    rescueRatio: number;   // 救援配额 (默认 0，Arena 传 0.3)
    simpleRatio: number;   // 简单新词 (默认 0.2)
    coreRatio: number;     // 核心新词 (默认 0.6)
    hardRatio: number;     // 困难新词 (默认 0.2)
    posFilter?: string[];  // 词性过滤 (可选)
}
```

### 3.3 返回类型

```typescript
interface OMPSCandidate {
    vocabId: number;
    word: string;
    definition_cn: string;
    type: 'REVIEW' | 'NEW';
    source: 'rescue' | 'review' | 'new' | 'hot';  // V3: 来源标记
    priority_level: number;
    frequency_score: number;
    commonExample: string | null;
}
```

### 3.4 辅助入口：`getStratifiedNewWords`

直接获取分层新词（不含 Review/Rescue），适用于 Drive DISCOVERY 模式等纯新词场景：

```typescript
import { getStratifiedNewWords } from '@/lib/services/omps-core';

const newWords = await getStratifiedNewWords(userId, 10, excludeIds);
```

---

## 4. 分层逻辑详解

### 4.0 全局 MASTERED 过滤

`MASTERED` 是用户主动确认的词汇级状态，由 `UserVocabState` 承载。OMPS 不把它解释为某条 FSRS 轨道的成熟状态，也不会为未训练轨道伪造 `UserProgress` 参数。

所有“目标训练词”查询都必须合并 `buildNotMasteredVocabWhere(userId)` 或等价的 `UserVocabState.status != MASTERED` 条件：

- Redis 库存优先路径：命中热库存后仍需校验词汇级状态，已掌握词不能被当作 `NEW` 或 `REVIEW` 返回。
- Rescue / Review：通过 `UserProgress.vocab` 关联排除已掌握词。
- Stratified New：通过 `Vocab.userVocabStates.none` 排除已掌握词。
- Audio、Drive、Weaver、Part6 等非 OMPS 直连选词，也必须复用同一 helper 或保持等价语义。

例外：`anchor-engine` 的支撑词不是目标训练词。已掌握词可以作为语境支撑熟词，但不能作为本轮要训练、评分或进入 FSRS 写入的目标词。

### 4.1 Phase 0.5: Rescue Queue (V3 新增)

当 `rescueRatio > 0` 时激活。查询条件：

```sql
WHERE userId = $1
  AND track = currentTrack
  AND status IN ('LEARNING', 'REVIEW')
  AND dim_v_score < 30          -- PRD 标准
  AND vocabId NOT IN (excludeIds)
ORDER BY frequency_score DESC   -- 高价值优先
LIMIT rescueQuota
```

溢出机制：Rescue 不足时，剩余名额自动转给 Review。

### 4.2 Phase 1: Review (FSRS Due)

```
reviewQuota = remaining × (reviewRatio / (1 - rescueRatio))
```

查询 `next_review_at <= NOW` 且去重 Rescue 已选词。

### 4.3 Phase 2: Stratified New Words

新词按 `abceed_level` 分层，**顺序查库以避免跨桶重复**：

| Bucket | Level 范围 | 配额 | 排除逻辑 |
|:-------|:-----------|:-----|:---------|
| SIMPLE | ≤ 3 | 20% | 使用初始 excludeIds |
| CORE | 4-7 OR `is_toeic_core` | 60% | 排除 SIMPLE 已选词 |
| HARD | ≥ 8 | 20% | 排除 SIMPLE + CORE 已选词 |
| FALLBACK | 无限制 | 0% | 仅在其他桶耗尽时启用 |

> [!IMPORTANT]
> 分桶查询必须**顺序执行**（非 `Promise.all`），因为同一词可能同时满足多个桶的条件（如 `abceed_level=3` 且 `is_toeic_core=true`），并行查询会导致重复。

---

## 5. 已接入场景

| 场景 | 调用方式 | 协议 | 状态 |
|:-----|:---------|:-----|:-----|
| **Session Drill (SYNTAX/PHRASE)** | `fetchOMPSCandidates(userId, 10, {})` | Dojo 70/30 | ✅ |
| **Article Mode** | `fetchOMPSCandidates(userId, 1)` | Dojo （单词） | ✅ |
| **Blitz Session** | `fetchOMPSCandidates(userId, 20, OMPS_ARENA_CONFIG, [], 'BLITZ')` | Arena 30/50/20 | ✅ V3 |
| **fetch-queue (Admin)** | `fetchOMPSCandidates(userId, 20, OMPS_ARENA_CONFIG)` | Arena 30/50/20 | ✅ V3 |
| **Drive DISCOVERY** | `getStratifiedNewWords(userId, limit, excludeIds)` | 纯新词分层 | ✅ V3 |
| **Mixed Mode (L0/L1/L2)** | `fetchOMPSCandidates(userId, 10, {}, [], mode)` | Dojo 70/30 | ✅ |

### 不适用场景

- ❌ **Context Words 选取**: 使用 `ContextSelector` (语义相似性)
- ❌ **Distractor 生成**: 使用 `DistractorSelector` (视觉/语义冲突)

---

## 6. 开发规范

### 6.1 新增场景接入

```typescript
import { fetchOMPSCandidates, OMPS_ARENA_CONFIG } from '@/lib/services/omps-core';

// 1. 选择协议
const candidates = await fetchOMPSCandidates(
    userId, 20, OMPS_ARENA_CONFIG, alreadySeenIds, 'YOUR_MODE'
);

// 2. 利用 source 字段做日志/分析
const rescue = candidates.filter(c => c.source === 'rescue');
const review = candidates.filter(c => c.source === 'review');

// 3. 处理空结果
if (candidates.length === 0) {
    // 提示用户词库已学完，或降级到随机选词
}
```

### 6.2 测试要求

新增调用方必须编写以下测试：

1. **Mock `fetchOMPSCandidates`**：不要测试 OMPS 内部逻辑（已覆盖）
2. **验证调用参数**：确保正确传递协议预设和 mode
3. **验证 source 分组**：如果需要区分 rescue/review/new
4. **验证空结果处理**：边界情况

---

## 7. 测试与仿真

### 7.1 单元测试

```bash
npx vitest run lib/services/__tests__/omps-core.test.ts
```

测试套件覆盖：
- Suite A: Macro Scheduler (4 用例)
- Suite B: Micro Sampler (4 用例)
- Suite C: Edge Cases (5 用例)
- Suite D: Integration (3 用例)
- Suite E: Inventory First Strategy (3 用例)
- Suite F: Rescue Queue (5 用例) — V3 新增
- Suite G: Protocol Presets (3 用例) — V3 新增
- Suite H: Word-Level MASTERED exclusion — V3.1 新增

### 7.2 端到端脚本

```bash
npx tsx scripts/test-engine.ts
```

输出示例：
```
--- Dojo Protocol (70/30) ---
Total: 10 | Review: 7 | New: 3

--- Arena Protocol (30/50/20) ---
Total: 20 | Rescue: 6 | Review: 10 | New: 4
```

---

## 8. 常见问题

### Q1: Rescue 桶永远返回 0 怎么办？

**A**: 正常现象。Rescue 桶仅在 `rescueRatio > 0` (Arena 协议) 且用户有 `dim_v_score < 30` 的词时才会填充。Dojo 协议下 `rescueRatio = 0`，不会触发。

### Q2: 新词出现重复（同一个词被选两次）？

**A**: 已在 V3 修复。原因是 `getStratifiedNewWords` 中 SIMPLE/CORE/HARD 三桶并行查库导致跨桶重叠。现改为顺序查库并逐层累加 `excludeIds`。

### Q3: 如何从 Dojo 切换到 Arena？

**A**: 只需更换配置常量：
```typescript
// Before
await fetchOMPSCandidates(userId, 20);  // 默认 Dojo

// After
await fetchOMPSCandidates(userId, 20, OMPS_ARENA_CONFIG);  // Arena
```

### Q4: `source` 字段有什么用？

**A**: 用于日志审计和前端分析。可以按 `source` 统计每个桶的填充率，辅助调参。

---

## 9. 已废弃模块

以下模块已在 V3 迁移中被 OMPS 取代并删除：

| 模块 | 原用途 | 替代方案 | 删除日期 |
|:-----|:-------|:---------|:---------|
| `lib/engine/hybrid-selector.ts` | Arena 30/50/20 选词 | `fetchOMPSCandidates` + `OMPS_ARENA_CONFIG` | 2026-03-09 |
| `get-blitz-session.ts` 三桶查询 | Blitz 独立选词 | `fetchOMPSCandidates` + `OMPS_ARENA_CONFIG` | 2026-03-09 |
| `drive.ts` raw SQL | Drive 新词获取 | `getStratifiedNewWords` | 2026-03-09 |

---

## 10. 变更日志

| 版本 | 日期 | 变更 |
|:-----|:-----|:-----|
| V1.0 | 2026-01-28 | 初始实现，集成到 `get-next-drill.ts` |
| V1.1 | 2026-01-28 | 抽取为共享模块 `omps-core.ts`，Article Mode 接入 |
| V2.0 | 2026-02-07 | 新增 Phase 0 (Inventory-First)，优先选择有缓存的单词 |
| V3.0 | 2026-03-09 | **统一引擎迁移**: 新增 Rescue Queue (Phase 0.5)、`source` 标记、协议预设 (`OMPS_DOJO_CONFIG` / `OMPS_ARENA_CONFIG`)。Blitz/HybridSelector/Drive 全部迁入 OMPS。修复分桶去重 Bug。净减 ~200 行代码 |
