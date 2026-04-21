# 09 Briefing Console

## 1. 页面目标

- 让用户选择场景、词汇与密度，发起简报生成，并在生成中保持可感知状态。

## 2. Web 现状映射

- `app/weaver/page.tsx`
- `app/api/weaver/generate/route.ts`
- `actions/weaver-actions.ts`

## 3. 交互流与状态流

- 用户配置生成参数并提交。
- 页面进入生成中状态，消费流式输出。
- 成功后进入阅读器；失败时允许重试。

## 4. 数据模型 / API 契约

- `GET /api/mobile/v1/weaver/latest`
- `POST /api/mobile/v1/weaver/generate`

## 5. 边界与失败场景

- SSE 中断、取消生成、鉴权失败和参数校验错误都需要明确处理。

## 6. 测试用例

- 生成成功、取消、失败重试、参数非法、未授权。

## 7. 待确认问题

- 生成中是否允许切走页面后恢复。
