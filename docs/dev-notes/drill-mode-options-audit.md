# Drill 模式全链路参考手册
> 日期：2026-03-08
> 状态：Standard (Verified)
> 关联修复：CONTEXT "No options available" Bug

## 1. 概述

Opus 共 8 种 Drill 模式，每条 Drill 经历 **生成 → 存储 → 消费 → 渲染** 4 个阶段。本文档是所有模式的权威参考。

## 2. 全链路对照表

| Mode | Level | Handler | Prompt 模板 | options 格式 | Renderer | Fallback |
|------|:---:|---------|-------------|:---:|----------|----------|
| **SYNTAX** | L0 | `basic-handler` | `l0/syntax.ts` | `string[]` | `SyntaxRenderer` | `buildPhraseFallbackDrill` |
| **BLITZ** | L0 | `basic-handler` | `l0/blitz.ts` | `RichOption[]` | `SyntaxRenderer` | `buildPhraseFallbackDrill` |
| **PHRASE** | L0 | `basic-handler` | `l0/phrase.ts` | `RichOption[]` | `SyntaxRenderer` | `buildPhraseFallbackDrill` |
| **AUDIO** | L1 | `audio-handler` | `l1/audio-script.ts` | N/A | `AudioRenderer` | ⚠️ 无 |
| **CHUNKING** | L1 | `basic-handler` | `l1/chunking.ts` | N/A (拖拽) | `ChunkingRenderer` | `buildChunkingDrillFallback` |
| **CONTEXT** | L2 | `context-handler` | `l2/context-script.ts` | `RichOption[]` | `ContextRenderer` | `buildPhraseFallbackDrill` |
| **NUANCE** | L2 | `basic-handler` | `l2/nuance.ts` | `RichOption[]` | `SyntaxRenderer` | `buildPhraseFallbackDrill` |
| **ARENA_PART5** | Arena | `part5-handler` | `arena/part5-drill.ts` | `seed.options` | `SyntaxRenderer` | DB seed 直转 |
| **ARENA_PART6** | Arena | `part6-handler` | `arena/part6-drill.ts` | `RichOption[]` (转换) | 专用 Part6 UI | `buildArenaPart6FallbackDrill` |

## 3. Options 格式规范 (V2 Standard)

> See also: `docs/dev-notes/prompt-structure-v2.md` §4.1

系统支持两种 options 格式，**UI 层必须兼容两种**：

### Format A: Rich Object（推荐）
```json
"options": [
  { "id": "A", "text": "approve",  "is_correct": true,  "type": "Correct" },
  { "id": "B", "text": "approval", "is_correct": false, "type": "POS_Trap" }
]
```
- **使用者**: BLITZ, PHRASE, NUANCE, CONTEXT, ARENA_PART6 的 Prompt 模板
- **优势**: 前端可埋点追踪错误类型 (Visual_Trap / POS_Trap / Semantic_Trap / Nuance_Trap)

### Format B: String Array（Legacy）
```json
"options": ["approval", "approved"]
```
- **使用者**: SYNTAX Prompt, `phrase-drill.ts` fallback, Quick Drill

### 消费端兼容模式（强制）
所有 Renderer / Card 组件必须实现：
```ts
const optText = typeof opt === 'string' ? opt : opt.text;
```
已实现此兼容的组件：
- ✅ `SyntaxRenderer` — 处理 SYNTAX / BLITZ / PHRASE / NUANCE / ARENA_PART5
- ✅ `ContextDrillCard` — 处理 CONTEXT
- ✅ `shuffleBriefingOptions()` — 全局 shuffle 中间层

## 4. 生成链路详解

### 4.1 LLM 生成路径 (Happy Path)

```
Prompt Template → AIService.generateObject() → BatchDrillOutputSchema → generatedDrills[]
```

**所有 Handler** 使用统一的 `BatchDrillOutputSchema`（`z.array(z.any())`）解析 LLM 输出。
> ⚠️ 该 Schema 不强制 segment 结构，依赖 Prompt 模板的约束力。

### 4.2 Pivot Fallback 路径 (Fail-Safe)

当 LLM 超时/解析失败时，各模式的降级策略：

| Mode | Fallback 函数 | 生成结果 |
|------|-------------|---------|
| SYNTAX / BLITZ / PHRASE / NUANCE / CONTEXT | `buildPhraseFallbackDrill()` | PHRASE 记忆卡 (`['Forgot','Blurry','Know']`) |
| CHUNKING | `buildChunkingDrillFallback()` | 确定性排序题 |
| ARENA_PART5 | DB `QuestionSeed` 直转 | `seed.options` 直接使用 |
| ARENA_PART6 | `buildArenaPart6FallbackDrill()` | 静态阅读题 |
| AUDIO | ⚠️ **无 fallback** | 异常上抛 |

### 4.3 消费路径 (get-next-drill.ts)

```
Redis Inventory →[cache hit]→ BriefingPayload →[shuffleBriefingOptions]→ 前端
                →[cache miss]→ Server 端即时生成 / Quick Drill fallback
```

## 5. Renderer 映射关系

```
SessionRunner
  ├── SYNTAX / BLITZ / PHRASE / NUANCE / ARENA_PART5 → SyntaxRenderer
  ├── AUDIO                                          → AudioRenderer
  ├── CHUNKING                                       → ChunkingRenderer
  ├── CONTEXT                                        → ContextRenderer → ContextDrillCard
  └── ARENA_PART6                                    → Part6 专用 UI
```

## 6. Prompt 模板要求

新增或修改 Prompt 时必须遵循：

1. **必须有完整的 `<response_template>`**，包含 `text` + `interaction` segment 的完整 JSON 示例
2. **`interaction` segment 必须包含 `task` wrapper**，内含 `style` / `question_markdown` / `options` / `answer_key`
3. **options 格式**：推荐 Rich Object，SYNTAX 等极简场景可用 string[]
4. **必须指定 `dimension`**：V (视觉) / C (起草) / M (决策) / X (逻辑) / A (听觉)
5. **LLM 输出为 JSON Array**（不加外层 wrapper），由 `safeParse` 自动封装为 `{ items: [...] }`

## 7. 已知技术债

| 项 | 优先级 | 描述 |
|:---|:---:|:---|
| `BatchDrillOutputSchema` 过于宽松 | P2 | `z.array(z.any())` 不做结构校验 |
| `audio-handler.ts` 无 Pivot fallback | P3 | LLM 失败时异常直接上抛 |
| PHRASE fallback 用于 L2 模式时语义不匹配 | P3 | CONTEXT/NUANCE 失败降级为 PHRASE 三按钮，体验断裂 |
