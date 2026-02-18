# Weaver Lab & Magic Wand UI 规范

> **设计风格**: Zinc Glassmorphism + Linear 质感  
> **版本**: 2.0  
> **最后更新**: 2026-02-16  
> **UI 规范**: 遵循 `docs/ui-rules.md` (Opus v1.6 Design System)

---

## 1. PRD 功能映射

| PRD ID | 功能点 | UI 组件 | 状态 |
|--------|--------|---------|------|
| **WL-01** | Priority Queue (Due) | `RawMaterials.tsx` (Top 3 + Dialog) | ✅ v2.1 |
| **WL-02** | Scenario 选择 | `ContextSelector.tsx` (卡片网格) | ✅ v2.1 |
| **WL-03** | Density 控制 | `DensitySelector.tsx` (三挡选择器) | ✅ v2.1 |
| **WL-04** | 流式生成 | "WEAVE (V2.0)" 按钮触发 | ✅ v2.1 |
| **WL-05** | 目标词高亮 | `ArticleReader` 下划线样式 | ✅ v2.0 |
| **WL-06** | 文本选择工具栏 | `FloatingToolbar.tsx` | ✅ v2.0 |
| **MW-01** | Bottom Sheet | `MagicWandSheet.tsx` 弹窗 | ✅ v2.0 |
| **MW-02** | Local DNA (Cache-First) | 实线边框，0ms 标签 | ✅ v2.0 |
| **MW-03** | AI Context (Fallback) | 虚线边框，呼吸点动画 | ✅ v2.0 |

---

## 2. 组件架构 (v2.1 Refactored)

```
components/weaver/
├── WeaverConsole.tsx          ← Orchestrator (状态管理 + 编排)
├── console/
│   ├── RawMaterials.tsx       ← 词汇展示 (Top 3 + Dialog 全量)
│   ├── ContextSelector.tsx    ← 场景选择卡片 (Config-Driven)
│   └── DensitySelector.tsx    ← 篇幅控制 (Light/Balanced/Dense)
├── ArticleReader.tsx          ← 流式阅读器 (沉浸 UI)
└── FloatingToolbar.tsx        ← 文本选择工具栏

components/wand/
├── MagicWandSheet.tsx         ← Bottom Sheet (Shadcn Dialog)
└── WandContent.tsx            ← Wand 内容层

hooks/
├── use-sse-stream.ts          ← SSE 流式 Hook
└── use-text-selection.ts      ← 文本选择 Hook

config/
└── weaver-scenarios.ts        ← 场景 UI 配置 (icon/label/colorClass)

lib/constants/
├── weaver-scenario-map.ts     ← 场景 → DB 标签映射
└── weaver-density.ts          ← Density 枚举 + UI config
```

---

## 3. 设计 Token

> **规范**: 遵循 `docs/ui-rules.md` Zinc 色系 + Brand Violet

### Surface & Borders

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| Background | `bg-zinc-50` | `bg-zinc-950` + Ambient Glow |
| Surface | `bg-white` | `bg-zinc-900/60 backdrop-blur-xl` |
| Card | `bg-white border-zinc-200 shadow-sm` | Glassmorphism + `border-white/15` |
| Border | `border-zinc-200` | `border-white/5` |

### Ambient Glow (Dark Mode 必选)

```html
<div class="fixed top-0 left-0 w-full h-[600px]
  bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]
  from-violet-900/20 via-transparent to-transparent
  pointer-events-none hidden dark:block">
</div>
```

### Brand & Interactive

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| Brand Core | `violet-600` | `violet-500` | 按钮、Active 状态 |
| Selection | `selection:bg-violet-100` | `selection:bg-violet-900` | 文字选中 |
| Highlight | `text-violet-600` | `text-violet-400` | 交互元素 |

---

## 4. 核心组件规范

### 4.1 WeaverConsole (Orchestrator)

**路径**: `components/weaver/WeaverConsole.tsx`

**职责**: 
- 状态管理 (priorityWords, fillerWords, scenario, density)
- useSession 认证
- loadIngredients Server Action 调用
- handleWeave 触发 SSE

**不做**: 
- UI 渲染细节（委托给子组件）

### 4.2 RawMaterials

**路径**: `components/weaver/console/RawMaterials.tsx`

**Props**: `{ isLoading, error, priorityWords, fillerWords, onRefresh }`

**UI 特性**:
- SVG 图标标题 + "Raw Materials" + 刷新按钮
- **Top 3 展示**: 只显示前 3 个 Priority Word chips
  - 每个 chip: `font-mono text-xs` + source 状态点
  - 状态点颜色: `due_matched` → emerald, `new_matched` → blue, `due_fallback` → amber
- **"+N more"按钮**: 触发 Dialog 显示全量词汇
- **Dialog 内容**: Priority 区 + Filler 区，分组展示
- **Loading**: Skeleton shimmer
- **Error**: 错误信息 + 重试
- **Free Reading**: 无候选词时显示自由阅读提示

### 4.3 ContextSelector

**路径**: `components/weaver/console/ContextSelector.tsx`

**Props**: `{ selectedScenario, onSelect, disabled }`

**数据源**: `config/weaver-scenarios.ts` → `WEAVER_SCENARIO_CONFIGS`

**UI 特性**:
- Config-Driven 卡片渲染 (不硬编码)
- 2 列网格布局
- 每张卡片: icon + label + description
- 选中态: `border-violet-500 bg-violet-50 dark:bg-violet-950/20`
- Lucide 图标映射: key → icon component

### 4.4 DensitySelector

**路径**: `components/weaver/console/DensitySelector.tsx`

**Props**: `{ selectedDensity, onSelect, disabled }`

**数据源**: `lib/constants/weaver-density.ts` → `WEAVER_DENSITY_CONFIGS`

**UI 特性**:
- 三挡横排按钮: Light / Balanced / Dense
- 每项: icon + label + desc
- 选中态: 与 ContextSelector 一致

### 4.5 ArticleReader

**路径**: `components/weaver/ArticleReader.tsx`

**UI 特性**:
- ✅ RAF-buffered 流式打字机效果 (防抖动)
- ✅ 目标词高亮 (Violet 下划线)
- ✅ 点击目标词 → FloatingToolbar → MagicWand
- ✅ 错误状态 UI + 重试按钮
- ✅ 沉浸式加载态 (旋转 Visualizer, Step Loader)
- ✅ Empty State

### 4.6 FloatingToolbar

**路径**: `components/weaver/FloatingToolbar.tsx`

| 触发 | 工具栏选项 |
|------|-----------|
| 单词点击 | ⚡ Analyze · 🔊 Play · 📄 Copy |
| 句子划选 | 💡 Syntax · 🔊 Read · 📄 Copy |

### 4.7 MagicWandSheet

**路径**: `components/wand/MagicWandSheet.tsx`

**分层结构**:
- **Header**: 单词 + 音标 (Serif 大字) + TTS 按钮
- **Layer 1 - Source Code**: 词根拆解 (实线边框)
- **Layer 2 - Context Insight**: Collocation / Tone & Nuance (虚线边框 + 呼吸动画)
- 全暗模式适配

---

## 5. 图标库

| 库 | 用途 | 规范 |
|----|------|------|
| **Lucide React** | 全站图标 | `stroke-width={1.5}` (Thin) |
| **Shadcn UI** | Dialog, Sheet, Button | Radix 无障碍基础组件 |

### 场景图标映射

| 场景 | 图标 | 色调 |
|------|------|------|
| finance | `TrendingUp` | `text-emerald-500` |
| hr | `Users` | `text-blue-500` |
| marketing | `Megaphone` | `text-orange-500` |
| operations | `Settings` | `text-slate-500` |
| office | `Building2` | `text-violet-500` |
| tech | `Code` | `text-indigo-500` |

---

## 6. 交互规范

### 移动优先

- 所有交互元素: `min-h-[44px]` 触摸目标
- 主按钮 (WEAVE): 固定底部 `sticky bottom-0`, `rounded-full`, 带 shadow

### 状态流转

```
Console (选词/配置)
  ↓ WEAVE 按钮
Loading (沉浸式 Visualizer)
  ↓ 流式完成
Reader (阅读 + 高亮 + 工具栏)
  ↓ 点击目标词
FloatingToolbar → MagicWandSheet
```

### 刷新机制

- RawMaterials 刷新按钮: `RefreshCcw` 图标
- 调用 `loadIngredients(userId, scenario, forceRefresh=true)`
- Force Refresh 绕过 Redis 缓存

---

**维护者**: Hugo (Opus Team)  
**关联文档**: `docs/ui-rules.md` (Design System), `docs/dev-notes/weaver-wand-technical-architecture.md`
