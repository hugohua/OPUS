# Opus Phase 2 架构技术总结 (Architecture Postmortem)

**Date**: 2026-01-29
**Status**: Implemented & Verified
**Focus**: Multi-Track System, Zero-Wait Protocol, Worker Isolation

## 1. 核心变革 (Core Changes)

Phase 2 将系统从 "单一模式 + 同步生成" 升级为 "**多轨道 (Multi-Track) + 生产消费分离**"。

### A. 多轨道系统 (Multi-Track System)
数据不再是一维的 "Word"，而是分解为三个维度的 "Track"：
*   **VISUAL (L0)**: 关注拼写与句法 (Syntax Drill)。
*   **AUDIO (L1)**: 关注听感与韵律 (Chunking/Rhythm)。
*   **CONTEXT (L2)**: 关注语境与逻辑 (Logic/Nuance)。

**DB 变更**:
*   `UserProgress` 表新增复合主键: `@@unique([userId, vocabId, track])`。
*   这就允许同一个词在不同维度独立计算遗忘曲线 (FSRS)。

### B. 生存优先架构 (Zero-Wait Protocol)
为了消除 LLM 生成带来的 10s+ 等待时间，我们实施了严格的**生产-消费分离**：

1.  **消费端 (Frontend)**:
    *   调用 `getNextDrillBatch`。
    *   **只读 Redis**: 99% 的情况下直接从 `user:{uid}:mode:{m}:vocab:{vid}:drills` 列表中 `LPOP`。
    *   **确定性兜底**: 如果 Redis 为空，立即返回规则生成的简单卡片 (Deterministic Fallback)，确保 UI 零等待。
    *   **触发补货**: 同时异步触发 `inventory.triggerBatchEmergency` 任务。

2.  **生产端 (Worker)**:
    *   监听 BullMQ 队列 `drill-inventory`。
    *   **任务类型**:
        *   `replenish_batch`: 紧急补货 (Priority High).
        *   `generate-[mode]`: 常规预测生成 (Priority Low).
    *   **LLM 管道**: 针对不同 Track 调用不同的 `lib/generators` (Prompt Engineering)。
    *   **写入 Redis**: 生成结果 `RPUSH` 到用户队列。

## 2. 关键组件 (Key Components)

| 组件 | 路径 | 职责 |
|------|------|------|
| **OMPS Core** | `lib/services/omps-core.ts` | **大脑**。决定"下一个该学哪个词"。统一了候选词逻辑，供 API 和 Worker 共同使用。 |
| **Inventory** | `lib/inventory.ts` | **仓库**。管理 Redis List 的 Push/Pop，以及触发 Worker 的信号。 |
| **Generators** | `lib/generators/**` | **工厂**。包含 L0/L1/L2 的 Prompt 模板与 Parsing 逻辑。 |
| **Worker** | `workers/index.ts` | **工人**。后台进程，负责调用 LLM 并搬运数据。 |

## 3. 部署与环境隔离 (Deployment Note)

在验证过程中，我们发现了 **Docker vs Host** 的网络隔离问题：
*   **现象**: Host 端脚本连接 `localhost:6379`，Docker Worker 连接 `opus-redis:6379`。如果两个地址不指向同一实例，会导致"生产者在 A 写，消费者在 B 读"的 Split Brain 现象。
*   **解决**: 确保 `.env` 中的 `REDIS_URL` 在不同环境下正确解析到同一个物理 Redis 实例。

## 4. 验证脚本 (Verification Scripts)

为了保障系统稳定性，我们固化了以下测试脚本：
*   `scripts/sim-flow-v2.ts`: **全链路仿真**。模拟 "Cold Start (Fallback) -> Worker Gen -> Warm Hit" 的闭环。
*   `scripts/verify-generators.ts`: **Prompt 验证**。静态检查 Prompt 结构。
*   `scripts/verify-db-schema.ts`: **DB 结构验证**。确保 Track 字段与索引存在。
*   `scripts/restore-user.ts`: **账号急救**。修复 P2003/P2002 错误，强制重置用户状态。

## 5. FSRS 接入
*   `actions/record-outcome` 已升级支持 `track` 参数。
*   写入时会自动查找对应的 `UserProgress(userId, vocabId, track)` 记录进行更新。

---

**Next Steps**:
*   进一步调优 L1/L2 的 Prompt 质量。
*   优化 Worker 的并发策略 (Rate Limit)。
*   监控 Redis 内存使用情况 (TTL Policy)。
