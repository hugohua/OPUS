# 05 Arena Dashboard

## 1. 页面目标

- 展示语法雷达、薄弱点、矩阵与竞技入口，成为 Part 5 与 Mission 的母页。

## 2. Web 现状映射

- `app/dashboard/arena/page.tsx`
- `actions/grammar-dashboard.ts`

## 3. 交互流与状态流

- 首屏加载 overview。
- 切换 domain 时按需拉 matrix。
- 从概览页进入 `Part 5` 与 `Mission`。

## 4. 数据模型 / API 契约

- `GET /api/mobile/v1/arena/overview`
- `GET /api/mobile/v1/arena/matrix?domain=...`

## 5. 边界与失败场景

- 雷达图空数据、矩阵切域失败、未登录态和离线兜底都要明确。

## 6. 测试用例

- overview/matrix 映射、domain 切换、入口跳转、空态和错误态。

## 7. 待确认问题

- 矩阵是单页切换还是进入二级页面。
