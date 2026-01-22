# Opus Mobile (V3.3) Vibe Coding 任务清单

**给 LLM 的核心指令 (Master Directive):**
你正在构建 **Opus**，一个用于认知复健 (Level 0) 的 **口袋职场模拟器**。

*   **核心思维**: "先活下来 (Survive First)"。每日限制 20 张卡片。不要做一个“阅读器”，要做一个“特训器 (Drill)”。
*   **UI 策略**: "哑巴" 前端 (负责句法高亮) + "聪明" 后端 (负责 Drill Prompt 生成)。
*   **技术栈**: Next.js 14 (App Router), Prisma, pgvector, Shadcn UI (Mobile), Tailwind CSS。
*   **数据源**: 所有词汇元数据均通过 **Gemini ETL** 预计算。

---

## 🟢 Phase 0: 数据基石 (The Bedrock)

> **目标**: 确保数据库支持“五维”模拟，并处理好 Gemini 3 Preview 的限制。

*   [x] **Task 0.1: 定稿 Prisma Schema**
    *   **状态**: 完成。
    *   **内容**: `Word` 表包含 `word_family` (JSON), `synonyms`, `priority`。
    *   **验证**: `UserProgress` 表已包含 `dim_v_score` 等五维分数及 `next_review_at` 字段。

*   [x] **Task 0.2: 启用 pgvector**
    *   **状态**: 完成。

*   [x] **Task 0.3: ETL 脚本 (数据清洗) **
    *   **指令**: 创建/更新 `scripts/enrich-vocab.ts`。
    *   **关键更新**: 使用 `google/gemini-2.0-flash-preview`。

*   [x] **Task 0.4: 数据库填充 (Seed)**
    *   **指令**: 创建 `prisma/seed.ts`。
    *   **命令**: `npx prisma db seed`。

*   [x] **Task 0.5: 向量化脚本**
    *   **指令**: 创建 `scripts/vectorize-vocab.ts`。
    *   **逻辑**: 使用 Aliyun `text-embedding-v2` (1536维) + 语义三明治 Payload。

---

## 🟡 Phase 1: 简报引擎 (The Brain)

> **目标**: 构建 **Level 0 特训引擎** (Hybrid Fetch V3.0 + Drill Prompt)，替代原先的随机取词逻辑。

*   [x] **Task 1.1: 实现 Drill Prompt (特训提示词) **
    *   **文件**: `lib/prompts/drill.ts`。
    *   **逻辑**: 强制 Level 0 约束 (15词, S-V-O, XML标签 `<s>`, `<v>`, `<o>`)。

*   [ ] **Task 1.2: 实现混合取词引擎 (Hybrid Fetch V3.0) **
    *   **新任务**: 依据 PRD 4.5.A 实现 **30/50/20 Protocol**。
    *   **文件**: `actions/get-next-drill.ts`。
    *   **逻辑**:
        1.  **Rescue Queue (30%)**: 句法薄弱 (`dim_v_score < 30`)。
        2.  **Review Queue (50%)**: SRS 到期 (`next_review_at <= NOW`)。
        3.  **New Acquisition (20%)**: 生存优先排序 (Verb First > Hotness > Short)。

*   [ ] **Task 1.3: 重构 `generateBriefing` Action **
    *   **状态**: **需要重构** (接入 Task 1.2 的引擎)。
    *   **文件**: `actions/generate-briefing.ts`。
    *   **逻辑**:
        1.  **检查每日熔断**: `today_count >= 20` 返回 `RestCard`。
        2.  调用 `get-next-drill` (Task 1.2) 获取单词。
        3.  调用 LLM (Gemini) 生成 Drill Prompt。
        4.  **Error Boundary**: 超时/失败时返回 Fallback Template。

*   [x] **Task 1.4: 兜底模板 (安全网)**
    *   **指令**: 创建 `lib/templates/fallback-briefing.ts`。
    *   **状态**: 完成。

---

## 🔵 Phase 2: 收件箱与界面 (The Body)

> **目标**: "拇指驱动" 界面 + **认知辅助** (句法高亮 + TTS)。

*   [x] **Task 2.1: "收件箱" 信息流 (首页)**
    *   **文件**: `app/page.tsx`。
    *   **逻辑**: 加载 Briefing, 自动播放 TTS (`window.speechSynthesis` 或 Audio Block)。

*   [x] **Task 2.2: 句法高亮渲染器**
    *   **文件**: `components/briefing/syntax-text.tsx`。
    *   **样式**: `<s>`(绿), `<v>`(红粗), `<o>`(蓝底)。

*   [x] **Task 2.3: 统一交互组件**
    *   **文件**: `components/briefing/interaction-zone.tsx`。
    *   **组件**: `SwipeChoice` (V-Dim), `FlipCard` (Translation)。

---

## 🟣 Phase 3: 模拟循环 (The Soul)

> **目标**: 记录进度并强制执行 **每日熔断**。

*   [ ] **Task 3.1: 记录结果 Action (Record Outcome)**
    *   **文件**: `actions/record-outcome.ts`。
    *   **逻辑**:
        1.  **更新五维分数**: 正确时增加对应 `dim_x_score` (PRD 4.5.C)。
        2.  **SRS 调度**: 更新 `next_review_at`, `interval`, `easeFactor`。
        3.  **每日计数**: 增加 `today_count`, 返回 `daily_cap_reached`。

*   [ ] **Task 3.2: 休息卡 (Rest Card) UI**
    *   **状态**: 待办。
    *   **触发**: `daily_cap_reached == true`。
    *   **文案**: "You survived today. See you tomorrow."。

---

## ⚫ Phase 4: 扩展 (Future / Phase 2: The Intern)

*   [ ] **Task 4.1: Level 1 升级 (Scenario Prompt / Email)**
    *   启用 Level 1 逻辑，支持邮件格式和 "Hint Only" 翻译。
*   [ ] **Task 4.2: X 维度 (Logic / Slot Machine)**
*   [ ] **Task 4.3: Auth 集成 & User Profile**

## 待优化
* [ ] 优化单词记忆曲线
* [ ] 优化卡片加载逻辑，建议预加载或一次生成
