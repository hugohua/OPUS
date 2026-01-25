# Redis Inventory Schema & Design

## 1. Key Structure Overview

All keys are namespaced under `opus:v1:`.

### 1.1 Drill Inventory (Ammo Depot)
Stores pre-generated drills for a specific user and vocabulary.

- **Key Pattern**: `opus:v1:user:{userId}:inventory:{vocabId}`
- **Type**: `List` (LPUSH / RPOP)
- **TTL**: 7 Days (Refresh on access)
- **Value**: JSON String (Compressed)
- **Operations**:
  - `LPOP`: Consumer fetches one drill.
  - `RPUSH`: Producer (Worker) adds new drills.
  - `LLEN`: Check inventory level.

### 1.2 Global Generators Queue (Job Queue)
Managed by BullMQ.

- **Queue Name**: `opus:drill-generation`
- **Job ID**: `gen:{userId}:{vocabId}:{timestamp}`
- **Priority**:
  - `1` (High): Real-time fallback triggers.
  - `5` (Medium): Low inventory warnings.
  - `10` (Low): Cron background refill.

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

### 3.1 Consumption (Next.js)
```typescript
// Pseudocode
async function fetchDrill(userId: string, vocabId: number, preferredDim: Dimension) {
  const key = `opus:v1:user:${userId}:inventory:${vocabId}`;
  
  // 1. Try to pop from Redis
  const drill = await redis.lpop(key);
  
  if (drill) {
    // Async check inventory level
    const remaining = await redis.llen(key);
    if (remaining < 3) {
      // Trigger refill job (Fire & Forget)
      queue.add('refill', { userId, vocabId }, { priority: 5 });
    }
    return JSON.parse(drill);
  }
  
  // 2. Cache Miss -> Fallback
  return generateDeterministicFallback(vocabId);
}
```

### 3.2 Production (Worker)
```typescript
// Pseudocode worker
worker.process('opus:drill-generation', async (job) => {
  const { userId, vocabId } = job.data;
  
  // 1. Check user weakness (Postgres)
  const stats = await prisma.userProgress.findUnique({ ... });
  const weakDim = getWeakestDimension(stats);
  
  // 2. Generate content (LLM or Python)
  const drills = await generateDrills(vocabId, weakDim, count=5);
  
  // 3. Push to Redis
  const key = `opus:v1:user:${userId}:inventory:${vocabId}`;
  const pipeline = redis.pipeline();
  drills.forEach(d => pipeline.rpush(key, JSON.stringify(d)));
  await pipeline.exec();
});
```
