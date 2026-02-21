# 新增训练模式 (Session Mode) 端到端开发指南

在 Opus (Mobile) 架构中，新增一种全新的答题类型/训练模式（如阅读、听力、全新的竞技场子类别等）需要贯穿从**类型定义 -> 缓存队列 -> AI 生成 -> 前端 UI -> 管理大盘** 的完整全栈链路。

请严格依据以下 8 大步骤与 Checklist 进行端到端 (End-to-End) 变更，以符合 Zero-Wait 和 FSRS 规范。

---

## 步骤 1：全栈类型与常量注册 (Types & Constants)
这是让整个系统识别新题型的骨架。

- [ ] **`types/briefing.ts`**: 将新 Mode 名称（如 `NEW_MODE`）追加到 `SessionMode` 或 `SingleScenarioMode` 类型定义中。确保整个项目对该模式具备强类型约束。
- [ ] **`lib/constants/modes.ts`**: 将新模式的名片及其对外显示的中文标签（例如 `'NEW_MODE': '新型题库'`）注册至 `MODE_LABELS` 对象，供各处 UI 统一渲染。

## 步骤 2：库存阈值与容量配置 (Inventory Config)
Opus 通过提前生产（Pre-generation）保障 C 端 Zero-Wait。必须告诉系统该模式的缓存池水位该保持在哪里。

- [ ] **`lib/drill-cache.ts` / `lib/config/mixed-mode-config.ts`**: 将新 Mode 注册纳入 `CACHE_LIMIT_MAP`。指明它在 Redis 缓冲池中需要多少个 batch（例如 `NEW_MODE: 6` 代表维持 30 题）。

## 步骤 3：队列与调度控制台 (Admin Dashboard)
为了让你能监控该模式是否正常生成并在测试时手动触发，必须将新模式接入管理员后台队列页面。

- [ ] **`lib/core/inventory.ts`**: 在 `getInventoryStats()` 方法中，补充对该 Mode 强类型转型的解析（如 `NEW_MODE: parseInt(raw.NEW_MODE || '0')`），防止 Redis Hash 被误漏。
- [ ] **`actions/queue-admin.ts`**: 在 `getCacheStats()` 的返回类型 `Promise<{ ... }>` 中严格声明它的字段，并为默认空返回对象填充 `0`。
- [ ] **`components/admin/cache-stats-card.tsx`**: 给总览卡的 `MODE_GROUPS` 添加此模式（或归入合适的 L0/L1/L2 层级），它会自动渲染库存条。
- [ ] **`components/admin/operation-panel.tsx`**: 增加触发组，为其提供独立调用 `handleTrigger('NEW_MODE')` 以及一键清理库存的 `TriggerButton`。

## 步骤 4：AI 生产引擎 (Generator Layer)
Worker 守护进程会在后台调度 LLM 不断造题，这里是生产力的核心。

- [ ] **设计 Prompt**: 设计专门适配新题型的 LLM 提示词模板（System Prompt + User Prompt），要求输出标准化的 `BriefingPayload`（可参考 `prompt-structure-v2.md`）。
- [ ] **`lib/generators/xxx.ts`**: 创建生产该 Drill 的封装函数代码。
- [ ] **`workers/drill-processor.ts`**: 在后台消费主循环的 `switch (mode)` 判断中，添加 `case 'NEW_MODE'`，将其分发给你刚写好的 Generator 函数执行。

## 步骤 5：前端 C 端发牌与降级 (Distribution & Fallback)
用户进入训练后获取预生成缓存，如果缓存耗尽（Cache Miss），则走同步降级链路不卡死客户端。

- [ ] **`actions/get-next-drill.ts`**:
    - **预加载逻辑**: 如果该题库涉及原题数据库的提取，应当在这里增加批量 (Batch) `findMany` 以免掉入 N+1 并发灾难。
    - **分发路由**: 在缓存未命中 fallback 流程，通过 `if (mode === 'NEW_MODE')` 为其注册专属退化方案（通常需要新建类似 `[mode]-fallback.ts` 把基础词汇加工成简单的备用题目）。

## 步骤 6：前端 C 端答题界面 (User Interface)
有了数据报文，前端得有可视化的载体去承接互动。

- [ ] **`app/session/[mode]/page.tsx`**: 如果它是一个独立跳转入口（非混合），则建立它的路由页面。
- [ ] **答题组件实现**: 撰写交互卡片。基于下发的 `interaction` (`swipe_card` / `bubble_select` / `slot_machine`) 提供配套的 React 骨架。

## 步骤 7：混合模式与 FSRS 打通 (Mixed Scheduling) - *视情况而定*
如果这个模式不仅仅在独立入口，还想被加入每日核心抗遗忘复习的混合抽查中：

- [ ] **`lib/core/scenario-selector.ts`**: 将新 Mode 名依其难度添加到 `MIXED_MODE_SCENARIOS`（比如针对 L1_MIXED 或是 L2_MIXED 的数组里）。借此，OMPS 挑选到的复习词会依不同 Stability 概率随机坠入你的新题型。

## 步骤 8：测试断言封层 (Testing)
永远验证主干流逻辑不受破坏。

- [ ] **`actions/__tests__/get-next-drill.test.ts`**: 设计单测，模拟它的 Cache Miss 时能否正确调取所分配的专属 Fallback。
- [ ] (可选) 如增加新的 API，则建立 `.hurl` 进行健康探测拉取。
