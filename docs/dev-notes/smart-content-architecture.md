# SmartContent 架构文档

> AI 生成内容的缓存与复用系统

## 概述

SmartContent 是 Opus 的 **AI 内容资产库**，用于存储 LLM 生成的可复用内容（L2 例句、L0 搭配扩展等）。它将 AI 生成的"静态资源"与词汇绑定，实现 **一次生成、多次复用**。

## 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Word Detail Page                         │
│                      (Frontend)                             │
└───────────────────────────┬─────────────────────────────────┘
                            │ getOrGenerateL2Context()
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               content-generator.ts                          │
│                  (Server Action)                            │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │ Cache Check │ ──▶ │ LLM Batch   │ ──▶ │ DB Write    │   │
│  │  (DB Join)  │     │ (6 scenes)  │     │ ($transaction)│  │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ async triggerTTSGeneration()
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Python TTS Service                       │
│                      (Audio Only)                           │
└─────────────────────────────────────────────────────────────┘
```

## 数据模型

### SmartContent (Prisma)

```prisma
model SmartContent {
  id        String   @id @default(uuid())
  vocabId   Int
  vocab     Vocab    @relation(fields: [vocabId], references: [id])
  
  type      String   // "L2_SENTENCE" | "L0_COLLOCATION"
  scenario  String   // "Email", "Meeting", "Report", "HR", "Finance", "Logistics"
  
  payload   Json     // { text, translation, scenario }
  ttsHash   String?  // 关联 TTSCache.id
  model     String?  // "qwen-plus"
  createdAt DateTime @default(now())

  @@index([vocabId, type])
}
```

## 批量预生成策略

### System Prompt (静态)
- 定义角色：TOEIC 内容写手
- 约束：15-25 词、商务现实性、S-V-O 结构
- 场景列表：Email, Meeting, Report, HR, Finance, Logistics

### User Prompt (动态)
- 注入目标单词和释义
- 要求一次生成 6 个场景的句子

### Token 节省
| 场景 | 旧方案 | 新方案 |
|:---|:---|:---|
| 首次访问 | 1 次 LLM | 1 次 LLM (6 句) |
| 切换场景 | 1 次 LLM | 0 次 LLM (从缓存) |
| 刷新页面 | 0 次 LLM | 0 次 LLM |

## 关键文件

| 文件 | 用途 |
|:---|:---|
| `lib/generators/l2/smart-content.ts` | Prompt 定义 + Zod Schema |
| `actions/content-generator.ts` | Server Action (LLM + DB + TTS) |
| `components/vocabulary/detail/ContextSnapshot.tsx` | 前端组件 |

## 使用场景

1. **Word Detail Page**: 展示 L2 语境例句
2. **Switch Scenario**: 从缓存轮换场景 (零 LLM 成本)
3. **TTS Playback**: 异步生成音频，前端轮询获取 URL

## 降级策略

当 LLM 生成失败时，使用 `getDeterministicL2Batch()` 返回规则生成的兜底内容，确保用户不会看到空白页面。
