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
