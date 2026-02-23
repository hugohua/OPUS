# Adaptive Diagnostic Engine (自适应诊断引擎)

## 1. 架构概览 (Overview)

自 V7.0 开始，Opus 引入了 **Adaptive Diagnostic Engine (自适应诊断引擎)**，标志着系统从“盲目抽题”进化为“诊断驱动”的学习闭环。

该引擎通过收集用户在 The Arena 中的答题表现，智能诊断用户的语法薄弱环节（如：词形变换、动词短语），并将此诊断结果反馈给 LLM 生成流水线，实现**“你越弱，越练什么”**的针对性出题体系。

数据流闭环：
1. **Telemetry (遥测层)**: `actions/arena-telemetry.ts` 收集前端答题数据。
2. **Aggregation (诊断层)**: `lib/services/diagnostic-service.ts` 提供无前台依赖的数据聚合。
3. **Application (应用层)**: `lib/generators/arena/part5-drill.ts` 根据权重动态决定出题方向。
4. **Visualization (表现层)**: `components/arena/diagnostic-radar.tsx` 为用户展示雷达图。

---

## 2. 核心模块详解 (Core Modules)

### 2.1 遥测数据流 (Telemetry Data Flow)
- **拦截器**: 前端 `hooks/use-drill-session.ts` 识别 `ARENA_PART5` 模式。
- **数据结构**: 只要存在 `questionSeedId`，即触发 `recordArenaOutcome`。
- **持久化**: 异步写入 `AttemptRecord` 表（包含 `userId`, `isCorrect`, `questionType`, `responseTimeMs`）。
- **非阻塞设计**: 使用 Fire-and-forget 模式，避免阻塞前端 FSRS 状态的乐观更新。

### 2.2 降维打击机制 (Intervention / Step-down)
为了防止用户在 The Dojo (抽认卡) 中刷出虚假的“已掌握”状态，只要在 Arena 中答错，就会触发后置审查 `checkAndTriggerIntervention`：
- **触发条件**: 过去 5 次 Arena 答题中，错 3 次及以上。 
- **原子操作重置**: 使用 Prisma `$transaction` 强行将该词的 FSRS 轨道打回 `Learning`。
  - `state: 1`
  - `stability: 0`
  - `dueDate: new Date()`
  - `next_review_at: new Date()`
- **审计追踪**: 同时写入 `DrillAudit`（标签：`step_down`, `arena_failure`），确保干预可追溯。

### 2.3 诊断驱动的出题生成 (Diagnostic-Driven Generation)
> **⚠️ 核心澄清**: 此处的“分类加权”专属干预于 **“用什么题型考”** (出题生成环节)，绝不干预 **“选什么难度的词库单词”** (OMPS 选词引擎专属职责)。

传统随机生成题型由于权重均匀，对解决具体薄弱项效率低下。
- **加权选择器 (`buildWeightedTypePicker`)**: 位于 `diagnostic-service.ts`，由 `drill-processor` 调度分发时调用。
- **动态应用 (`part5-drill.ts`)**: 在大模型入参点，利用加权函数取得题型靶向 (`targetType`)，包裹预先选好的客观词汇送入沙箱造题。
- **反转正确率算法**: 将用户的分类正确率反转为抽签权重。例如正确率 30% 则权重为 70。
- **冷启动安全 (Safe Fallback)**: 当用户无答题记录时，优雅降级为纯均匀随机。
- **底座保障**: 所有题型保留基线权重（最小为 10），确保已掌握题型不会永久消失。

### 2.4 Brain-Worker 分离架构 (Separation of Concerns)
为遵循 Opus 技术红线（Brain-Worker Separation）：
- **`lib/services/diagnostic-service.ts`**: **纯数据库层**。提供 `getUserWeaknessesRaw` 和加权选题逻辑，**不含** `'use server'`，使得独立运行的 Worker 进程可以无阻引用。
- **`actions/diagnostic-engine.ts`**: **Server Action 层**。包含 `'use server'`，为前端 React 组件（雷达图）包裹 Auth 鉴权薄壳。

---

## 3. 开发规范与维护 (Maintenance)

- **新增遥测字段**: 如需扩展新的维度（例如是否使用了提示），必须同步修改 `prisma/schema.prisma` 中的 `AttemptRecord` 和 `actions/arena-telemetry.ts` 的 Zod 校验。
- **监控数据库索引**: 诊断聚合极其依赖于索引。当前必需：`@@index([userId, questionType, isCorrect])` 和 `@@index([userId, anchorVocabId])`。
- **扩充题型**: 在 `QUESTION_TYPE_LABELS` 和数据库级 Enum `QuestionType` 中扩充新的考试题型（如 `READING_COMPREHENSION`），该引擎可直接兼容。
