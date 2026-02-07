# Redis Inventory Schema & Design

> **[UPDATE] V2.0 (Schedule-Driven)**  
> 更新日期: 2026-02-07

## 1. Key Structure Overview

### 1.1 Drill Inventory (三维粒度)

Stores pre-generated drills for a specific **User + Mode + Vocabulary** combination.

- **Key Pattern**: `user:{userId}:mode:{mode}:vocab:{vocabId}:drills`
- **Type**: `List` (RPUSH / LPOP)
- **TTL**: None (由 Mode 容量上限控制)
- **Value**: JSON String (`BriefingPayload`)
- **Operations**:
  - `LPOP`: Consumer fetches one drill
  - `RPUSH`: Producer (Worker) adds new drills
  - `LLEN`: Check inventory level

> **为什么是三维粒度？**  
> 不同 Mode (SYNTAX/PHRASE/AUDIO 等) 生成的内容结构不同，不能跨 Mode 共用。

### 1.2 Inventory Stats (聚合统计)
- **Key Pattern**: `user:{userId}:inventory:stats`
- **Type**: `Hash`
- **Fields**: `{ SYNTAX: 15, PHRASE: 10, AUDIO: 5, ... }`

### 1.3 Replenish Buffer (缓冲区)
- **Key**: `buffer:replenish_drills`
- **Type**: `Set`
- **Purpose**: 聚合多个低库存请求，批量发送 Job

### 1.4 Job Queue (BullMQ)

- **Queue Name**: `opus:inventory-queue`
- **Job Types**:
  - `replenish_one`: 单词急救 (Plan B)
  - `replenish_batch`: 批量补货 (Plan C)
  - `generate-{mode}`: 定时生成
- **Priority**:
  - `1` (High): 紧急补货
  - `5` (Medium): 批量补货

---

## 2. Data Payload Structure

The JSON object stored in the Redis List.

```typescript
type DrillType = 
  | 'PART5_CLOZE'     // Context
  | 'AUDIO_RESPONSE'  // Audio
  | 'VISUAL_TRAP'     // Visual
  | 'S_V_O'           // Meaning
  | 'PARAPHRASE_ID';  // Logic

interface InventoryItem {
  id: string;              // UUID
  vocabId: number;
  type: DrillType;
  
  // The actual content to render
  payload: {
    stimulus: {
      text?: string;       // For Cloze/Reading
      audioUrl?: string;   // For Audio
      imageUrl?: string;   // For Visual
    };
    interaction: {
      options: string[];   // [Option A, Option B, Option C, Option D]
      answerIndex: number; // 0-3
      correctValue: string;
    };
    feedback: {
      explanation: string; // Markdown
      translation?: string;
    };
  };

  // Metadata
  generatedAt: string;     // ISO Date
  engineVersion: string;   // e.g. "v1.8"
  dimension: 'V' | 'A' | 'M' | 'C' | 'X';
}
```

---

## 3. Inventory Logic

> 实际实现: `lib/core/inventory.ts`

### 3.1 Consumption (Next.js Action)
```typescript
// 参考: actions/get-next-drill.ts
import { inventory } from '@/lib/core/inventory';

async function fetchDrill(userId: string, mode: string, vocabId: number) {
  // 1. 尝试从 Redis 弹出
  const drill = await inventory.popDrill(userId, mode, vocabId);
  
  if (drill) {
    // popDrill 内部自动触发 checkAndTriggerReplenish
    return drill;
  }
  
  // 2. Cache Miss -> 确定性兜底
  const fallback = buildSimpleDrill(vocab, mode);
  
  // 3. 触发后台补货
  inventory.triggerBatchEmergency(userId, mode, [vocabId]);
  
  return fallback;
}
```

### 3.2 Production (Worker)
```typescript
// 参考: workers/drill-processor.ts
async function processDrillJob(job) {
  const { userId, mode, vocabIds } = job.data;
  
  // 1. 前置检查: 库存已满则跳过
  if (await inventory.isFull(userId, mode)) {
    return { success: true, reason: 'inventory_full' };
  }
  
  // 2. 生成内容 (LLM)
  const drills = await generateDrills(vocabIds, mode);
  
  // 3. 推入 Redis (带容量保护)
  for (const drill of drills) {
    await inventory.pushDrill(userId, mode, drill.vocabId, drill);
  }
}
```

### 3.3 Capacity Control
```typescript
// lib/core/inventory.ts
async function isFull(userId: string, mode: string): Promise<boolean> {
  const stats = await getInventoryStats(userId);
  const capacity = await getCapacity(mode);  // CACHE_LIMIT_MAP * DRILLS_PER_BATCH
  return stats[mode] >= capacity;
}
```

