# 03 Training Hub

## 1. 页面目标

- 把 Web 端分散在首页与多个入口里的训练模式，整理成单独的 iOS `训练` Hub。
- 统一呈现训练分区、推荐入口、模式可用性与空态说明。
- 让后续 `Session Runner` 成为一个被清晰承接的下级流程，而不是继续塞回首页。

## 2. Web 现状映射

- 对齐来源包括 `components/dashboard/training-section.tsx`、`components/dashboard/skill-gym.tsx`、`app/dashboard/cards/page.tsx`、`app/drill/audio/page.tsx`。
- 训练会话本身仍落在 `app/dashboard/session/[mode]/page.tsx`。
- iOS 现阶段只有 `training` Tab 的 placeholder。

## 3. 交互流与状态流

### 3.1 进入训练页

1. 用户切到 `训练` Tab。
2. 页面展示训练分区、推荐模式、卡片入口和必要说明文案。
3. 若某些模式依赖额外数据，如音频待复习或 review cards，可在卡片层展示可用性状态。

### 3.2 训练入口行为

- 通用模式卡片进入 `Session Runner(mode=...)`。
- 音频类入口进入专门的音频训练子流程。
- Review Cards 若保留独立入口，需要与通用 session 区分展示。

### 3.3 状态分支

- loading：显示卡片骨架，不展示空白区块。
- unavailable：模式暂不可用时，保留卡片但展示原因与禁用态。
- empty：例如无待复习音频时，要给出解释与回退建议。

## 4. 数据模型 / API 契约

### 4.1 依赖 route

- `GET /api/mobile/v1/dashboard/summary`
- `GET /api/mobile/v1/session/audio`
- `GET /api/mobile/v1/session/review-cards`

### 4.2 iOS 侧建议模型

- `TrainingHubSection`
  - `id`
  - `title`
  - `entries`
- `TrainingEntry`
  - `mode`
  - `title`
  - `subtitle`
  - `availability`
  - `destination`

### 4.3 模块边界

- `TrainingHubViewModel` 负责入口组织与可用性判断。
- `Session Runner` 不在本页内实现，只负责接收路由参数并承接。
- 首页只保留少量推荐入口，不再承担全量训练目录。

## 5. 边界与失败场景

- 训练页与首页的职责必须分清，不能两个地方都展示同一整套训练目录。
- 模式不可用时不能直接隐藏，否则用户会误解为功能缺失。
- 某个入口依赖的数据失败时，不应拖垮整个训练页。
- 需要明确哪些模式属于本期真实可实施范围，不能把未来态模式提前挂进去。

## 6. 测试用例

- 单元测试
  - 训练模式到入口卡片的映射。
  - 可用性判断与文案降级。
  - 首页推荐入口与训练页全量入口之间的去重规则。
- UI 测试
  - 训练页 loading/success/unavailable/empty 四类状态。
  - 进入不同模式后路由参数完整。
  - 音频待复习为空时的专门空态。

## 7. 待确认问题

- `Review Cards` 是否在训练页保留独立入口，还是并入某个模式分区。
- 音频训练是单独页面还是仍由通用会话框架承接。
- 推荐区块是否需要服务端返回排序，还是先由 iOS 本地按固定顺序展示。
