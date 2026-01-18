# 项目核心知识库

## 项目目标
- **项目名称:** Opus (AI 托业商务阅读器)
- **核心价值:** "1+N" 内容引擎 - 通过 AI 生成商务短文，将 1 个新词与 N 个旧词镶嵌在真实语境中学习
- **差异化:** 五维认知模型 (V/A/M/C/X)

## 技术栈
- **框架:** Next.js 14
- **数据库:** PostgreSQL + pgvector
- **ORM:** Prisma
- **样式:** Tailwind CSS
- **AI:** DeepSeek API
- **验证:** Zod

## 核心共识
1. **垂直切片架构:** 按功能开发 (DB -> Action -> UI)，禁止水平分层开发
2. **Server Actions:** 所有业务逻辑必须驻留在 `app/actions`
3. **UI 主题:** "Editorial Dark" 沉浸式暗黑杂志风
4. **布局规则:** 移动端优先 (`max-w-md mx-auto`)

## 场景枚举
recruitment, personnel, management, office_admin, finance, investment, tax_accounting, legal, logistics, manufacturing, procurement, quality_control, marketing, sales, customer_service, negotiation, business_travel, dining_events, technology, real_estate

## 优先级定义
- **100 (核心区):** 带商务标签 + 难度 > A2
- **60 (支撑区):** 无标签 + 难度 B2/C1
- **0 (噪音区):** A1/A2 简单词 (仅作语料填充)
