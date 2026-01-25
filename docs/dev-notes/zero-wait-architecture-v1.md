# Opus Zero-Wait Architecture (Technical Notes)

**Date**: 2026-01-25
**Version**: v1.0
**Status**: Implemented
**Related**: [Unified UI System](./unified-ui-system-v1.md)

## 1. 核心问题与解决方案
**问题**: Drill 生成依赖 LLM 实时响应，导致用户等待时间过长 (5-10s)，严重影响心流体验。
**方案**: 引入 **Zero-Wait Inventory System**，基于 Redis + BullMQ 实现库存预生成与异步补充。

## 2. 架构设计

### 2.1 流量与数据流
```mermaid
flowchart TB
    User -->|Request Page| NextJS[Next.js App Runtime]
    NextJS -->|1. Check Inventory| Redis[(Redis Cache)]
    Redis -->|Hit (Return Instant)| NextJS
    Redis -->|Miss (Trigger Job)| BullMQ[BullMQ Job Queue]
    
    subgraph Worker Service
        BullMQ -->|2. Process Job| Worker[Drill Processor]
        Worker -->|3. Generate| LLM[LLM Service]
        LLM -->|4. Save| DB[(PostgreSQL)]
        DB -->|5. Sync| Redis
    end
```

### 2.2 关键组件
*   **`lib/queue`**: 队列核心库。
    *   `inventoryQueue`: 基于 BullMQ 的库存队列实例。
    *   `connection.ts`: 复用 Redis 连接，防止连接泄露。
*   **`workers/drill-processor.ts`**: 独立 Worker 进程。
    *   **Pre-check**: 在调用 LLM 前再次检查库存。如果库存已满 (`currentCount >= limit`)，直接返回 `skipped_cache_full`，节省 Token 和算力。
*   **`lib/drill-cache.ts`**: 缓存逻辑层。
    *   支持 `limit` 参数 (默认 3 组)，实现精细的按需预取。

## 3. 队列管理 (`/dashboard/admin/queue`)
为了运维这套异步系统，我们构建了配套的管理能力。

### 3.1 核心功能
*   **实时监控**: 监控 Waiting, Active, Completed, Failed 任务状态。
*   **库存透视**: 实时查看各模式（SYNTAX, NUANCE 等）的缓存水位。
*   **熔断控制**: 支持手动暂停/恢复队列消费。
*   **死信处理**: 支持一键清空 (`obliterate`) 积压的失败任务。

### 3.2 关键修复记录
*   **Foreign Key Crash**: 修复了旧代码使用硬编码 `test-user` 导致写入 DB 失败的问题。现在 Worker 严格透传真实 `userId`。
*   **Worker Stability**: 增加了 Graceful Shutdown 处理。

## 4. 后续规划
*   **死信队列 (DLQ)**: 为多次失败的任务增加单独的 DLQ 处理逻辑。
*   **Priority Queue**: 为 VIP 用户或特定模式增加优先级。

## 5. Session Loop & Implicit Grading (Updated 2026-01-25)
为了与 Zero-Wait 架构互补，我们实现了**纯客户端闭环**与**时间感知评分**。

### 5.1 Client-Side Teleportation (闭环重学)
*   **机制**: 当用户答错(`Fail`)时，前端不请求后端生成新题，而是直接**克隆 (Clone)** 当前题目的 JSON Payload。
*   **策略**: 将克隆体插入当前队列 `Current + 5` 的位置（或队尾）。
*   **架构优势**:
    *   **Zero Latency**: 用户感知不到任何网络延迟。
    *   **No Token Cost**: 不消耗 LLM 资源。
    *   **FSRS Compatible**: 对算法而言，这是合法的 "Intra-day Re-learning" (日内重学) 步骤。

### 5.2 Time-Based Implicit Grading (隐式评分)
后端 (`record-outcome`) 根据前端上报的 `duration` 自动映射 FSRS 等级：

| 耗时 (Duration) | FSRS Grade | 含义 |
| :--- | :--- | :--- |
| < 1.5s | **4 (Easy)** | 秒杀，大幅延长间隔 |
| 1.5s - 5s | **3 (Good)** | 正常掌握 |
| > 5s | **2 (Hard)** | 犹豫，缩短间隔 |

### 5.3 Retry Cap (防作弊保护)
*   **问题**: 用户刚刚做错，几秒后重试通过（秒杀），如果评为 Easy 会导致 FSRS 错误地认为该词"非常简单"，从而推迟很久才复习。
*   **方案**: 
    - 前端在克隆时标记 `meta.isRetry = true`。
    - 后端检测到 `isRetry`，强制 **Max Grade = 3 (Good)**。
    - **效果**: 承认用户的短期修正，但拒绝给予长期稳定性的过度奖励。
