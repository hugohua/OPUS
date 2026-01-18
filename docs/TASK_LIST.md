# Opus 项目开发任务清单 (Development Task List)

## 🟢 第一阶段: 数据基石 (Data Infrastructure)
> **目标：** 完成数据库构建、数据清洗、向量化存储。

- [x] **Task 1.1: Finalize Prisma Schema**
    * **状态：** 已完成
    * **内容：** 定义 Vocab, UserProgress, Article 表结构。

- [x] **Task 1.2: Enable pgvector & Migration**
    * **状态：** 已完成
    * **内容：** 启用 pgvector 扩展，在 Vocab 表添加 embedding 向量字段。

- [x] **Task 1.3: Implement ETL Script (DeepSeek)**
    * **目标：** 实现数据清洗与分级计算脚本。
    * **指令要点：**
        1. 创建 `scripts/enrich-vocab.ts`。
        2. 调用 DeepSeek API 清洗单词数据（场景标签、商务释义）。
        3. 实现 `calculatePriority` 核心打分逻辑 (Core/Support/Noise)。

- [ ] **Task 1.4: Database Seeding**
    * **目标：** 将清洗后的 JSON 数据写入数据库。
    * **指令要点：**
        1. 编写 `prisma/seed.ts`。
        2. 读取 JSON 并 upsert 到数据库。

- [ ] **Task 1.5: Vectorization Script**
    * **目标：** 为数据库中的单词生成 Embeddings。
    * **指令要点：**
        1. 创建 `scripts/vectorize-vocab.ts`。
        2. 调用 OpenAI `text-embedding-3-small`。
        3. 使用 `prisma.$executeRaw` 更新向量字段。

---

## 🟡 第二阶段: AI 内容引擎 (Content Engine)
> **目标：** 跑通“1+N”文章生成闭环。

- [x] **Task 2.1: Article Generation Service**
    * **目标：** 封装生成文章的核心业务逻辑。
    * **指令要点：** 实现 `generateDailyArticle` Action，包含选词逻辑、Prompt 拼接、DeepSeek 调用、结果入库。

- [ ] **Task 2.2: Reader UI Components**
    * **目标：** 搭建阅读器界面。
    * **指令要点：** 开发 `SmartText.tsx`，实现文本分词、高亮 Target/Context 单词、点击事件。

- [ ] **Task 2.3: Reader Page Integration**
    * **目标：** 组装页面。
    * **指令要点：** `/reader` 页面开发，串联 Action 和 UI。

---

## 🔵 第三阶段: 用户与记忆系统 (User & Memory)
> **目标：** 接入五维记忆模型和 SRS 算法。

- [ ] **Task 3.1: Auth Integration**
    * **目标：** 接入 Clerk 或 NextAuth。

- [ ] **Task 3.2: 5-Dim Update Logic**
    * **目标：** 实现五维分数更新。
    * **指令要点：** 实现 `recordInteraction`，根据阅读或做题结果更新 V/A/M/C/X 矩阵。

- [ ] **Task 3.3: SRS Scheduler**
    * **目标：** 实现间隔重复算法。
    * **指令要点：** 实现简版 SM-2 算法，计算 `dueDate`。

- [ ] **Task 3.4: Dashboard**
    * **目标：** 可视化展示。
    * **指令要点：** 使用 Recharts 绘制五维雷达图。

---

## 🟣 第四阶段: 打磨与优化 (Polish)

- [ ] **Task 4.1: Vocab Sheet UI** (完善单词详情底抽屉)
- [ ] **Task 4.2: Streaming Response** (文章生成流式输出)