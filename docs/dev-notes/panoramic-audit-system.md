# Panoramic Audit System (V6.0 - Phase 2 Complete)

> 全景审计系统 - 追踪核心价值链的每个决策

## 概述

全景审计系统记录 Opus 三大核心链路的关键决策：
1. **选词逻辑 (OMPS)** - 系统如何选择要学习的单词
2. **记忆调度 (FSRS)** - 系统如何决定复习间隔
3. **内容生成 (LLM)** - AI 如何生成训练内容
4. **会话兜底 (Fallback)** - 系统由于库存不足触发的降级服务

## 架构

```
┌────────────────────────────────────────────────────────────────────────┐
│                          audit-service.ts                              │
│  ┌────────────────────┬─────────────────────┬────────────────────┐     │
│  │ auditOMPSSelection │ auditFSRSTransition │ auditLLMGeneration │ ... │
│  └────────────────────┴─────────────────────┴────────────────────┘     │
│                                   │                                    │
│                             recordAudit()                              │
│                                   │                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ AUDIT_ENABLED=true  │  AUDIT_SAMPLE_RATE=100                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │ DrillAudit  │
                             │   (DB)      │
                             └─────────────┘
                                    │
                  ┌─────────────────┴───────────────────┐
                  ▼                                     ▼
        ┌───────────────────┐                 ┌────────────────────┐
        │ scripts/audit-rpt │                 │  Admin Dashboard   │
        │   (CLI Report)    │                 │ (Web / Inspector)  │
        └───────────────────┘                 └────────────────────┘
```

## 配置

### 环境变量 (.env)

```env
# 总开关 (true/false)
AUDIT_ENABLED=true

# 采样率 (0-100%)
AUDIT_SAMPLE_RATE=100
```

### 成本控制

| 场景 | 配置 | 说明 |
|------|------|------|
| 开发/调试 | `AUDIT_ENABLED=true`, `SAMPLE_RATE=100` | 全量记录 |
| 生产环境 | `AUDIT_ENABLED=true`, `SAMPLE_RATE=10` | 采样 10% |
| 紧急关闭 | `AUDIT_ENABLED=false` | 完全禁用 |

## 使用方法

### 1. 选词审计 (OMPS)

```typescript
import { auditOMPSSelection } from '@/lib/services/audit-service';

auditOMPSSelection(userId, {
    mode: 'SYNTAX',
    track: 'VISUAL',
    limit: 20,
    excludeCount: 5,
    reviewQuota: 6
}, {
    hotCount: 2,
    reviewCount: 4,
    newCount: 10,
    totalSelected: 16,
    selectedIds: [1, 2, 3, ...]
});
```

**contextMode**: `OMPS:SELECTION`

**自动标记**:
- `review_ignored`: 有复习配额但未选中复习词
- `selection_shortage`: 选词不足 50%

### 2. 记忆跃迁审计 (FSRS)

```typescript
import { auditFSRSTransition } from '@/lib/services/audit-service';

auditFSRSTransition(userId, {
    vocabId: 123,
    mode: 'SYNTAX',
    track: 'VISUAL',
    prevState: 2,
    prevStability: 5.5,
    grade: 3,
    gradeLabel: 'Good',
    reps: 5
}, {
    newState: 2,
    newStability: 12.3,
    scheduledDays: 7,
    masteryChange: { dim_v_score: 0.1 }
});
```

**contextMode**: `FSRS:TRANSITION`

**自动标记**:
- `repeated_failure`: 复习 5+ 次仍评分 Again
- `stability_drop`: 稳定性异常下降

### 3. LLM 生成审计

```typescript
import { auditLLMGeneration } from '@/lib/services/audit-service';

auditLLMGeneration(
    userId,
    'SYNTAX',           // mode
    'accomplish',       // targetWord
    payload,            // BriefingPayload
    {
        provider: 'aliyun',
        vocabId: 123,
        type: 'NEW'
    },
    { isPivotFallback: false }
);
```

**contextMode**: `L0:SYNTAX` / `L1:AUDIO` / `L2:CONTEXT`

**自动标记**:
- `pivot_fallback`: 使用了兜底模板

### 4. 会话兜底审计 (Fallback)

```typescript
import { auditSessionFallback } from '@/lib/services/audit-service';

// 当 Cache Miss 导致确定性兜底时调用
auditSessionFallback(userId, 'SYNTAX', 123, 'apple');
```

**contextMode**: `SYNTAX:FALLBACK`

**自动标记**:
- `session_fallback`: 触发了兜底逻辑

## Admin 仪表盘 (Phase 2 Implemented)

**路径**: `/admin/inspector` -> **全景审计 (Audit)** Tab

### 功能特性
1.  **KPI 监控**:
    *   **Selection Pulse**: 选词合规率 (Target > 98%)
    *   **Memory Flux**: 记忆保留率 (Target > 90%)
    *   **System Entropy**: 活跃异常数
2.  **日志浏览器**:
    *   OMPS / FSRS / LLM / ANOMALY 筛选
    *   实时查看 Payload 快照
3.  **UI 适配**:
    *   **Desktop**: Split View (Left List + Right Details)
    *   **Mobile**: List View + Bottom Drawer (抽屉式详情)

## 数据模型 (DrillAudit)

```prisma
model DrillAudit {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now())
  
  targetWord  String
  contextMode String?   // "OMPS:SELECTION" | "FSRS:TRANSITION" | "L0:SYNTAX" | ...
  userId      String?
  
  payload     Json      // { context: {}, decision: {} }
  status      String    // "PENDING" | "GOOD" | "BAD" | "AUDIT"
  auditTags   String[]  // ["review_ignored", "stability_drop", "session_fallback", ...]
  
  auditScore  Int?      // AI 评分 (1-10)
  auditReason String?   // AI 评分理由
  
  @@index([contextMode])
  @@index([userId])
}
```

## 审计报告脚本

```bash
npx tsx scripts/audit-report.ts
```

## 涉及文件

| 文件 | 职责 |
|------|------|
| `lib/services/audit-service.ts` | 统一审计服务 |
| `lib/services/omps-core.ts` | 选词埋点调用 |
| `actions/record-outcome.ts` | FSRS 埋点调用 |
| `workers/drill-processor.ts` | LLM 埋点调用 |
| `actions/get-next-drill.ts` | Session Fallback 埋点 |
| `actions/audit-actions.ts` | Admin API (Dashboard Data) |
| `app/admin/inspector/_components/audit-dashboard.tsx` | Dashboard UI |
| `scripts/audit-report.ts` | 健康报告脚本 |

## 后续规划

- **Phase 3**: Cron Job 自动 AI 评审 + 低分告警
