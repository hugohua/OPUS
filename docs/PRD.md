# 产品需求文档 (PRD)
**项目名称:** Opus (原名 Masterpiece - AI 托业商务阅读器)
**版本:** 1.0 (MVP)
**状态:** 已批准

## 1. 产品概述
**Opus** 是一款专为 TOEIC (托业) 备考者 (目标 800+分) 设计的 **AI 驱动情境化阅读应用**。
- **核心价值:** "1+N" 内容引擎。通过 AI 生成商务短文，将 1 个新词与 N 个旧词镶嵌在真实语境中学习，拒绝死记硬背。
- **差异化:** 五维认知模型 (V/A/M/C/X)。精准定位“看得懂但听不懂”或“认识但不会用”的短板，提供针对性训练。

## 2. 核心功能 (MVP)
### 2.1 词汇基建 (P0)
- **数据源:** Oxford 5000 + TOEIC 核心 600 词。
- **靶心分层策略 (Bullseye):**
  - **P0 (核心区):** 带有商务标签 + 难度 > A2。
  - **P1 (支撑区):** 无标签 + 难度 B2/C1 (通用学术词)。
  - **P2 (噪音区):** A1/A2 简单词 (仅作语料填充)。
- **必填字段:** `scenarios` (场景枚举), `learningPriority` (权重), `definitions` (区分商务/通用释义)。

### 2.2 "1+N" AI 内容引擎 (P0)
- **逻辑:** 输入 1 个目标新词 (Target) + 3-5 个复习词 (Context)。
- **约束:** 复习词必须与目标词共享同一个 `scenario` 标签 (如都是 'Finance')，确保文章逻辑自洽。
- **输出:** JSON 格式，包含标题、正文(分段)、中文摘要。

### 2.3 智能阅读器 UI (P0)
- **交互:** 单词可点击 (Tokenized)。目标词高亮显示。
- **反馈:** 点击单词 -> 底部弹出详情页 -> 触发 `recordInteraction` (记录案发现场句子) & 更新 'V' (形) 维度分值。
- **风格:** 极简主义，强制深色模式 (Dark Mode)。

### 2.4 五维记忆系统 (P1)
- **五维矩阵:** 形(Visual), 音(Audio), 义(Meaning), 搭(Collocation), 境(Context)。
- **SRS 算法:** 改良版 SM-2 间隔重复算法。
- **动态闪卡:** 根据矩阵最低分动态决定卡片类型 (例: 音维低 -> 纯音频盲听卡)。

## 3. 数据字典
- **场景枚举 (Scenarios):** [recruitment, personnel, management, office_admin, finance, investment, tax_accounting, legal, logistics, manufacturing, procurement, quality_control, marketing, sales, customer_service, negotiation, business_travel, dining_events, technology, real_estate]
- **优先级 (Priority):** 100 (核心), 60 (支撑), 0 (噪音/不学).