# 11 Briefing History

## 1. 页面目标

- 展示历史简报列表，支持筛选、进入详情和删除。

## 2. Web 现状映射

- `app/weaver/history/page.tsx`
- `actions/weaver-actions.ts#getWeaverHistory`
- `deleteWeaverArticle`

## 3. 交互流与状态流

- 加载历史列表。
- 按场景和状态筛选。
- 进入详情或执行删除确认。

## 4. 数据模型 / API 契约

- `GET /api/mobile/v1/weaver/history`
- `GET /api/mobile/v1/weaver/:id`
- `DELETE /api/mobile/v1/weaver/:id`

## 5. 边界与失败场景

- 删除一致性、空态与详情跳转是主要风险点。

## 6. 测试用例

- 历史筛选、删除确认、删除后刷新、空态。

## 7. 待确认问题

- 删除后是否支持本地短暂撤销。
