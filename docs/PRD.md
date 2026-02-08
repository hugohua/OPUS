# Opus (Mobile) - PRD Master: The Executive Briefing

> 该文档已过时，请查看 PRDV2.md

| 属性 | 内容 |
| --- | --- |
| **项目名称** | Opus (Mobile) |
| **版本** | **v1.8 (The "Ammo Depot" Release)** |
| **状态** | **Active Development** |
| **核心理念** | **"Zero-Wait" + "5-Dim Memory Radar"** |
| **产品形态** | **口袋职场模拟器 (Pocket Workplace Simulator)** |
| **技术栈** | Next.js 14+, Prisma, **FSRS v5**, pgvector, **BullMQ + Redis** |
| **UI 框架** | Shadcn UI + Tailwind CSS (Mobile First) |
| **更新时间** | 2026-01-25 |

---

## 0. Change Log

* **v1.8 (Current)**:
  * [Architecture] **弹药库模式 (Ammo Depot)**: 彻底解耦库存 (Redis) 与调度 (Postgres)，实现 Zero-Wait 体验。
  * [Algorithm] **隐式评分 (Implicit Grading)**: 基于答题耗时自动映射 FSRS 评分。
  * [Product] **五维记忆雷达 (TOEIC Adapted)**: 重构五维定义 (境/音/形/义/理)，深度适配 TOEIC。
  * [UI] **万能卡片 (Universal Card)**: 统一所有题型的 DOM 结构。
* **v1.7**: Zero-Wait 初步尝试 (Inventory Layer)。
* **v1.6**: Commute Mode, Topic Briefing。

---

## 1. 核心架构：弹药库模式 (The "Ammo Depot" Pattern)

### 1.1 CP 分离架构 (Content-Schedule Decoupling)

* **Schedule (Who & When)**: **Postgres (`UserVocab`/`UserProgress`)**
  * 负责 FSRS 调度计算，决定“今天复习哪个单词”。
  * 核心字段：`next_review_at`, `masteryScore`.
* **Content (What)**: **Redis (`Inventory`)**
  * 负责存储“弹药” (Drill Payload)。
  * **不带时间属性**，仅按 `vocab_id` 和 `dimension` 存储。
  * 结构：`user:{userId}:vocab:{vocabId}:drills` (List).

### 1.2 数据流 (Data Flow)

1. **Consumer (Frontend)**: 点击 Start -> 查询 DB 获取 `DueVocabs` -> 根据 ID 从 Redis `LPOP` 题目。
2. **Producer (Worker)**: 监控 Redis 库存水位 -> 低于阈值 (Limit=3) -> 触发 LLM/Python 生成 -> `RPUSH` 入库。
3. **Failover**: 若 Redis 击穿，降级使用各种 Deterministic Template，并触发高优先级补货任务。

---

## 2. 核心算法：FSRS v5 + 隐式评分 (Implicit Grading)

### 2.1 基于时间的隐式评分

前端保持“二选一” (Pass/Fail) 极简交互，后端根据**答题耗时**自动映射 FSRS 等级。

| 交互行为 | 耗时 (Duration) | FSRS Grade | 算法逻辑 |
| --- | --- | --- | --- |
| **Fail** | N/A | **1 (Again)** | 稳定性重置，间隔归零。 |
| **Pass** | > 5s | **2 (Hard)** | 犹豫，间隔轻微增加。 |
| **Pass** | 1.5s - 5s | **3 (Good)** | 正常掌握。 |
| **Pass** | < 1.5s | **4 (Easy)** | 秒杀，大幅延长间隔。 |

### 2.2 Session Loop (急救闭环)

* **Again (1) 策略**: 不推迟到明天。
* **In-Session Requeue**: 立即将错题插入当前 Session 队列末尾（或 5 题后）。
* **目标**: 今日错题必须在今日 Session 内至少做对一次。

### 2.3 Level 0 策略: 无限流 (Infinite Scroll)

* **Old Logic**: 固定做完 20 题结束 (Session Batch)。
* **New Logic**: **无限流 (Infinite Scroll)**。
  * **No Cap**: 不再强制中断心流，用户可随时退出。
  * **Pre-fetch**: 当剩余题目 < 10 时，自动拉取下一组 (Batch=10)，确保 Zero-Wait 体验。
  * **Rationale**: 模拟 TikTok 体验，降低“开始学习”的心理门槛。

---

## 3. 五维记忆系统 (5-Dimensional Memory - TOEIC Adapted)

针对 TOEIC 考试特点（全选择题、无拼写、重辨析），重构五维定义。

| 维度 | 定义 (TOEIC Adapted) | 题型代号 | 技术实现 |
| --- | --- | --- | --- |
| **1. 境 (Context)** | Part 5 语法/词义辨析 | `PART5_CLOZE` | LLM 生成挖空句，Python 生成词性干扰项。 |
| **2. 音 (Audio)** | Part 2 听音选义 | `AUDIO_RESPONSE` | **Python FastAPI TTS Service** (阿里云 DashScope `qwen3-tts-flash`)，MD5 Hash 缓存，Docker 部署，音频文件共享至 `public/audio/`。 |
| **3. 形 (Visual)** | 形似词/易混词找茬 | `VISUAL_TRAP` | Python (`Levenshtein`) 计算编辑距离，生成干扰项 (e.g. Adapt vs Adopt)。 |
| **4. 义 (Meaning)** | 快速语义映射 | `S_V_O` | Redis 快速存取，中英互译基础题。 |
| **5. 理 (Logic)** | 同义/近义替换 | `PARAPHRASE_ID` | pgvector 向量搜索相似词。 |

### 3.1 短板驱动调度 (Weakness-Driven Dispatch)

* **逻辑**: 每次复习时，检查该单词的五维雷达分。
* **Rule**: `If score(Audio) < score(Spelling) THEN Fetch(Drill_Type_Audio)`。
* 系统不再随机出题，而是精确打击短板。

---

## 4. UI/UX: 通用界面架构

### 4.1 "Smart Stream" (首页逻辑)

* **Primary Entry**: **"Daily Blitz" (智能混合流)**。
  * 系统根据 FSRS + 五维短板自动混合题型 (Interleaving)。
* **Secondary Entry**: **"Skill Gym" (专项训练)**。
  * 提供 Part 5 / Part 2 / 速读 等专项入口。

### 4.2 Universal Card Layout (万能卡片)

所有题型必须适配同一套 DOM 结构，保证心流不被打断。

* **Zone A: Stimulus (Flex-1, Top)**
  * *S-V-O*: 大字单词。
  * *Cloze*: 挖空句子。
  * *Audio*: **波形动画 (无文本)**。
  * *Visual*: 中文定义。
* **Zone B: Interaction (Fixed-H, Bottom)**
  * 统一使用 Grid 布局的 Button Group。
  * 支持 2x1 (大按钮) 或 2x2 (标准选项)。
* **Zone C: Feedback (Overlay)**
  * 底部弹出的 Drawer，展示解析 (Explanation)。

---

## 5. 数据库 Schema 变更 (Prisma)

### 5.1 `UserProgress` Update (原 UserVocab 概念)

新增五维分数记录与综合分。

```prisma
model UserProgress {
  // ... existing fields
  
  // [New] 五维雷达分 (0-100)
  dim_visual    Int @default(0) // 形
  dim_audio     Int @default(0) // 音
  dim_meaning   Int @default(0) // 义
  dim_context   Int @default(0) // 境
  dim_logic     Int @default(0) // 理
  
  masteryScore  Int @default(0) // 综合分
}
```

### 5.2 `QuizInventory` (Postgres Snapshot)

虽然主要依赖 Redis，但 Postgres 需保留 `QuizInventory` (或更新 `DrillCache`) 以支持冷备与复杂查询。

* **JSON 结构**: 严格定义 `type` 字段 (`PART5_CLOZE`, `AUDIO_RESPONSE`, `VISUAL_TRAP`, `S_V_O`)。

---

## 6. 开发计划 (Next Steps)

1. **Backend**: 更新 `actions/quiz.ts`，实现 FSRS 隐式评分逻辑。
2. **Worker**: 编写 Python 脚本 (`workers/visual-trap.py`) 实现 Levenshtein 干扰项生成。
3. **Frontend**: 开发 `UniversalDrillCard.tsx` 组件，并适配 4 种题型模式。
4. **DevOps**: 确保 Python Audio Service 接入 Docker Network，并挂载 `shared-assets` 卷。