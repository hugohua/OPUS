# Opus Drill 缓存与选词系统架构

**最后更新**: 2026-01-28  
**目的**: 说明 Drill 缓存机制、选词逻辑、生产端与消费端的协作流程

---

## 系统概览

Opus 使用 **生产-消费分离** 的架构来实现零等待的 Drill 生成：

- **生产端**（Worker）：后台预生成 Drill，存入 Redis
- **消费端**（API）：从 Redis 取 Drill，缓存未命中时使用兜底数据
- **调度核心**（OMPS）：统一的选词引擎，确保生产和消费逻辑一致

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   用户请求   │─────▶│ 消费端 API  │◀────▶│   Redis     │
│ (Session)   │      │ (get-next)  │      │  Inventory  │
└─────────────┘      └──────────────┘      └──────┬──────┘
                             ▲                     │
                             │                     │
                             │              ┌──────▼──────┐
                      ┌──────┴──────┐       │  生产端      │
                      │    OMPS     │◀──────│  (Worker)   │
                      │  选词引擎    │       │             │
                      └─────────────┘       └──────┬──────┘
                             │                     │
                             │                     │
                      ┌──────▼──────┐       ┌──────▼──────┐
                      │  PostgreSQL │       │  LLM API    │
                      │  (FSRS 状态) │       │ (Aliyun)    │
                      └─────────────┘       └─────────────┘
```

---

## 核心组件

### 1. OMPS 选词引擎

**位置**: `lib/services/omps-core.ts`

**职责**: 提供统一的选词逻辑，供生产端和消费端共用

#### 选词策略（三阶段）

```typescript
Phase 0: 🔥 库存优先（Inventory-First）- 仅消费端
├─ 扫描 Redis: user:{userId}:mode:{mode}:vocab:*:drills
├─ 提取有库存的 vocabId
├─ 从数据库获取完整信息（含 FSRS 状态）
├─ **过滤未到期**: 排除状态为 REVIEW 且 next_review_at > NOW 的单词（避免重复）
├─ 优先级排序: 复习词 > 新词
└─ 如果库存 >= limit → 直接返回（100% 命中）

Phase 1: 🌡️ 宏观调度（70/30 策略）
├─ 70% 复习词: next_review_at <= NOW (FSRS 调度)
└─ 30% 新词: 进入分层采样

Phase 2: ❄️ 微观采样（分层新词）
├─ Simple (20%): abceed_level <= 3
├─ Core (60%): is_toeic_core OR abceed_level 4-7
└─ Hard (20%): abceed_level >= 8

排序规则:
  - is_toeic_core DESC
  - frequency_score DESC
```

#### 关键函数

```typescript
fetchOMPSCandidates(
  userId: string,
  limit: number,
  config?: {
    posFilter?: string[],  // 词性过滤（如 SYNTAX 模式只要动词/名词）
    reviewRatio?: number,  // 复习词比例（默认 0.7）
  },
  excludeIds?: number[],   // 排除的词汇 ID
  mode?: string            // 启用库存优先（Phase 0）
): Promise<OMPSCandidate[]>
```

#### 库存优先函数

```typescript
getInventoryBackedWords(
  userId: string,
  mode: string,
  limit: number,
  excludeIds: number[]
): Promise<OMPSCandidate[]>
```

**逻辑**:
1. 批量扫描 Redis 键: `user:*:mode:*:vocab:*:drills`
2. 提取 vocabId 并过滤 excludeIds
3. 批量检查库存数量（pipeline LLEN）
4. 从数据库获取单词详情 + FSRS 进度
5. 分类并排序: 复习词优先，按 `next_review_at` 排序

---

### 2. 消费端（API）

**位置**: `actions/get-next-drill.ts`

**职责**: 响应用户请求，返回 10 道 Drill

#### 流程

```typescript
1. 调用 OMPS 选词引擎
   fetchOMPSCandidates(userId, limit, { posFilter }, excludeIds, mode)
   
2. 转换为 Drill（按优先级）
   ├─ PHRASE 模式: buildPhraseDrill (fast_path_db)
   ├─ 其他模式: inventory.popDrill (cache_v2)
   └─ 缓存未命中: buildSimpleDrill (deterministic_fallback)

3. 统计命中率
   cacheHit / total * 100

4. 触发急救补货
   if (missedVocabIds.length > 0) {
     inventory.triggerBatchEmergency(userId, mode, missedVocabIds)
   }
```

#### 关键日志

```json
{
  "userId": "xxx",
  "mode": "SYNTAX",
  "total": 10,
  "cacheHit": 9,
  "fastPath": 0,
  "fallback": 1,
  "hitRate": "90.0%"
}
```

---

### 3. 生产端（Worker）

**位置**: `workers/drill-processor.ts` + `workers/index.ts`

**职责**: 后台预生成 Drill，推送到 Redis

#### Worker 配置

```typescript
// workers/index.ts
concurrency: 3,          // 并发度
limiter: {
  max: 10,               // 每分钟最多 10 个任务
  duration: 60000
}
```

#### 生成流程

```typescript
1. 获取任务（BullMQ）
   ├─ generate-{mode}: 通用批量生成（OMPS 选词）
   ├─ replenish_batch: 批量补货（指定 vocabIds）
   └─ replenish_one: 单词急救（指定 vocabId）

2. 选择要生成的单词
   fetchDueCandidates(userId, mode, limit)
   └─ 调用 OMPS: fetchOMPSCandidates(userId, bufferLimit, { posFilter })
   └─ 过滤已有库存: inventoryCounts[vocabId] >= 2 → 跳过

3. 准备 Prompt 输入
   ├─ targetWord, meaning, wordFamily
   └─ contextWords (通过 ContextSelector 获取)

4. 调用 LLM（Aliyun Failover）
   generateWithFailover(system, user)
   返回: { drills: [...] }

5. 解析并推送 Redis
   for each drill:
     inventory.pushDrill(userId, mode, vocabId, payload)
```

#### 防重复机制

```typescript
// Step 2: 过滤已有库存
const inventoryCounts = await inventory.getInventoryCounts(userId, mode, vocabIds);
const needsGeneration = candidates.filter(c => {
  const count = inventoryCounts[c.vocabId] || 0;
  return count < 2; // 库存 < 2 才生成
});
```

**效果**: 多个并发 Worker 不会重复生成同一单词的 Drill

---

### 4. Redis 库存管理

**位置**: `lib/inventory.ts`

**数据结构**:
```
Key: user:{userId}:mode:{mode}:vocab:{vocabId}:drills
Type: List
Value: JSON.stringify(BriefingPayload)
```

#### 核心操作

```typescript
// 推送 Drill（生产端）
pushDrill(userId, mode, vocabId, drill)
  ├─ RPUSH drills
  └─ HINCRBY stats +1

// 消费 Drill（消费端）
popDrill(userId, mode, vocabId): BriefingPayload | null
  ├─ LPOP drills
  ├─ HINCRBY stats -1
  └─ 触发补货检查（异步）

// 批量检查库存
getInventoryCounts(userId, mode, vocabIds[]): Record<vocabId, count>
  └─ Pipeline LLEN
```

#### 自动补货机制

```typescript
// 消费后检查
popDrill() 后调用:
  checkAndTriggerReplenish()
    if (len < 2) {
      addToBuffer(userId, mode, vocabId)
      checkBufferAndFlush()  // 缓冲区 >= 5 时 Flush
    }

// 批量 Flush
flushBuffer()
  ├─ 从缓冲区取 10 个缺货 ID
  ├─ 按 User+Mode 分组
  └─ 入队: inventoryQueue.add('replenish_batch', { vocabIds })
```

---

## 数据流程

### 场景 1: 库存充足（理想情况）

```
用户请求 10 道题
  ↓
OMPS Phase 0: getInventoryBackedWords()
  ↓
从 Redis 找到 10 个有库存的单词
  ↓
返回（100% cache_v2）
  ↓
hitRate: 100%
```

### 场景 2: 库存不足（冷启动）

```
用户请求 10 道题
  ↓
OMPS Phase 0: 只找到 3 个库存
  ↓
OMPS Phase 1: 查询 FSRS，找到 5 个复习词
  ↓
OMPS Phase 2: 查询新词，找到 2 个
  ↓
转换 Drill:
  - 3 个 cache_v2
  - 7 个 deterministic_fallback
  ↓
触发急救: triggerBatchEmergency(7 个 vocabIds)
  ↓
Worker 异步生成 7 个 Drill → 推送 Redis
  ↓
下次请求: hitRate 提升
```

### 场景 3: Worker 预热

```
Cron Job / 用户登录
  ↓
调用: enqueueDrillGeneration(userId, mode, 'cron')
  ↓
入队 2 个任务（SYNTAX 模式: 20/10 = 2 batches）
  ↓
Worker 处理任务:
  fetchDueCandidates(userId, 'SYNTAX', 10)
    ↓
  调用 OMPS 选择 20 个最可能的单词
    ↓
  过滤已有库存: 只保留 < 2 的
    ↓
  调用 LLM 生成 10 个 Drills
    ↓
  推送 Redis: 10 个单词 × 1 drill/单词
  ↓
库存水位上升
  ↓
用户下次请求: hitRate 提升
```

---

## 关键配置

### Mode 目标数量

```typescript
// lib/queue/inventory-queue.ts
const MODE_TARGET_COUNT = {
  SYNTAX: 20,     // 2 batches
  CHUNKING: 30,   // 3 batches
  NUANCE: 50,     // 5 batches
  BLITZ: 10,      // 1 batch
};
```

### 三重库存控制体系 (Capacity Management)

为了系统高效运作并防止边界灾难，Opus 的选词引擎设置了**三重水位控制**，它们的生效阶段和防线作用各不相同：

#### 1. LOW_WATERMARK（低水位预警线 / 定向救急）
- **作用对象**: 单个单词（`vocabId`）。
- **触发规则**: 在用户消费（`popDrill`）后原子性检查，当某单词剩余库存 `< 3` 时触发。
- **行为**: 向 BullMQ 发起该特定缺货单词的紧急补充请求（`checkAndTriggerReplenish`）。
- **目的**: 确保用户的高频易错词或被选中的特定词**永远不会 Cache Miss**。

#### 2. Soft Cap（全局软上限 / 常规容量预警）
- **作用对象**: 全局特定应用模式（如 `SYNTAX`、`ARENA_PART5`），配置在 `lib/drill-cache.ts` 的 `CACHE_LIMIT_MAP` 中。
- **触发规则**: 在“泛滥式自动预热”（如 Cron Job, 初始批量拉取）时生效。
- **行为**: 如果当前模式总存量 `>= Soft Cap`（例如 50 取 25），系统将**不再下发新的自动大批量预先生成任务**。
- **核心哲学（溢出容忍）**: 软上限可以被 LOW_WATERMARK 的“定向救急”所突破。这保证了哪怕总体库满满当当，只要有个别词缺货依然能插队补进来，并在入库时打印 `Overflow accepted`。

#### 3. Hard Cap（全局硬上限 / 极端饱和熔断）
- **作用对象**: 全局特定应用模式。代码计算为 `Soft Cap * 1.5` 倍。
- **触发规则**: 在向队列发起新的 LOW_WATERMARK 救急请求之前（`isSaturated`）生效。
- **行为**: 一旦总库存达到或超过硬上限（`>= HardCap`），说明系统处于**极度拥堵饱和状态**。此时无论哪个缺货单词申请补货，都会在发入 BullMQ 之前进行**源头熔断**（返回并警告 `System saturated`）。
- **目的**: 彻底防止过去曾经出现过的“任务进入死循环，消费 Token 生成后被后端入库丢弃”的性能灾难，同时保证 Redis 不无限膨胀。

```typescript
// lib/inventory.ts
if (isSaturated) {
  // 熔断请求
  return;
}

if (len < 3) {
  // 发起紧急补货
  addToBuffer(userId, mode, vocabId)
}
```

### OMPS 默认配置

```typescript
// lib/services/omps-core.ts
const DEFAULT_CONFIG = {
  reviewRatio: 0.7,   // 70% 复习词
  simpleRatio: 0.2,   // 20% 简单新词
  coreRatio: 0.6,     // 60% 核心新词
  hardRatio: 0.2,     // 20% 困难新词
};
```

---

## 性能指标

### 目标

- **缓存命中率**: ≥ 90%
- **Worker 任务积压**: ≤ 5
- **Redis 库存水位**: 每个 mode 至少 30-50 个单词

### 监控日志

| 日志 | 含义 | 位置 |
|------|------|------|
| `✅ 全部从库存获取` | 100% 命中 | `omps-core.ts` |
| `📊 Drill batch stats` | 命中率统计 | `get-next-drill.ts` |
| `✅ 跳过已有库存的单词` | 防重复生成 | `drill-processor.ts` |
| `Drill V2 入库完成` | Worker 完成 | `drill-processor.ts` |

---

## 一致性保证

### 关键原则

**生产端和消费端必须使用相同的选词逻辑**

#### 实现方式

1. **统一引擎**: 
   - 消费端: `get-next-drill.ts` → `fetchOMPSCandidates()`
   - 生产端: `drill-processor.ts` → `fetchOMPSCandidates()`

2. **词性过滤同步**:
   ```typescript
   // 两端完全一致
   if (mode === 'SYNTAX') {
     posFilter = ['v', 'n', 'v.', 'n.', 'vi', 'vt', ...];
   }
   ```

3. **排序规则统一**:
   - 复习词: `next_review_at ASC`
   - 新词: `is_toeic_core DESC, frequency_score DESC`

---

## 扩展性

### 添加新 Mode

1. 在 `MODE_TARGET_COUNT` 添加配置
2. 如需特殊词性过滤，在两端同步添加 `posFilter` 逻辑
3. 无需修改核心 OMPS 逻辑

### 调整缓存策略

- **提高水位**: 修改 `if (len < 2)` → `if (len < 5)`
- **预热数量**: 修改 `MODE_TARGET_COUNT`
- **并发度**: 修改 `workers/index.ts` 中的 `concurrency`

---

## 故障降级

### 缓存未命中

使用 `deterministic_fallback`:
```typescript
buildSimpleDrill(vocab, mode)
  - 使用数据库中的 commonExample
  - 生成最简单的选择题
  - 零延迟返回
```

### LLM 失败

Failover 机制（`workers/llm-failover.ts`）:
```
Aliyun (Primary) → OpenRouter (Fallback) → 任务重试
```

### Redis 故障

- 消费端: 100% 使用 `deterministic_fallback`
- 生产端: 任务积压，等待 Redis 恢复

---

## 故障排查指南

### 问题 1: 全量兜底数据 (100% Fallback)

**现象**: 
- 用户访问 `/dashboard/session/SYNTAX` 等页面时，所有卡片都是 `deterministic_fallback` 来源
- 缓存命中率 `hitRate: 0%`
- 审计报告显示大量 `SYNTAX:FALLBACK` 记录

**诊断流程**:

```bash
# 1. 检查 Worker 是否运行
ps aux | grep "workers/index.ts"
# 预期: 应该有进程运行

# 2. 检查队列状态
npx tsx scripts/inspect-queue-v2.ts
# 预期输出:
# - waiting: 0-5 (正常)
# - failed: 0 (正常)
# - completed: 增长中

# 3. 检查 Redis 库存
redis-cli
KEYS user:*:mode:SYNTAX:vocab:*:drills
LLEN user:{userId}:mode:SYNTAX:vocab:{vocabId}:drills
```

**常见原因**:

| 原因 | 症状 | 解决方案 |
|------|------|----------|
| Worker 未启动 | `ps` 无进程 | `npm run dev:worker` 或 `npm run dev:all` |
| Worker 进程卡住 | 队列 `waiting` 持续积压 | 重启 Worker: `pkill -f "workers/index.ts" && npm run dev:worker` |
| 队列损坏 | `failed` 大量任务 | 清空队列: `npx tsx scripts/clear-queue.ts` |
| Redis 连接失败 | Worker 日志报错 | 检查 `.env` 中 `REDIS_URL` 配置 |

**快速修复脚本**:

```bash
#!/bin/bash
# scripts/fix-worker-queue.sh

echo "🔍 诊断 Worker 队列状态..."

# 1. 停止旧 Worker
pkill -f "tsx.*workers/index.ts"

# 2. 清空队列
npx tsx scripts/clear-queue.ts

# 3. 重启 Worker
npm run dev:worker > worker.log 2>&1 &

echo "✅ Worker 已重启。请等待 10 秒后访问应用。"
sleep 10

# 4. 触发一次生成任务验证
npx tsx -e "
import { enqueueDrillGeneration } from '@/lib/queue/inventory-queue';
enqueueDrillGeneration('test-user', 'SYNTAX', 'realtime').then(() => {
  console.log('✅ 测试任务已入队');
  process.exit(0);
});
"
```

**预防措施**:

1. 在 `package.json` 中确保 `dev:all` 正确配置:
   ```json
   {
     "dev:all": "concurrently \"npm run dev:web\" \"npm run dev:worker\""
   }
   ```

2. 添加 Worker 健康检查（可选）:
   ```typescript
   // workers/index.ts
   setInterval(async () => {
     const counts = await inventoryQueue.getJobCounts();
     if (counts.waiting > 50) {
       log.warn({ counts }, '⚠️ 队列积压过多');
     }
   }, 60000); // 每分钟检查一次
   ```

3. 使用 PM2 管理 Worker（生产环境）:
   ```bash
   pm2 start "npx tsx workers/index.ts" --name opus-worker
   pm2 logs opus-worker
   ```

---

## 总结

Opus Drill 系统通过以下机制实现高命中率和零等待体验：

1. **统一选词逻辑**（OMPS）确保生产和消费一致
2. **库存优先策略**（Phase 0）优先消费已缓存的单词
3. **并发生产**（3x Worker）快速补充库存
4. **自动补货**（触发式）在消费后异步补充
5. **防重复机制**（库存检查）避免资源浪费
6. **故障降级**（兜底数据）保证系统可用性

**核心设计哲学**: 
- 生产侧：智能预测，按需生成
- 消费侧：库存优先，零等待体验
- 调度核心：统一逻辑，一致性保证
