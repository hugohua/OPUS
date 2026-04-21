# 06 Arena Part 5

## 1. 页面目标

- 完成单句竞技答题、反馈、解析和遥测回流。

## 2. Web 现状映射

- `app/dashboard/arena/blitz/page.tsx`
- `actions/arena-telemetry.ts`
- `actions/get-next-drill.ts`

## 3. 交互流与状态流

- 进入后拉题。
- 作答立即反馈并允许查看解析。
- 继续下一题直至完成页。

## 4. 数据模型 / API 契约

- `POST /api/mobile/v1/session/batch`
- `POST /api/mobile/v1/session/outcome`
- `POST /api/mobile/v1/arena/attempt`

## 5. 边界与失败场景

- Arena Attempt 与 FSRS 双回流不能互相污染。
- 纯语法题继续遵守不写 FSRS 的现状。

## 6. 测试用例

- 作答反馈、下一题、完成页、回流字段完整性。

## 7. 待确认问题

- 解析默认内联还是抽屉式展开。
