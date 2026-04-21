# 02 Home

## 1. 页面目标

- 让用户在登录后第一屏快速看到今日训练主入口、FSRS 摘要、技能入口、最新简报和 Diagnostics 入口。
- 将现有 `Dashboard` 静态 preview 替换为真实的移动端 summary 数据消费。
- 首页只承担聚合与导航，不承担深度流程本身。

## 2. Web 现状映射

- Web 对齐来源是 `app/dashboard/page.tsx`。
- 数据来源主要是 `actions/get-dashboard-stats.ts` 与 `actions/weaver-actions.ts#getLatestBriefing`。
- iOS 现有基础在 `ios/Features/Dashboard/*`，目前仍是静态 preview 数据。

## 3. 交互流与状态流

### 3.1 进入首页

1. 用户进入主壳层默认落在 `首页` Tab。
2. ViewModel 发起 `GET /api/mobile/v1/dashboard/summary`。
3. 成功后按卡片区块渲染；失败展示错误态；空简报只影响简报卡片，不影响首页其他模块。

### 3.2 首页交互

- Hero CTA 进入今日训练主链路。
- 训练入口卡片进入训练页或具体会话。
- 技能训练卡片进入对应训练模式。
- 最新简报卡片进入简报阅读器或简报控制台。
- Diagnostics 入口以现有 sheet 方式保留。

### 3.3 刷新策略

- 首次进入时自动加载。
- Tab 切回首页时可选轻量刷新，但不能每次强刷导致闪烁。
- 下拉刷新是否支持可在实现阶段决定，本 spec 不强制。

## 4. 数据模型 / API 契约

### 4.1 Route 壳层

- `GET /api/mobile/v1/dashboard/summary`

### 4.2 建议 DTO

- `MobileDashboardSummary`
  - `fsrs`
  - `primaryTask`
  - `trainingEntries`
  - `skillEntries`
  - `latestBriefing`
  - `diagnostics`

### 4.3 iOS 侧模块边界

- `DashboardSummaryService` 负责请求与解析 summary。
- `DashboardViewModel` 只负责状态组织与导航输出，不拼装多接口。
- 现有 `DashboardHomeView` 尽量保留视觉结构，只替换数据来源和状态分支。

## 5. 边界与失败场景

- `latestBriefing` 为空时不能让整个首页变成空态，应该只降级最新简报卡片。
- summary 某个子字段缺失时要明确本地兜底值，避免首页整体崩掉。
- 未登录进入首页时应由根壳层拦截，不在首页内部自行处理鉴权流程。
- 如果 Diagnostics 依赖的健康数据失败，不应阻塞首页主内容。

## 6. 测试用例

- 单元测试
  - summary DTO 到 `DashboardHomeState` 的映射。
  - 最新简报为空时的卡片降级。
  - 多模块并发字段缺失时的兜底逻辑。
- UI 测试
  - 首页首屏 loading/success/error 三态。
  - 从首页进入训练、简报、Diagnostics 的导航。
  - 未登录或 token 失效时无法停留在首页。

## 7. 待确认问题

- 首页 Hero CTA 是直接跳 `Daily Blitz`，还是先进入训练 Hub。
- 最新简报卡片点击后优先进入阅读器还是简报控制台。
- 是否要在首页直接露出 Arena 的快捷入口，还是维持五入口分工不加捷径。
