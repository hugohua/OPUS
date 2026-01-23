# Opus Mobile (V3.3) Vibe Coding 任务清单

**给 LLM 的核心指令 (Master Directive):**
你正在构建 **Opus**，一个用于认知复健 (Level 0) 的 **口袋职场模拟器**。

*   **核心思维**: "先活下来 (Survive First)"。每日限制 20 张卡片。不要做一个“阅读器”，要做一个“特训器 (Drill)”。
*   **UI 策略**: "哑巴" 前端 (负责句法高亮) + "聪明" 后端 (负责 Drill Prompt 生成)。
*   **技术栈**: Next.js 14 (App Router), Prisma, pgvector, Shadcn UI (Mobile), Tailwind CSS。
*   **数据源**: 所有词汇元数据均通过 **Gemini ETL** 预计算。

> **Current Focus**: v1.5 (The Immersion Release) - Magic Paste & Commute Mode.

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

*   [x] **Task 1.2: 实现混合取词引擎 (Hybrid Fetch V3.0) **
    *   **状态**: 完成 (`actions/get-next-drill.ts` implemented 30/50/20 Protocol).

*   [x] **Task 1.3: 重构 `generateBriefing` Action **
    *   **状态**: 完成 (Merged into `actions/get-next-drill.ts`).
    *   **逻辑**: Integrated Drill Prompt generation and Batch Fetching.

*   [x] **Task 1.4: 兜底模板 (安全网)**
    *   **指令**: 创建 `lib/templates/fallback-briefing.ts`。
    *   **状态**: 完成。

---

---

## 🚀 Phase 1.5: 沉浸式体验 (The Immersion - v1.5) [NEW]

*   [ ] **Task 1.5.1: Magic Paste (语境注入) [P0]** (Feature 9)
    *   **Schema**: UserProgress 增加 `source` & `originalText`。
    *   **Action**: `actions/magic-paste.ts` (Extraction & Filtering).
    *   **UI**: Navbar Capture Button & Textarea Modal.

*   [ ] **Task 1.5.2: Commute Mode (Audio Stream) [P1]** (Feature 8)
    *   **Action**: `actions/get-audio-playlist.ts` (Queue Fetch).
    *   **UI**: Audio Player (Looping, Background Play).
    *   **TTS**: Aliyun CosyVoice Integration.

*   [ ] **Task 1.5.3: Phrase X-Ray (Visual)** (UI Feature)
    *   **UI**: `components/vocab/phrase-xray.tsx` (Collocation View).

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

*   [x] **Task 3.1: 记录结果 Action (Record Outcome)**
    *   **状态**: 完成 (`actions/record-outcome.ts` implemented FSRS & V-Score).

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
* [ ] 向量搜索: 目前 Context Words 使用 ORDER BY RANDOM() (符合 Phase 1)，后续进阶模式 (Nuance) 需升级为 Vector Search。

