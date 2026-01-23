# Opus 身份验证系统与基础设施修复记录
> 日期：2026-01-23
> 背景：实现用户注册/登录 ("The Gate")，修复 Drill Engine "Mission Failed" 错误，恢复数据库数据。

## 1. 概述
本文档总结了本会话期间 **身份验证系统 (Authentication)**、**数据库恢复 (DB Restore)** 以及 **Drill Engine 稳定性修复** 的实现细节。

## 2. 核心架构：身份验证 ("The Gate")

我们实施了一个基于 `NextAuth.js v5` 的完整身份验证流程，强调安全性和受控访问。

### 2.1 凭证与安全
- **Provider**: `Credentials` (Email/Password).
- **加密**: 使用 `bcryptjs` 对密码进行单向哈希存储。
- **Session**: 扩展了 `next-auth` 类型，确保 `session.user.id` 在全站可用。
- **Middleware**: `middleware.ts` 保护除 `/login`, `/register` 外的所有路由。

### 2.2 邀请码机制 (Access Control)
- **模型**: `InvitationCode` (Prisma Model).
- **逻辑**: 注册时必须校验 `invitationCode` 的有效性 (`isActive: true`且 `maxUses > usedCount`)。
- **原子性**: 使用 Prisma 事务 (`$transaction`) 确保用户创建与邀请码计数更新的原子性。

### 2.3 UI/UX ("The Engineer's Terminal")
- **风格**: 采用 "Glassmorphism" + "Terminal" 风格。
- **组件**:
    - `InviteInput`: 自动大写、等宽字体的邀请码输入框。
    - `AuthCard`: 统一的磨砂玻璃卡片容器。

## 3. 基础设施：数据恢复与规范

### 3.1 数据库恢复
- **问题**: 早期开发导致数据丢失。
- **恢复**: 编写 `scripts/db-restore.ts` 从 `backups/` 目录恢复了 5600+ 条词汇数据。
- **补全**: 编写 `scripts/enrich-vocab.ts` 和 `scripts/check_pos.ts` 修复了丢失的 `partOfSpeech` 数据，这是 Drill Engine 正常工作的关键。

### 3.2 代码库规范化
- **DB 单例**: 将 `lib/prisma.ts` 重命名为 `lib/db.ts` 并统一全站导入路径 (`@/lib/db`)。
- **Server Actions**: 确立了 `ActionState` 标准返回格式，统一错误处理。

## 4. 关键修复：Drill Engine ("Mission Failed")

解决了导致 Session 无法启动的两个核心问题。

### 4.1 AI 输出不稳定性
- **问题**: Vercel AI SDK 的 `generateObject` 在某些模型下产生不稳定的 JSON (如包含 Markdown 代码块)。
- **修复**: 切换至 `generateText` 并手动实现健壮的 JSON 解析逻辑 (strip markdown + `JSON.parse`)。

### 4.2 严格模式下的数据真空
- **问题**: `fetchCandidates` 严格过滤 `partOfSpeech`，但恢复的数据中该字段为 `null`，导致无词可选。
- **修复**: 通过 `scripts/enrich-vocab.ts` 使用 Oxford 5000 原始数据回填了 POS 字段。

## 5. 后续步骤
- **UI 交互升级**: 将 Session 从垂直流 (`SessionRunner`) 升级为左右滑动卡片 (`SwipeCard`)，复用 `/dashboard/cards` 的交互逻辑。
- **懒加载优化**: 进一步微调 `Briefing` 的预加载策略。
