# 04 Session Runner

## 1. 页面目标

- 承接训练页与 Arena 的会话入口，完成拉题、作答、回流、完成页的闭环。

## 2. Web 现状映射

- `app/dashboard/session/[mode]/page.tsx`
- `components/session/session-runner.tsx`
- `actions/get-next-drill.ts`
- `actions/record-outcome.ts`

## 3. 交互流与状态流

- 进入时按 `mode` 拉取 batch。
- 作答后更新当前题状态并提交 outcome。
- 批次耗尽时展示完成页；空队列时展示可恢复空态。

## 4. 数据模型 / API 契约

- `POST /api/mobile/v1/session/batch`
- `POST /api/mobile/v1/session/outcome`
- `GET /api/mobile/v1/session/audio`
- `POST /api/mobile/v1/session/audio/grade`
- `GET /api/mobile/v1/session/review-cards`

## 5. 边界与失败场景

- `vocabId < 0` 的纯语法题不能误写 FSRS。
- 拉题失败、回流失败、音频资源缺失都要有可恢复分支。

## 6. 测试用例

- mode 分发、完成页、空队列、回流异常、跨轨打分降级。

## 7. 待确认问题

- 通用会话框架与音频训练是否共用同一个状态机。
