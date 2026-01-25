# Opus V2.0 架构文档：五维记忆与无限流系统

## 1. 核心理念：Schedule-Driven Architecture

V2.0 架构将 **"内容生产 (Content)"** 与 **"复习调度 (Schedule)"** 完全解耦，实现了 **Zero-Wait** 的极速响应体验。

*   **Inventory (库存)**: 针对特定单词的、无状态的题目 (Drill) 仓库。只管"存"，不管"何时用"。
*   **FSRS (调度)**: 仅负责计算"哪个词该复习了" (Who & When)。
*   **Briefing Engine (组装)**: 实时响应用户请求，将 FSRS 选出的词与 Inventory 中的题目结合，组装成 Briefing。

---

## 2. 五维记忆模型 (The 5-Dimension Model)

系统不再笼统地评估"掌握程度"，而是跟踪 5 个独立维度的分数 (0-100)：

| 维度代码 | 名称 | 侧重能力 | 对应题型 (DrillType) | 存储字段 |
| :--- | :--- | :--- | :--- | :--- |
| **MEA** | Meaning | 词义映射 (中英) | `S_V_O` | `dim_mea_score` |
| **VIS** | Visual | 拼写/形似干扰 | `VISUAL_TRAP` | `dim_vis_score` |
| **CTX** | Context | 语境应用 | `PART5_CLOZE` | `dim_ctx_score` |
| **AUD** | Audio | 听音辨义 | `AUDIO_RESPONSE` | `dim_aud_score` |
| **LOG** | Logic | 逻辑/搭配 | `PARAPHRASE_ID` | `dim_log_score` |

---

## 3. 数据流架构 (Data Flow)

### 3.1 取题流程 (Hybrid Fetch Engine)
API: `fetchNextDrillV2(userId)`

请求处理遵循 **"5-Step Fallback"** 链路，确保永不阻塞：

1.  **Check Injection (错题优先)**:
    *   检查 Redis `injection:{userId}` 队列。
    *   如果存在且已到时间 (`score <= NOW`)，优先返回错题 (复现)。
2.  **Check FSRS (到期复习)**:
    *   查询 Postgre DB `UserProgress` 表，找 `next_review_at <= NOW` 的词。
3.  **Select Weakest Drill (弱点打击)**:
    *   根据该词的 5 维分数，选择 **分值最低** 且 **符合互斥规则** (不连续考同一维度) 的题型。
    *   例如：MEA=80, VIS=30 -> 选择 `VISUAL_TRAP`。
4.  **Fetch Inventory (库存命中)**:
    *   尝试从 Redis `inventory:{userId}:vocab:{id}:{drillType}` 弹出一道题。
    *   **Hit**: 直接返回。
    *   **Miss**: 进入 Step 5。
5.  **Fallback & Async Replenish (降级与补货)**:
    *   **降级**: 使用 `deterministic-drill` 生成器，构建一个基础兜底题目 (Zero-Wait)。
    *   **补货**: 触发 BullMQ `replenish_one` 任务 (High Priority)，通知 Worker 生产该题型。

### 3.2 提交与结算 (Submission & Settlement)
API: `submitAnswerV2`

1.  **隐式评分 (Implicit Grading)**:
    *   `Pass` + `< 1.5s` = **Easy (4)**
    *   `Pass` + `> 5s` = **Hard (2)**
    *   `Fail` = **Again (1)**
2.  **即时反馈**:
    *   更新对应维度的分数 (+5 / -5)。
    *   写入 `StudyLog` 流水。
3.  **错题注入 (Injection)**:
    *   若答错 (`Again`)，计算 "换维打击" 题型 (e.g. VIS 错 -> 考 MEA)。
    *   推入 Redis `injection:{userId}`，设定 Score 为 `NOW + 3min`。
4.  **窗口缓冲 (Window Buffer)**:
    *   更新 Redis `window:{userId}:{vocabId}` (记录本次 Session 的尝试次数和成绩)。
    *   刷新 `active_sessions` ZSet (Score = NOW)，用于 Worker 扫表。

### 3.3 会话结算 (Session Settler)
Worker: `session-settler` (CRON: Every Minute)

*   **扫描**: 检查 Redis `active_sessions`，找出 `Score < (NOW - 5min)` 的用户。
*   **结算**:
    *   聚合 `window:*` 数据。
    *   调用 `fsrs.next_interval` 计算下一次复习时间。
    *   更新 DB `UserProgress`。
    *   清除 Redis 缓冲。

---

## 4. 基础设施与 Redis Schema

### 4.1 Redis Key 设计

| Key Pattern | 类型 | 用途 | TTL |
| :--- | :--- | :--- | :--- |
| `inventory:{uid}:vocab:{vid}:{type}` | List | 分频道题库 (Payload JSON) | Persistent |
| `injection:{uid}` | ZSet | 错题注入队列 (Member=Payload, Score=Timestamp) | Persistent |
| `window:{uid}:{vid}` | Hash | 会话内短期记忆缓冲 | 1 hr |
| `active_sessions` | ZSet | 活跃用户心跳表 (Member=uid, Score=LastAct) | Persistent |

### 4.2 消息队列 (BullMQ)

| Queue Name | Job Name | 优先级 | 触发场景 | 处理逻辑 |
| :--- | :--- | :--- | :--- | :--- |
| `inventory-queue` | `replenish_one` | High (1) | 库存 Miss / 错题降级 | 生成单题入库 |
| `inventory-queue` | `replenish_batch` | Low (5) | 低水位检测 (异步) | 批量生成 (Plan C) |
| `session-settler` | `settle` | CRON | 每分钟 | 扫表结算不活跃用户 |

---

## 5. UI/UX 关键组件

*   **UniversalDrill**: 统一容器，根据 Briefing Header 动态渲染不同题型。
*   **InteractionZone**: 封装交互逻辑 (Swipe/Select)，处理动画与即时反馈。
*   **InfiniteDrillFlow**: 负责管理前端队列、预加载 (Threshold=2) 和无缝滑窗动画。

---

## 6. 开发规范

*   **Schema First**: `BriefingPayload` 定义在 `types/briefing.ts`，Zod 校验严格匹配。
*   **Server Actions**: 所有写操作通过 SA 完成，禁止 Client 直接调 DB。
*   **Logs**: 关键链路 (Actions/Worker) 必须输出结构化日志 (JSON)，包含 `userId`, `correlationId`。
