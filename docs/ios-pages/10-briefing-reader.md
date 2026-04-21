# 10 Briefing Reader

## 1. 页面目标

- 阅读已生成简报，并支持 Wand 查词与句子分析。

## 2. Web 现状映射

- `app/weaver/page.tsx`
- `app/api/wand/word/route.ts`
- `app/api/wand/analyze/route.ts`

## 3. 交互流与状态流

- 打开简报详情。
- 在正文中触发查词或分析。
- 分析结果以流式或分段方式展示。

## 4. 数据模型 / API 契约

- `GET /api/mobile/v1/weaver/:id`
- `GET /api/mobile/v1/weaver/wand/word`
- `POST /api/mobile/v1/weaver/wand/analyze`

## 5. 边界与失败场景

- 阅读状态恢复、查词命中但分析失败、超时与中断反馈。

## 6. 测试用例

- 详情加载、查词、分析流、返回路径恢复。

## 7. 待确认问题

- Wand 的交互优先做长按菜单还是正文工具栏。
