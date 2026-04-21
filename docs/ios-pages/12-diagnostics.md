# 12 Diagnostics

## 1. 页面目标

- 保留 iOS 调试与环境校验入口，支持版本信息、环境信息、token 状态、健康检查和清 token。

## 2. Web 现状映射

- `app/api/mobile/v1/health/route.ts`
- `ios/Features/Diagnostics/*`

## 3. 交互流与状态流

- 进入后展示环境与版本信息。
- 用户可执行 health check、reload config、clear token。
- 清 token 后根壳层回到未登录态。

## 4. 数据模型 / API 契约

- `GET /api/mobile/v1/health`

## 5. 边界与失败场景

- 接口不可达、环境切换残留旧状态、清 token 后页面回退时机。

## 6. 测试用例

- health check 成功/失败、clear token、环境切换。

## 7. 待确认问题

- 是否需要把更多内部调试开关暴露到 Diagnostics。
