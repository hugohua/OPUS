# UI 中文化术语规范

> **目的**：统一全站中文化翻译，确保各模块文案一致。

---

## 📋 核心术语表

### FSRS 状态术语

| 英文 | 中文 | 使用场景 | 备注 |
|------|------|----------|------|
| `MASTERED` / `Stable` | **已掌握** | 词汇状态、统计面板 | 长期记忆阶段 |
| `LEARNING` | **学习中** | 词汇状态、筛选标签 | 正在习得阶段 |
| `REVIEW` / `Due` | **待复习** | 词汇状态、筛选标签 | 需要复习的项 |
| `NEW` | **新词** | 词汇状态、筛选标签 | 未开始学习 |
| `LEECH` | **难点词** | 词汇状态、筛选标签 | 反复出错的词 |
| `Unseen` | **未学习** | 词汇列表 | 从未接触过 |

### 时间相关术语

| 英文 | 中文 | 使用场景 |
|------|------|----------|
| `Due Today` | **今日复习** | 词汇列表右侧 |
| `Not started` | **未开始** | 词汇列表右侧 |
| `Review: Xd` | **复习: X天** | 词汇列表右侧 |

### 操作相关术语

| 英文 | 中文 | 使用场景 |
|------|------|----------|
| `Start Session` | **开始训练** | 主页卡片 |
| `Pass` | **通过** | 训练结果 |
| `Missed` / `Fail` | **未通过** | 训练结果 |
| `Finish & Return` | **完成 & 返回** | 训练完成页 |
| `Back to Dashboard` | **返回主页** | 空状态页 |

### 导航相关术语

| 英文 | 中文 | 组件 |
|------|------|------|
| `Dashboard` | **主页** | FloatingDock |
| `Inventory` | **词库** | FloatingDock |
| `Briefing` | **简报** | FloatingDock |
| `Profile` | **我的** | FloatingDock |

### 训练模式术语

| 英文 | 中文 | 组件 |
|------|------|------|
| `Daily Blitz` | **每日闪电战** | DailyBlitzCard |
| `Speed Run` | **极速挑战** | SkillGym |
| `Audio Gym` | **听力训练** | SkillGym |
| `Context Lab` | **情境实验室** | SkillGym |
| `Phrase Deck` | **短语卡组** | FlashcardSection |
| `Audio Drive` | **听力驾驶** | FlashcardSection |
| `Memory Telemetry` | **记忆遥测** | FsrsHud |

### 筛选器术语

| 英文 | 中文 | 组件 |
|------|------|------|
| `All` | **全部** | VocabFilters |
| `Sort: Rank` | **排序: 排名** | VocabFilters |
| `Sort: Due` | **排序: 待复习** | VocabFilters |
| `AI Context` | **AI 情境** | VocabFilters |
| `Clear all filters` | **清除筛选** | VocabularyList |

### Weaver 模块术语

| 英文 | 中文 | 组件 | 备注 |
|------|------|------|------|
| `Weaver Archives` | **简报中心** | WeaverArchives | 历史简报列表页 |
| `Weaver Console` | **简报生成** | WeaverConsole | 简报生成控制台 |
| `New Briefing` | **新建简报** | WeaverArchives | 跳转至生成页 |
| `Generate` | **开始生成** | WeaverConsole | 触发 LLM 生成 |
| `Generating...` | **生成中...** | WeaverConsole | 生成加载状态 |
| `Generating Briefing...` | **生成简报中...** | ArticleReader | 流式加载状态 |
| `Filter` | **筛选** | WeaverArchives | 状态/语境筛选 |
| `New / Unread` | **新生成 / 未读** | WeaverArchives | 24h 内状态 |
| `Archived` | **已归档** | WeaverArchives | 超过 24h 状态 |
| `Context` | **语境** | WeaverArchives | 场景筛选维度 |

---

## ⚠️ 保留英文的术语

> 以下术语因技术性或品牌原因保留英文：

| 术语 | 原因 |
|------|------|
| `Opus` | 产品名称 |
| `FSRS` | 算法名称 |
| `SYNTAX` / `PHRASE` / `CONTEXT` | 训练模式 ID |
| `LLM` | 技术术语 |
| `TOEIC` | 考试名称 |
| `Level X` | 等级标识 |
| `S:Xd` | FSRS 稳定性参数 |

---

## 📄 相关文件清单

已应用此规范的文件：

### Dashboard 模块
- `components/dashboard/dashboard-header.tsx`
- `components/dashboard/daily-blitz-card.tsx`
- `components/dashboard/skill-gym.tsx`
- `components/dashboard/flashcard-section.tsx`
- `components/dashboard/fsrs-hud.tsx`
- `components/dashboard/floating-dock.tsx`
- `app/dashboard/simulate/page.tsx`

### Vocabulary 模块
- `components/vocabulary/vocabulary-list.tsx`
- `components/vocabulary/ui/vocab-hud.tsx`
- `components/vocabulary/ui/vocab-filters.tsx`
- `components/vocabulary/ui/vocab-list-item.tsx`
- `components/vocabulary/VocabularyCard.tsx`
- `components/vocabulary/detail/StickyHeader.tsx`

### Session 模块
- `components/session/blitz-session.tsx`

### Auth 模块
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`

### Admin 模块
- `app/admin/inspector/_components/*.tsx`
- `components/admin/*.tsx`

### Weaver 模块
- `components/weaver/WeaverArchives.tsx`
- `components/weaver/WeaverConsole.tsx`
- `components/weaver/ArticleReader.tsx`

---

## 🔄 更新历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-07 | v1.0 | 初始版本，建立核心术语表 |
| 2026-02-16 | v1.1 | 新增 Weaver 模块术语，"编织" → "简报" 全局替换 |
