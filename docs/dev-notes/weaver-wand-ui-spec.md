# Weaver Lab & Magic Wand UI 规范

> **设计风格**: Linear 质感、Vercel 数据流、沉浸式极客黑  
> **版本**: 1.0

---

## 1. PRD 功能映射

| PRD ID | 功能点 | UI 组件 | 状态 |
|--------|--------|---------|------|
| **WL-01** | Priority Queue (Due) | `WeaverConsole` 左侧面板 | ✅ 已设计 |
| **WL-02** | Scenario 选择 | `WeaverConsole` 右侧卡片 | ✅ 已设计 |
| **WL-03** | 流式生成 | "WEAVE CONTEXT" 按钮触发 | ✅ 已设计 |
| **WL-04** | 目标词高亮 | `ArticleReader` 下划线样式 | ✅ 已设计 |
| **MW-01** | Bottom Sheet | `MagicWandSheet` 弹窗 | ✅ 已设计 |
| **MW-02** | Local DNA (Cache-First) | 实线边框，0ms 标签 | ✅ 已设计 |
| **MW-03** | AI Context (Fallback) | 虚线边框，呼吸点动画 | ✅ 已设计 |

---

## 2. 设计 Token 摘要

```css
/* 背景 */
--bg-base: #050505;
--bg-card: rgba(24, 24, 27, 0.3);  /* zinc-900/30 */

/* 边框 */
--border-default: rgba(39, 39, 42, 0.5);  /* zinc-800/50 */
--border-active: rgba(99, 102, 241, 0.5);  /* indigo-500/50 */

/* 高亮样式 */
--highlight-due: rgba(244, 63, 94, 0.1);  /* rose-500/10 */
--highlight-target: rgba(99, 102, 241, 0.1);  /* indigo-500/10 */

/* 状态指示 */
--status-sync: #6366f1;  /* indigo-500, glow effect */
--status-loading: #8b5cf6;  /* violet-500, animate-ping */
```

---

## 3. 核心组件规范

### 3.1 WeaverConsole

**路径**: `components/weaver/WeaverConsole.tsx`

- 左侧: Priority Queue (Due 词汇，rose 色调)
- 左侧: Filler Context (已熟记词汇，zinc 色调)
- 右侧: Scenario 卡片 (2 列网格)
- 底部: "WEAVE CONTEXT" CTA 按钮

### 3.2 MagicWandSheet

**路径**: `components/wand/MagicWandSheet.tsx`

分层结构 (体现 Cache-First 策略):

1. **Header**: 单词 + 音标 + 词性
2. **Layer 1 - Local DNA**: 实线边框，"0ms" 标签，词源树
3. **Layer 2 - AI Context**: 虚线边框，呼吸点动画，Skeleton 加载态

### 3.3 高亮样式

**目标词 (Target)**:
```html
<span class="border-b border-indigo-500/50 text-indigo-100 bg-indigo-500/10 px-1 rounded">
  strategy
</span>
```

**Due 词 (优先复习)**:
```html
<span class="border-b border-rose-500/50 text-rose-100 bg-rose-500/10 px-1 rounded">
  audit
</span>
```

---

## 4. HTML Demo 参考

### 4.1 Weaver Console

```html
<div class="relative min-h-screen w-full bg-[#050505] text-zinc-300 font-sans antialiased flex flex-col selection:bg-indigo-500/30">
  
  <div class="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

  <header class="border-b border-zinc-800/50 bg-[#050505]/80 backdrop-blur-md px-6 h-14 flex items-center justify-between sticky top-0 z-50">
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]"></div>
      <span class="font-mono text-sm font-bold text-zinc-100 tracking-tight">WEAVER LAB v2.0</span>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-[10px] font-mono text-zinc-500">FSRS SYNC: 12ms</span>
      <div class="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-400">HUGO</div>
    </div>
  </header>

  <main class="flex-1 max-w-5xl mx-auto w-full p-8 grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
    <!-- Priority Queue -->
    <div class="md:col-span-5 flex flex-col gap-6">
      <div class="border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-hidden">
        <div class="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
          <h3 class="text-xs font-mono font-bold text-zinc-400 uppercase">Priority Queue (Due)</h3>
          <span class="text-[10px] font-mono text-rose-500 bg-rose-500/10 px-1.5 rounded">12 Items</span>
        </div>
        <div class="p-4 flex flex-wrap gap-2">
          <span class="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-xs font-mono text-rose-400">strategy</span>
          <span class="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-xs font-mono text-rose-400">compile</span>
          <!-- ... more words -->
        </div>
      </div>
    </div>

    <!-- Scenario Selection -->
    <div class="md:col-span-7 flex flex-col gap-6">
      <h3 class="text-xs font-mono font-bold text-zinc-500 uppercase mb-3">Select Context Scenario</h3>
      <div class="grid grid-cols-2 gap-3">
        <button class="relative group p-4 rounded-xl border border-indigo-500/50 bg-indigo-500/5">
          <div class="font-bold text-zinc-100">Finance & Banking</div>
          <div class="text-xs text-zinc-500 mt-1">Focus: Reporting, Audit, IPO</div>
        </button>
        <!-- ... more scenarios -->
      </div>
      
      <!-- CTA -->
      <button class="w-full rounded-lg bg-zinc-100 py-3.5 text-sm font-bold text-black">
        <span>WEAVE CONTEXT</span>
        <span class="ml-2 px-1.5 py-0.5 rounded bg-black/10 text-[10px] font-mono">~300 TOKENS</span>
      </button>
    </div>
  </main>
</div>
```

### 4.2 Reader & Magic Wand Sheet

```html
<!-- Article with Highlights -->
<div class="prose prose-invert prose-lg leading-relaxed text-zinc-300">
  <p>
    The board has decided to adopt a more aggressive marketing 
    <span class="border-b border-indigo-500/50 text-indigo-100 bg-indigo-500/10 px-1 rounded cursor-pointer">
      strategy
    </span> 
    to capture the emerging market share.
  </p>
</div>

<!-- Magic Wand Bottom Sheet -->
<div class="fixed inset-x-0 bottom-0 z-50">
  <div class="bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-zinc-800 rounded-t-3xl p-6 pb-10">
    
    <!-- Header -->
    <div class="flex items-baseline gap-3 mb-1">
      <h2 class="text-3xl font-bold text-zinc-50 font-serif">strategy</h2>
      <span class="font-mono text-zinc-500">/ˈstrætədʒi/</span>
    </div>

    <!-- Layer 1: Local DNA (Cache-First, 0ms) -->
    <div class="mb-6">
      <span class="text-[10px] font-mono text-zinc-500 uppercase">Local DNA (0ms)</span>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <!-- Etymology Tree -->
        <div class="font-mono text-sm flex items-center gap-3">
          <span class="text-indigo-400 font-bold">stratos</span>
          <span class="text-zinc-600">+</span>
          <span class="text-indigo-400 font-bold">agein</span>
        </div>
        <div class="pl-3 border-l-2 border-indigo-500/30 text-xs text-zinc-400">
          <span class="text-indigo-500 font-mono">// Logic:</span>
          The art of leading an army -> Overall plan.
        </div>
      </div>
    </div>

    <!-- Layer 2: AI Context (Async, Skeleton) -->
    <div class="relative">
      <span class="relative flex h-2 w-2">
        <span class="animate-ping absolute h-full w-full rounded-full bg-violet-400 opacity-75"></span>
        <span class="relative rounded-full h-2 w-2 bg-violet-500"></span>
      </span>
      <span class="text-[10px] font-mono text-zinc-500 uppercase">AI Context Analysis</span>
      
      <div class="bg-zinc-900/50 border border-zinc-800/50 border-dashed rounded-xl p-4">
        <p class="text-sm text-zinc-300">
          In this sentence, <span class="text-indigo-300">"aggressive strategy"</span> implies a proactive approach.
        </p>
      </div>
    </div>

  </div>
</div>
```
