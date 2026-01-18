# 技术设计文档 (TDD)
**技术栈:** Next.js 14, Postgres (pgvector), Prisma, Tailwind, DeepSeek API.

## 1. 架构原则
- **垂直切片 (Vertical Slices):** 按功能开发 (DB -> Action -> UI)，禁止水平分层开发。
- **Server Actions:** 所有业务逻辑必须驻留在 `app/actions`。
- **校验:** 所有输入必须使用 Zod 进行校验。

## 2. 数据库 Schema (核心)
```prisma
model Vocab {
  id               Int      @id @default(autoincrement())
  word             String   @unique
  scenarios        String[] // 场景标签枚举
  definitions      Json     // [{type: 'business', ...}]
  collocations     String[]
  cefrLevel        String?  // A1 - C2
  
  // 策略字段
  learningPriority Int      @default(0) // 100(Core), 60(Support), 0(Noise)
  
  // 向量字段 (需要 Prisma 原生 SQL 支持，此处为逻辑定义，实际迁移时需使用 Unsupported)
  // embedding Unsupported("vector(1536)")?

  // 关联
  progress         UserProgress[]
  articles         ArticleVocab[]

  @@index([learningPriority])
  @@index([scenarios])
}

model UserProgress {
  id        String   @id @default(cuid())
  userId    String
  vocabId   Int
  
  // SRS 调度
  status    LearningStatus @default(NEW) // NEW, LEARNING, REVIEW, MASTERED
  interval  Int            @default(0)   // 天数
  easeFactor Float         @default(2.5)
  dueDate   DateTime       @default(now())
  
  // 🔥 五维矩阵 (V/A/M/C/X)
  // { "V": 80, "A": 20, "M": 90, "C": 40, "X": 60 }
  masteryMatrix Json       @default("{}")

  // 语境锚点 (记录上次阅读遇到的句子)
  lastContextSentence String? @db.Text

  user      User     @relation(fields: [userId], references: [id])
  vocab     Vocab    @relation(fields: [vocabId], references: [id])

  @@unique([userId, vocabId])
  @@index([userId, dueDate])
}

model Article {
  id          String   @id @default(cuid())
  userId      String
  title       String
  body        Json     // 存储段落结构，方便前端 token 化渲染
  summaryZh   String?
  createdAt   DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id])
  vocabs      ArticleVocab[]
}

model ArticleVocab {
  articleId String
  vocabId   Int
  role      VocabRole // TARGET(新词), CONTEXT(复习词)

  article   Article @relation(fields: [articleId], references: [id])
  vocab     Vocab   @relation(fields: [vocabId], references: [id])

  @@id([articleId, vocabId])
}

enum LearningStatus {
  NEW, LEARNING, REVIEW, MASTERED
}

enum VocabRole {
  TARGET, CONTEXT
}
```

## 3. 核心算法逻辑

### 3.1 "1+N" 内容生成引擎

1. **选词 (Selection):**
* **Target (1):** 从 `UserProgress` 选 `status='NEW'` 且优先级最高的词 (如 `audit`, 标签 `finance`)。
* **Context (N):** 选 `status='LEARNING'` 且 `scenarios` 包含 `finance` 的词。


2. **Prompt 生成:** 动态拼接 System Prompt。
3. **调用与解析:** 调用 DeepSeek 生成 JSON，解析并存入 `Article` 和 `ArticleVocab`。

### 3.2 五维记忆更新算法 (5-Dim Updater)

封装在 `recordInteraction` Server Action 中：

* **触发点:**
* **阅读完成:** `V` (Visual) +5, `X` (Context) +10。
* **听力卡片正确:** `A` (Audio) +20。
* **填空正确:** `C` (Collocation) +20。


* **公式:** `Score = min(100, max(0, Score + Delta))`。

## 4. API 设计 (Server Actions)

所有文件位于 `app/actions/` 目录。

### 4.1 `vocab.ts` (单词管理)

* `getVocabStats(userId)`: 获取五维雷达图数据。
* `toggleBookmark(vocabId)`: 手动加入生词本。

### 4.2 `article.ts` (核心业务)

* `generateDailyArticle()`: **(核心)** 触发 1+N 生成。
* *Validation:* 无参数（从 Session 取 userId）。
* *Return:* `{ success: boolean, article: ArticleData }`。


* `recordReadingInteraction(articleId, vocabId)`: 用户点击了生词，记录语境锚点。

### 4.3 `study.ts` (复习系统)

* `getFlashcardQueue()`: 获取今日复习队列。
* `submitCardReview(cardId, grade, dimension)`: 提交复习结果，更新 SRS 和矩阵。

## 5. 前端架构

### 5.1 目录结构

```bash
app/
  (auth)/         # 登录注册
  dashboard/      # 主控台 (雷达图)
  reader/         # 阅读器页面
    [id]/page.tsx # 具体文章页
  practice/       # 闪卡复习页
components/
  ui/             # Shadcn 基础组件 (Button, Card...)
  features/
    reader/
      SmartText.tsx    # 负责文本分词、高亮、点击交互
      VocabSheet.tsx   # 底部弹出的单词详情
    dashboard/
      RadarChart.tsx   # Recharts 五维图
    flashcard/
      AudioCard.tsx    # 盲听卡
```

## 6. AI 工程化 (Prompt Engineering)

### 6.1 生成 Prompt 模板

```text
You are a Business English expert.
Generate a JSON article based on these constraints:

Target Word: {target} (Highlight Logic: **{target}**)
Context Words: {context_list}
Scenario: {scenario}
Level: CEFR B2

Output JSON strictly:
{
  "title": "Business style title",
  "body": [
    "Paragraph 1...",
    "Paragraph 2..."
  ],
  "summary_zh": "One sentence summary"
}
```

## 7. 安全与性能

### 7.1 安全

* **Zod Validation:** 所有 Action 入参必须校验。
* **Rate Limiting:** 限制 `generateDailyArticle` 调用频率（如每人每天 5 次），防止 LLM 费用爆炸。

### 7.2 性能

* **Vector Search:** 为 `Vocab` 表的 `embedding` 字段建立 HNSW 索引。
* **Streaming:** 文章生成采用 `useAI` (Vercel AI SDK) 进行流式输出，提升首屏感知。