# 07 Arena Mission

## 1. 页面目标

- 承接 Part 6 长文多空任务，完成沉浸式阅读、空位导航、答题 dock 和遥测回流。

## 2. Web 现状映射

- `app/dashboard/arena/mission/page.tsx`
- `actions/part6-queue.ts`
- `actions/arena-telemetry.ts`

## 3. 交互流与状态流

- 进入后拉取 mission。
- 用户在正文中切换空位，在底部 dock 中提交答案。
- 完成后展示结果摘要或错题回看。

## 4. 数据模型 / API 契约

- `GET /api/mobile/v1/arena/mission`
- `POST /api/mobile/v1/arena/attempt`

## 5. 边界与失败场景

- cache miss、长文滚动与 dock 联动、多空位状态一致性是高风险点。

## 6. 测试用例

- 空位切换、滚动定位、完成态、mission 拉取失败兜底。

## 7. 待确认问题

- Wand 入口是否在本页第一期就开放。
