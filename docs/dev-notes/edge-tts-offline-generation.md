# Edge-TTS 离线批量语音生成指南

## 📌 文档信息

| 属性 | 内容 |
|------|------|
| **功能** | 离线批量预生成 TTS 音频，替代实时 Aliyun 调用 |
| **版本** | v1.0 |
| **技术栈** | Python `edge-tts` + `psycopg2` + `tenacity` |
| **创建时间** | 2026-02-25 |

---

## 1. 功能定位

### 1.1 核心目标
利用微软免费的 Edge-TTS 引擎，**离线批量预生成**所有需要的英语发音音频，写入 `TTSCache` 数据库表，使前端冷启动时即可命中缓存，无需实时调用 Aliyun API。

### 1.2 与现有 TTS 架构的关系
```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Frontend    │────▶│ Next.js API      │────▶│ Python TTS Svc   │
│  useTTS()    │     │ getTTSAudioCore  │     │ (Aliyun 实时)     │
│              │     │ ┌──────────────┐ │     └──────────────────┘
│              │     │ │ TTSCache DB  │ │
│              │     │ │ findUnique() │◀├──── 离线脚本预写入的记录
│              │     │ └──────────────┘ │     ┌──────────────────┐
│              │     └──────────────────┘     │ batch_edge_tts   │
│              │                              │ (Edge-TTS 离线)   │
│              │                              └──────────────────┘
└──────────────┘
```

**关键原理**: 前端和后端使用同一套 MD5 Hash 算法 (`text_voice_language_speed`)。离线脚本提前生成 `.wav` 文件并将记录 UPSERT 到 `TTSCache`，Next.js 层的 `findUnique(hash)` 会立即命中，**完全透明，前端零改动**。

---

## 2. 两步工作流

### Step 1: 提取待生成目标

```bash
# 从 Vocab / SmartContent / QuestionSeed 三张表中提取所有缺失音频的英文文本
npx tsx scripts/export-tts-targets.ts
```

**输出**: `output/tts_targets.json` (去重后的待生成列表)

**逻辑**:
1. 预加载 `TTSCache` 所有已有 Hash (O(1) 查询)
2. 扫描 `Vocab.word` + `Vocab.collocations[].text`
3. 扫描 `SmartContent.payload.text` (L2_SENTENCE / L0_COLLOCATION)
4. 扫描 `QuestionSeed.sentence` + `QuestionSeed.options[].text`
5. 对比已有缓存，只导出缺失项

### Step 2: 批量生成音频

```bash
cd python_tts_service
source venv/bin/activate
python batch_edge_tts.py --file "../output/tts_targets.json" --lang "en-US" --concurrency 3
```

**特性**:
- 📁 音频文件输出到 `public/audio/` 目录
- 🗄️ 自动 UPSERT 写入 `TTSCache` 表 (`source='edge-tts'`)
- 🔄 天然断点续传 (基于文件 `os.path.exists` 检查)
- 🛡️ `tenacity` 指数退避重试 (2s → 4s → 8s → 16s，最多 4 次)
- 📊 日志同时输出到控制台和 `logs/edge_tts_batch_*.log`

---

## 3. 脚本参数

### batch_edge_tts.py

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--text` | 单条文本生成 | - |
| `--file` | 批量输入文件 (JSON/CSV/TXT) | - |
| `--col` | JSON 中文本字段名 | `text` |
| `--voice` | 阿里云声音标识 (自动映射 Edge 声音) | `Cherry` |
| `--lang` | 语言 | `en-US` |
| `--speed` | 语速 | `1.0` |
| `--output` | 输出目录 | `../public/audio` |
| `--concurrency` | 并发数 | `3` |

### 声音映射表

| Opus Voice (Aliyun) | Edge-TTS Voice | 语言 |
|---------------------|----------------|------|
| Cherry (en-US) | en-US-AriaNeural | 英语 (美) |
| - (en-GB) | en-GB-SoniaNeural | 英语 (英) |
| - (zh-CN) | zh-CN-XiaoxiaoNeural | 中文 |

---

## 4. 断点续传机制

脚本支持**天然断点续传**，中断后重跑不会重复生成：

1. **文件层**: `os.path.exists(hash.wav)` → 跳过已生成文件
2. **数据库层**: `ON CONFLICT DO UPDATE` → 防止重复写入
3. **导出层**: `export-tts-targets.ts` 对比 `TTSCache` → 只导出缺失项

---

## 5. 依赖安装

```bash
cd python_tts_service
source venv/bin/activate
pip install edge-tts tenacity psycopg2-binary python-dotenv
```

---

## 6. 相关文件

| 文件 | 用途 |
|------|------|
| `python_tts_service/batch_edge_tts.py` | 离线批量生成脚本 |
| `scripts/export-tts-targets.ts` | 目标提取脚本 |
| `lib/tts/hash.ts` | 前端 Hash 算法 (Source of Truth) |
| `lib/tts/service.ts` | Next.js TTS 核心逻辑 (Cache-First) |
| `prisma/schema.prisma` → `TTSCache` | 缓存表 (含 `source` 字段) |

---

## 7. 注意事项

> [!CAUTION]
> Hash 算法必须与前端 `lib/tts/hash.ts` **完全一致**。
> Python 侧 speed 格式化使用 `f"{speed:.1f}"` 对齐前端的 `speed.toFixed(1)`。
> **不要**在 Hash 计算前清洗文本，否则前端永远 Miss 缓存。

> [!TIP]
> `concurrency 3` 是安全阈值。过高会触发微软 IP 限制。
> 被限制后 `tenacity` 会自动指数退避重试。
