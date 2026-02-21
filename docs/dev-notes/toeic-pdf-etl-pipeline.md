# TOEIC PDF ETL Pipeline — 技术文档

## 概述

本文档记录将 TOEIC 真题书籍（扫描 PDF）转换为 `QuestionSeed` 数据库记录的完整 ETL 流水线。

---

## 架构图

```
[扫描 PDF]
    ↓
[ocr_pdf_to_text.py]   ← Python + PyMuPDF + OpenAI Vision API
    ↓
[books/ocr_pages/page_001.txt ... page_457.txt]   ← 每页独立文件
    ↓
[seed-from-pdf.ts]     ← TypeScript + Gemini ETL + Zod 校验
    ↓
[QuestionSeed 数据库表]
```

---

## 第一阶段：OCR 文本提取

### 脚本
`scripts/ocr_pdf_to_text.py`

### 运行
```bash
# 处理全部页
python scripts/ocr_pdf_to_text.py

# 合并所有页为单文件（可选）
python scripts/ocr_pdf_to_text.py --merge

# 重试失败页
python scripts/ocr_pdf_to_text.py --retry
```

### 输出目录
```
books/
├── ocr_pages/
│   ├── page_001.txt
│   ├── page_002.txt
│   └── ...page_457.txt
└── toeic_full_ocr.txt   ← 合并后（可选）
```

### 核心设计
- **每页独立文件**：方便断点续传，已完成的页直接跳过
- **并发控制**：`asyncio.Semaphore(workers)` 默认 5 个并发
- **失败重试**：`--retry` 模式读取 `books/failed_pages.log` 重跑

### 环境变量
```env
ETL_API_KEY=...         # OpenAI-compatible Vision API Key
ETL_BASE_URL=http://127.0.0.1:8045/v1
ETL_MODEL_NAME=gemini-3-flash
```

---

## 第二阶段：结构化提取与入库

### 脚本
`scripts/seed-from-pdf.ts`

### 运行
```bash
# 默认并发数 3
npx tsx scripts/seed-from-pdf.ts

# 调高并发（付费 API 适用）
ETL_CONCURRENCY=5 npx tsx scripts/seed-from-pdf.ts
```

### 核心逻辑

#### 并发 Worker Pool
```typescript
// 不依赖 p-limit（ESM 兼容问题），使用原生 Worker Pool
const workers = Array.from({ length: CONCURRENCY }).map(() => worker());
await Promise.all(workers);
```

每个 Worker 争抢共享的 `chunks[]` 队列，每个 Chunk = 3 个 OCR 页面。

#### 启发式跳过
```typescript
// 没有 (A) 或 1xx. 数字 → 跳过，节省 LLM Token
if (!chunkText.includes('(A)') && !/1[0-4]\d\./.test(chunkText)) skip;
```

#### 重试与退避
- 每个 Chunk 最多重试 3 次
- 429 限流 → 等待 30s
- 其他错误 → 指数退避（5s × attempt）

#### 去重防护
```typescript
// 以 sentence 字段为唯一键
const existing = await prisma.questionSeed.findFirst({ where: { sentence: q.sentence } });
if (existing) return;
```

---

## ETL Prompt 设计

### 文件
`lib/generators/etl/part5-seed-prompt.ts`

### 格式
**XML-Mode Prompt**（v4）：XML 标签为 Gemini 提供无歧义语义边界，显著提升 Enum 遵循率。

### 核心标签结构
```xml
<role>      ← 限定角色：严格校验引擎，非创作助手
<task>      ← 明确任务
<extraction_rules>   ← 7 条提取规则（含 OCR 修复示例）
<enum_constraints>   ← 白名单 + 黑名单 + 决策树
<self_check>         ← 输出前强制 9 项自检
<output_format>      ← 含 Few-Shot 示例
```

---

## QuestionType 枚举（完整版）

| 值 | 描述 | 真题示例 |
|---|---|---|
| `MORPHOLOGY` | 词性辨析，同一词根 | predict / prediction / predictive / predictably |
| `COLLOCATION` | 固定搭配/介词 | comply WITH / result IN |
| `GRAMMAR` | 纯语法 | Although / However / will / has been |
| `SYNONYM` | 词义辨析，不同单词 | evaluate / assess / examine / inspect |
| `PHRASAL_VERB` | 动词短语辨析 | turn down / turn out / turn over / turn into |
| `PRONOUN_REFERENCE` | 代词指代（Part 6 专属，需 passageContext） | it / they / themselves / one |

---

## QuestionSeed 数据模型关键字段

```prisma
model QuestionSeed {
  originalNumber  String?          // 原始题号，如 "101"
  sentence        String           // 含 _______ 的题干
  targetAnswer    String           // 正确答案
  options         Json             // [{text, isCorrect}] × 4
  rationale       String?          // 中文解析（可能为空，待后置补全）
  anchorText      String?          // 核心词汇（纯语法题为 null）
  anchorVocabId   Int?             // 关联 Vocab 表（自动匹配）
  questionType    QuestionType     // 见上表
  posTested       String?          // 词性（Noun/Verb/...）
  part            Int default(5)   // 题目 Part（5/6/7）
  passageContext  String?          // Part 6 专属：代词指代题的上文
  source          String?          // 来源，如 toeic_pdf_page_007
}
```

---

## 数据质量保障

### 三层防线

| 层次 | 机制 |
|---|---|
| LLM 层 | XML Prompt + 自检步骤 + 决策树 |
| Zod 层 | `.refine()` 校验下划线/选项数/答案匹配 |
| DB 层 | 去重检查 + 来源标记便于查询 |

### 质检 SQL
```sql
-- 发现非法 questionType
SELECT id, "questionType", sentence FROM "QuestionSeed"
WHERE "questionType" NOT IN ('MORPHOLOGY','COLLOCATION','GRAMMAR','SYNONYM','PHRASAL_VERB','PRONOUN_REFERENCE');

-- 空 rationale 统计
SELECT COUNT(*) FROM "QuestionSeed" WHERE rationale = '' OR rationale IS NULL;

-- anchorText 有但未命中词库
SELECT id, "anchorText" FROM "QuestionSeed"
WHERE "anchorText" IS NOT NULL AND "anchorVocabId" IS NULL;
```

### 后置 rationale 补全
```bash
npx tsx scripts/fill-empty-rationale.ts   # 待开发
```

---

## 并发配置参考

| 场景 | ETL_CONCURRENCY 建议 |
|---|---|
| 本地代理（免费额度） | 2–3 |
| 付费 API（高 RPM） | 5–8 |
| 测试阶段 | 1 |
