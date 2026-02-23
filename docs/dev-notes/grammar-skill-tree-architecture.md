# Grammar Skill Tree 架构与产品白皮书

## 1. 设计哲学 (The Philosophy)
Grammar Skill Tree 是 Opus 诊断引擎的最后一块拼图，它将原本隐式的语法感具象化为一棵可量化、可追踪的三层技能树，作为从词汇堆砌层跃迁到商业流利层的桥梁。

## 2. 三层模型 (L1-L3 Ontology)
技能树严格遵循领域分解模型：
- **L1 Domain (领域层)**：例如 `Verbs & Tenses` (动词与时态), `Sentence Structure` (句子结构)。共计 5 个宏观维度，用于前台雷达图大盘展示。
- **L2 Category (类别层)**：例如 `Present Tenses` (现在时), `Clauses` (从句)。作为结构分组。
- **L3 Knot (知识结/考点)**：例如 `Present Perfect (have/has + V-ed)` (现在完成时)。**这是 BKT 算法追踪的最小知识颗粒度，也是题目挂靠的锚点。**

## 3. 数据隔离与持久化 (Prisma Schema)
### 3.1 `GrammarNode` 模型
- 定义了完整的自引用树状结构 (`parentId` 关联)。
- 字段：`id`, `name`, `level`, `description`。
- **一致性保护**：删除父节点时采取 `Restrict` 策略，防止级联删除导致底层试题成为孤儿。

### 3.2 锚点挂载 (`QuestionSeed`)
- 现有的 OMPS 词库 (`Vocab`) 是词汇维度的锚点。
- 在 `QuestionSeed` 模型中新增 `grammarNodeId`，让试题具备了**双重锚点**（既能考察单词，也能考察语法）。
- 本次重构中，通过 LLM 后台脚本完成了 1200+ 存量题目的无损打标。

### 3.3 `UserGrammarProficiency` 模型
- 记录单个用户针对单个 L3 知识点的掌握分 (`masteryScore`: 0.0 - 1.0)。
- 记录暴露次数、正确/错误次数、最近复习时间。
