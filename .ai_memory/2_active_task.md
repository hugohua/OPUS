# 当前任务状态

## 当前阶段
Phase 1.5: 沉浸式体验 (The Immersion Release)

## 当前任务
Task 1.5: Topic Briefing & Phase 1.5 Features

## 待办事项
- [x] Optimization: 模拟页预加载机制 (Drill Cache + Prefetch)
- [ ] Task 1.5.1: Magic Paste (语境注入) [P0]
- [ ] Task 1.5.2: Commute Mode (Audio Playlist & TTS)
  - [x] Enable TTS service in `dev:all`
- [x] Task 1.5.3: PRD Update (Topic Briefing) - Doc Integration
- [ ] Task 1.5.4: Topic Briefing (AI Context Generator) - Implementation
- [ ] Task 3.2: Rest Card UI (每日休息卡)

## 上下文
- 发现 `dashboard/simulate` 页面存在 10s+ 的 LLM 生成延迟。
- 实施了 "Drill Cache" 机制 (Schema + Logic)。
- 实现了 "生产者-消费者" 模型：首页进入 `simulate` 时预热缓存，`session` 页面优先消费缓存。
- 验证脚本 `scripts/verify-drill-cache.ts` 通过。
