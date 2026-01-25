# Opus 五维记忆系统架构设计 v3.1

> 供架构师审阅 | 更新时间：2026-01-25

---

## 1. 产品背景

### 1.1 核心理念

Opus 是一款面向程序员的 **口袋职场模拟器**，核心目标是 TOEIC 备考。

**设计哲学**:
- **Survive First, Then Upgrade**: 用户留存优先于学习效率
- **前端哑巴，后端大脑**: 难度控制、内容生成全在服务端
- **Zero-Wait**: 用户永远不等待 LLM 生成

### 1.2 技术栈

| 层 | 技术 |
|----|------|
| Frontend | Next.js 14+ App Router, React, Tailwind, Shadcn UI |
| Backend | Server Actions, BullMQ Workers |
| Database | PostgreSQL (Prisma) + Redis (ioredis) |
| AI | Gemini / OpenAI (Failover) |
| Algorithm | FSRS v5 (间隔重复) |

---

## 2. 五维记忆模型 (TOEIC Adapted)

### 2.1 维度定义

| 维度 | 代码 | 题型 | 生成方式 | 本期状态 |
|------|------|------|----------|----------|
| **境 (Context)** | CTX | `PART5_CLOZE` | LLM 生成挖空句 | ✅ |
| **形 (Visual)** | VIS | `VISUAL_TRAP` | DB confusing_words | ✅ |
| **义 (Meaning)** | MEA | `S_V_O` | DB definition_cn | ✅ |
| **音 (Audio)** | AUD | `AUDIO_RESPONSE` | Python TTS | ⏸️ 遗留 |
| **理 (Logic)** | LOG | `PARAPHRASE_ID` | pgvector 搜索 | ⏸️ 遗留 |

### 2.2 成本分层策略 (Tiered Bundling)

```
┌─────────────────────────────────────────────┐
│  Tier 1 (免费) - 每次必生成                  │
│  ├─ S_V_O: 直接读 DB                        │
│  └─ VISUAL_TRAP: 读 confusing_words 字段    │
├─────────────────────────────────────────────┤
│  Tier 3 (LLM) - 懒加载                      │
│  └─ PART5_CLOZE: 库存=0 且短板维度时才生成   │
├─────────────────────────────────────────────┤
│  Tier 2 (中等) - 遗留                       │
│  ├─ AUDIO_RESPONSE: 需 Python TTS           │
│  └─ PARAPHRASE_ID: 需 pgvector 数据         │
└─────────────────────────────────────────────┘
```

---

## 3. 系统架构

### 3.1 高层架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ DrillStore  │  │ UniversalCard│  │ useSessionFlush        │   │
│  │ (Zustand)   │  │ (通用渲染)   │  │ (beforeunload+路由)    │   │
│  └──────┬──────┘  └─────────────┘  └────────────┬────────────┘   │
└─────────┼───────────────────────────────────────┼────────────────┘
          │                                       │
          ▼                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                      API Layer (Server Actions)                   │
│  ┌─────────────────────┐      ┌─────────────────────────────┐    │
│  │ fetchNextDrill      │      │ submitAnswer                │    │
│  │ ├─ 注入队列 ZPOP    │      │ ├─ 写 Redis 窗口 Hash       │    │
│  │ ├─ FSRS 到期查询    │      │ ├─ 写 StudyLog 流水         │    │
│  │ └─ 库存取题+降级    │      │ ├─ 错题 ZADD 注入队列       │    │
│  └─────────────────────┘      │ └─ 更新 active_sessions     │    │
└──────────────────────────────────────────────────────────────────┘
          │                                       │
          ▼                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Redis (ioredis)                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 库存 (List)                                                  │ │
│  │ inventory:{userId}:vocab:{vocabId}:S_V_O                     │ │
│  │ inventory:{userId}:vocab:{vocabId}:VISUAL_TRAP               │ │
│  │ inventory:{userId}:vocab:{vocabId}:PART5_CLOZE               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 错题注入 (ZSet)                                              │ │
│  │ injection:{userId}  score=注入时间戳+3min                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 活跃窗口 (Hash + ZSet)                                       │ │
│  │ window:{userId}:{vocabId}  { lastGrade, attempts, hasAgain } │ │
│  │ active_sessions  score=lastActiveTime                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
          │                       │
          ▼                       ▼
┌─────────────────────┐  ┌─────────────────────────────────────────┐
│ PostgreSQL (Prisma) │  │ BullMQ Workers                          │
│ ┌─────────────────┐ │  │ ┌─────────────────────────────────────┐ │
│ │ UserProgress    │ │  │ │ drill-processor                     │ │
│ │ ├─ FSRS 字段    │ │  │ │ ├─ 分层生成 T1+T3                   │ │
│ │ └─ 五维分数     │ │  │ │ └─ 双写 Redis + DrillCache          │ │
│ ├─────────────────┤ │  │ ├─────────────────────────────────────┤ │
│ │ StudyLog (流水) │ │  │ │ session-settler (每分钟)            │ │
│ ├─────────────────┤ │  │ │ ├─ ZRANGEBYSCORE 找不活跃用户       │ │
│ │ DrillCache     │ │  │ │ ├─ 聚合窗口 Hash → 计算 FSRS        │ │
│ │ (冷备/审计)    │ │  │ │ └─ 写 Postgres + 清理 Redis         │ │
│ └─────────────────┘ │  │ └─────────────────────────────────────┘ │
└─────────────────────┘  └─────────────────────────────────────────┘
```

---

## 4. 数据流详解

### 4.1 用户答题流程

```
用户点击开始
    │
    ▼
fetchNextDrill()
    │
    ├─► [1] ZPOPMIN injection:{userId} 
    │       (检查 score <= NOW 的错题)
    │       └─► 有 → 返回注入的错题
    │
    ├─► [2] SELECT FROM UserProgress 
    │       WHERE next_review_at <= NOW
    │       └─► 有 → 获取到期词汇
    │
    ├─► [3] 根据五维分数选择最弱维度
    │       LPOP inventory:{userId}:{vocabId}:{drillType}
    │       └─► 有库存 → 返回题目
    │
    └─► [4] 降级: buildDeterministicDrill()
            (用 DB 数据构建最小可用题目)
    
    ▼
用户作答
    │
    ▼
submitAnswer(userId, vocabId, drillType, isPass, timeSpent)
    │
    ├─► [1] 计算隐式评分
    │       if isPass:
    │           < 1.5s → Easy (4)
    │           1.5s~5s → Good (3)
    │           > 5s → Hard (2)
    │       else:
    │           Again (1)
    │
    ├─► [2] 题型权重修正
    │       if drillType == 'S_V_O' && grade == 4:
    │           grade = 3  // 简单题降权
    │
    ├─► [3] 更新 Redis 窗口
    │       HSET window:{userId}:{vocabId} 
    │       ZADD active_sessions NOW {userId}
    │
    ├─► [4] 写 StudyLog 流水
    │       INSERT INTO StudyLog (...)
    │
    └─► [5] 错题注入
            if grade == 1:
                newDrill = 生成换维度题目
                ZADD injection:{userId} (NOW+3min) {newDrill}
```

### 4.2 窗口结算流程 (双保险)

```
触发方式 A: 前端主动 (低延迟)
──────────────────────────────
beforeunload / 路由切换
    │
    ▼
POST /api/session/flush
    │
    ▼
flushUserSession(userId)
    ├─► SCAN window:{userId}:*
    ├─► 聚合计算每个词的最终 FSRS Grade
    ├─► UPDATE UserProgress SET stability, next_review_at
    └─► DEL window:{userId}:* + ZREM active_sessions

触发方式 B: Worker 兜底 (保证不丢)
──────────────────────────────────
每分钟 CRON
    │
    ▼
session-settler Worker
    │
    ▼
ZRANGEBYSCORE active_sessions 0 (NOW - 5min)
    │
    ▼
对每个不活跃用户执行 flushUserSession()
```

---

## 5. FSRS 算法适配

### 5.1 单词级 FSRS (一词一策)

```
UserProgress
├─ vocabId: 123
├─ stability: 2.5      ← FSRS 核心 (单词整体)
├─ difficulty: 0.3
├─ next_review_at: ...
│
├─ dim_ctx_score: 80   ← 仅用于选题 (不影响调度)
├─ dim_vis_score: 40
└─ dim_mea_score: 90
```

### 5.2 题型权重修正

| 题型 | 认知难度 | 权重规则 |
|------|----------|----------|
| S_V_O | 低 | Easy(4) → Good(3) |
| VISUAL_TRAP | 中 | 标准 |
| PART5_CLOZE | 高 | Good(3) → +Bonus |

### 5.3 窗口内聚合规则

```
同一词在 5 分钟内的多次操作:
  - 有任意一次 Again → 最终 = Again
  - 全部 Pass → 最终 = 最后一次的 Grade
```

---

## 6. 数据库 Schema

### 6.1 UserProgress (修改)

```prisma
model UserProgress {
  id        String   @id @default(cuid())
  userId    String
  vocabId   Int
  
  // FSRS 核心字段
  stability      Float    @default(0)
  difficulty     Float    @default(0)
  reps           Int      @default(0)
  lapses         Int      @default(0)
  state          Int      @default(0)
  next_review_at DateTime?
  
  // 五维雷达分 (TOEIC Adapted)
  dim_ctx_score  Int @default(0)  // 境
  dim_vis_score  Int @default(0)  // 形
  dim_mea_score  Int @default(0)  // 义
  dim_aud_score  Int @default(0)  // 音 [遗留]
  dim_log_score  Int @default(0)  // 理 [遗留]
  
  // 维度互斥
  last_dim_tested String?
  
  @@unique([userId, vocabId])
  @@index([userId, next_review_at])
}
```

### 6.2 StudyLog (新增)

```prisma
model StudyLog {
  id        String   @id @default(cuid())
  userId    String
  vocabId   Int
  drillType String   // S_V_O | VISUAL_TRAP | PART5_CLOZE
  result    String   // PASS | FAIL
  timeSpent Int      // 毫秒
  grade     Int      // FSRS Grade (1-4)
  createdAt DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([vocabId])
}
```

### 6.3 DrillCache (保留)

- 角色: 冷备 / 审计
- LLM 生成后双写: Redis + Postgres

---

## 7. Redis Key Schema

```
# 库存 (List, FIFO)
inventory:{userId}:vocab:{vocabId}:{drillType}
  └─ LPOP 消费, RPUSH 生产

# 错题注入 (ZSet)
injection:{userId}
  └─ score = 注入时间戳 + 3分钟
  └─ value = Drill JSON

# 活跃窗口缓冲 (Hash, TTL 1小时防误删)
window:{userId}:{vocabId}
  └─ { lastGrade, attempts, hasAgain, updatedAt }

# 活跃用户追踪 (ZSet, Worker扫表用)
active_sessions
  └─ score = 最后活跃时间戳
  └─ value = userId
```

---

## 8. 关键决策记录

### 8.1 为什么不用 Redis TTL 过期触发结算？

**问题**: Redis Key 过期后直接删除，不会触发回调函数。
**风险**: 数据蒸发 = 用户白学。
**方案**: ZSet 记录活跃时间 + Worker 每分钟扫表主动结算。

### 8.2 为什么 DrillCache 保留？

**原因**:
1. 冷备: Redis 故障时可恢复
2. 审计: 查看历史生成质量
3. 分析: 统计 LLM 生成效果

### 8.3 为什么窗口是 5 分钟？

**场景**: 地铁碎片化学习，用户可能只刷 5 分钟就离开。
**方案**: 动态窗口 = 最后活跃 + 5分钟无操作触发结算。

### 8.4 为什么形似词不用 Python Levenshtein？

**发现**: `confusing_words` 字段覆盖率 97.3%。
**方案**: 直接使用 DB 字段，无需动态计算。剩余 151 个词后续数据补丁填充。

---

## 9. 实施计划

| Day | 任务 | 核心文件 |
|-----|------|----------|
| D1 | Schema迁移 + Redis Key 重构 | `schema.prisma`, `lib/inventory.ts` |
| D2 | API 混合器 + 原子提交 | `actions/get-next-drill.ts`, `actions/submit-answer.ts` |
| D3 | 前端滑窗 + useSessionFlush | `components/session/`, `hooks/` |
| D4 | Worker联调 + session-settler | `workers/` |

---

## 10. 遗留项

| 项目 | 依赖 | 优先级 |
|------|------|--------|
| 音 (AUDIO_RESPONSE) | Python TTS 服务 | P2 |
| 理 (PARAPHRASE_ID) | pgvector 向量数据 | P2 |
| 短板效应 D值同步 | 观察实际效果后决定 | P3 |
| TTS 结果缓存 | 音题实现后 | P3 |

---

## 11. 测试策略

### 11.1 测试原则

- 每个 Phase 完成后必须有对应测试用例通过
- Mock 外部依赖 (LLM, Redis)
- 关键路径 100% 覆盖

### 11.2 Phase 测试矩阵

| Phase | 模块 | 测试文件 | 核心用例 |
|-------|------|----------|----------|
| D1 | Schema | `prisma/__tests__/schema.test.ts` | 五维字段存在性 |
| D1 | Redis Key | `lib/__tests__/inventory.test.ts` | 分频道 LPUSH/LPOP |
| D2 | 混合器 | `actions/__tests__/get-next-drill.test.ts` | 优先级顺序 |
| D2 | 原子提交 | `actions/__tests__/submit-answer.test.ts` | 窗口写入+错题注入 |
| D3 | 前端Flush | `hooks/__tests__/useSessionFlush.test.ts` | 路由切换触发 |
| D4 | Worker | `workers/__tests__/session-settler.test.ts` | 扫表结算 |

### 11.3 D1 测试用例

```typescript
// lib/__tests__/inventory.test.ts
describe('Inventory V2 (分频道)', () => {
  it('应按题型分开存储', async () => {
    await inventory.pushDrill(userId, vocabId, 'S_V_O', drill1);
    await inventory.pushDrill(userId, vocabId, 'VISUAL_TRAP', drill2);
    
    const svo = await inventory.popDrill(userId, vocabId, 'S_V_O');
    const visual = await inventory.popDrill(userId, vocabId, 'VISUAL_TRAP');
    
    expect(svo.meta.drillType).toBe('S_V_O');
    expect(visual.meta.drillType).toBe('VISUAL_TRAP');
  });
  
  it('不同题型库存独立计数', async () => {
    await inventory.pushDrill(userId, vocabId, 'S_V_O', drill);
    
    const counts = await inventory.getInventoryCounts(userId, vocabId);
    expect(counts.S_V_O).toBe(1);
    expect(counts.VISUAL_TRAP).toBe(0);
  });
});
```

### 11.4 D2 测试用例

```typescript
// actions/__tests__/get-next-drill.test.ts
describe('fetchNextDrill (混合器)', () => {
  it('优先返回注入队列的错题', async () => {
    // 准备: 注入一个到期错题
    await redis.zadd('injection:user1', Date.now() - 1000, injectedDrill);
    
    const result = await fetchNextDrill('user1');
    expect(result.source).toBe('injection');
  });
  
  it('无注入时返回 FSRS 到期词', async () => {
    // 准备: 设置一个到期词
    await db.userProgress.create({
      data: { userId: 'user1', vocabId: 1, next_review_at: new Date(0) }
    });
    
    const result = await fetchNextDrill('user1');
    expect(result.vocabId).toBe(1);
  });
  
  it('根据最弱维度选择题型', async () => {
    await db.userProgress.create({
      data: { 
        userId: 'user1', vocabId: 1,
        dim_ctx_score: 80, dim_vis_score: 20, dim_mea_score: 60
      }
    });
    
    const result = await fetchNextDrill('user1');
    expect(result.meta.drillType).toBe('VISUAL_TRAP'); // 最弱维度
  });
});

// actions/__tests__/submit-answer.test.ts
describe('submitAnswer (原子提交)', () => {
  it('更新 Redis 窗口缓冲', async () => {
    await submitAnswer('user1', 1, 'S_V_O', true, 2000);
    
    const window = await redis.hgetall('window:user1:1');
    expect(window.lastGrade).toBe('3'); // Good
  });
  
  it('错题写入注入队列', async () => {
    await submitAnswer('user1', 1, 'S_V_O', false, 1000);
    
    const injected = await redis.zrange('injection:user1', 0, -1);
    expect(injected.length).toBe(1);
  });
  
  it('题型权重修正: S_V_O Easy降为Good', async () => {
    await submitAnswer('user1', 1, 'S_V_O', true, 500); // < 1.5s = Easy
    
    const window = await redis.hgetall('window:user1:1');
    expect(window.lastGrade).toBe('3'); // 降为 Good
  });
});
```

### 11.5 D4 测试用例

```typescript
// workers/__tests__/session-settler.test.ts
describe('session-settler Worker', () => {
  it('扫描不活跃用户', async () => {
    // 准备: 5分钟前活跃过
    await redis.zadd('active_sessions', Date.now() - 6 * 60 * 1000, 'user1');
    
    const stale = await getInactiveSessions(5);
    expect(stale).toContain('user1');
  });
  
  it('聚合窗口计算最终 Grade', async () => {
    // 准备: 用户做了 3 次 (错-错-对)
    await redis.hset('window:user1:1', { attempts: 3, hasAgain: 'true', lastGrade: '3' });
    
    const finalGrade = aggregateWindowGrade('window:user1:1');
    expect(finalGrade).toBe(1); // 有 Again = 最终 Again
  });
  
  it('结算后清理 Redis', async () => {
    await settleUserSession('user1');
    
    const keys = await redis.keys('window:user1:*');
    expect(keys.length).toBe(0);
    
    const score = await redis.zscore('active_sessions', 'user1');
    expect(score).toBeNull();
  });
});
```

### 11.6 集成测试

```typescript
// __tests__/integration/full-flow.test.ts
describe('完整答题流程', () => {
  it('用户完成一次答题', async () => {
    // 1. 获取题目
    const drill = await fetchNextDrill('user1');
    expect(drill).toBeDefined();
    
    // 2. 提交答案
    await submitAnswer('user1', drill.meta.vocabId, drill.meta.drillType, true, 2000);
    
    // 3. 验证窗口写入
    const window = await redis.hgetall(`window:user1:${drill.meta.vocabId}`);
    expect(window.lastGrade).toBeDefined();
    
    // 4. 验证流水记录
    const log = await db.studyLog.findFirst({ where: { userId: 'user1' } });
    expect(log).toBeDefined();
  });
});
```

### 11.7 运行命令

```bash
# 单元测试
npm run test

# 覆盖率
npm run test:coverage

# Watch 模式
npm run test:watch
```
