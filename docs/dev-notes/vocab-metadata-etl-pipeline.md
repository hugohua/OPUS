# 词汇元数据自动化补全工作流 (Vocab ETL Pipeline)

本文档定义了在导入新词汇到 `Vocab` 表后，如何通过一套标准化的 ETL (Extract, Transform, Load) 和大语言模型清洗脚本群，将仅包含拼写的“毛坯词汇”转化为带有翻译、读音、场景、词源等丰富上下文的“精装词汇”。

> **核心原则**：为了防止大语言模型因为单次处理信息过多而导致限流、超时或幻觉，Opus 的词汇清洗采用了**“分布式、多阶段”**的解耦策略。

---

## 1. 核心流程总览 (The Pipeline)

当你通过外部工具（如 Abceed JSON 提取或 TOEIC PDF 导入）向数据库写入了一批新词后，必须**严格按照以下顺序**执行这 4 个核心脚本：

```bash
# 步骤 1：核心骨架补全 (翻译、商业场景、易混词、优先级分级)
npx tsx scripts/data-etl-vocabulary-ai.ts --paid

# 步骤 2：读音双音标补全 (生成 UK/US 国际音标)
npx tsx scripts/data-fix-phonetics.ts --paid --continuous

# 步骤 3：词源与记忆钩子 (生成高级联想记忆法)
npx tsx scripts/data-gen-etymology.ts --paid --continuous

# 步骤 4：基于市场排名的频率分回填 (瞬间计算，无需 AI)（可选）
npx tsx scripts/data-backfill-frequency.ts

# 步骤 5：向量数据导入 (导入生成的 Embedding JSONL 文件)
npx tsx scripts/data-import-batch-embedding.ts output/7fc694c6-6b84-4a31-95f9-21452580b094_1771889899151_success.jsonl
```

> **参数说明 (`--paid`)**：加上该参数将解除 API 免费层的限流控制（改为 2s 间隔，高并发模式）。如果你使用的是免费的 Gemini Key，请移除 `--paid` 走缓慢休眠模式以免触发 HTTP 429 熔断。

---

## 2. 各脚本职责详解

### 2.1 主数据提取：`data-etl-vocabulary-ai.ts`
- **目标字段**：`definition_cn`, `definitions` (商业/通用结构化释义), `scenarios`, `collocations`, `priority`, `word_family`, `confusing_words`, `synonyms`。
- **工作原理**：
  检索数据库中 `definition_cn` 为 `null` 的半成品词条。利用大模型深度提纯商业语境场景和衍生词。自动剥离出 `is_toeic_core` 状态并计算 `learningPriority` 分数。
- **架构亮点**：内置智能 Circuit Breaker (熔断器)，能够自我感知 `429 Too Many Requests` 和 `503 Service Unavailable` 并进入**指数级冷却回退**机制。

### 2.2 英美音标补全：`data-fix-phonetics.ts`
- **目标字段**：`phoneticUk` (英式 IPA), `phoneticUs` (美式 IPA)。
- **工作原理**：
  检索音标为 `null` 的词条。强制 LLM 扮演 Determine JSON Engine，不解释、不说话，返回严格过滤斜杠的绝对方言音标（包含多音节重音符号 `ˈ`）。

### 2.3 词源与记忆钩子：`data-gen-etymology.ts`
- **目标字段**：写入关联数据表 `Etymology`。
- **工作原理**：
  这属于 Opus 的高级教学玩法。脚本基于大模型生成“记忆钩子”。优先级策略：衍生词(DERIVATIVE) > 词根拆解(ROOTS) > 谐音/联想记忆(ASSOCIATION)。

### 2.4 生存价值分计算：`data-backfill-frequency.ts`
- **目标字段**：`frequency_score` (0-100分，用于前端题库优先降维打击策略)。
- **工作原理**：
  纯 SQL 算法。当单词来源于外部丛书（带有 `abceed_rank` 时），利用倒数排名逻辑一键映射成 100 分制价值分。如果是纯 Core 词则保底 40 分，冷门词 10 分。

### 2.5 CEFR 欧洲语言标准等级回填定制脚本：`data-backfill-cefr.ts`
- **目标字段**：`cefrLevel` (例如 A1, A2, B2, C1)。
- **工作原理**：专门用于对未拥有原生牛津词典 CEFR 标志的新外部丛书词汇进行一键打标。例如针对“银のフレーズ”批量标 A2，针对“黒のフレーズ”批量标 C1。
- **使用方式**：`npx tsx scripts/data-backfill-cefr.ts`

### 2.6 向量数据导入：`data-import-batch-embedding.ts`
- **目标字段**：`embedding` (pgvector 向量数据，用于语义搜索和相似度匹配)。
- **工作原理**：读取由 OpenAI Batch API 等生成的包含 embedding 数据的 `.jsonl` 结果文件，并将其批量解析、提取向量并更新到数据库中对应词条的记录里。
- **使用方式**：`npx tsx scripts/data-import-batch-embedding.ts <jsonl_file_path>`

---

## 3. 监控与维护

这些脚本全部被整合在 `lib/etl/batch-runner.ts` 之下，享有统一的日志监控接口。
如果你想检查数据库中的“留白率”（即有多少词汇还没被清洗干净），你可以随时在任意脚本后加上 `--check` 参数。例如：

```bash
npx tsx scripts/data-fix-phonetics.ts --check
```
系统会立即打印出当前处于 pending 状态的单词总数（而不消耗 API Token）。
