# Wave 3 Content And Hardening Plan

## 1. 目标

在不扩展产品范围的前提下，一次性完成 wave-3 的三个既定条目：

- `10-briefing-reader`
- `11-briefing-history`
- `12-diagnostics`

本波次只做内容承接与工程加固，不新增未来态功能，不重开产品讨论。

## 2. 规格锁定

以下默认值直接视为已确认，不再反复回问：

- `Briefing Reader` 使用正文长按文本动作触发 `Wand`
- `Wand analyze` 采用最小可用流式反馈，不追求完整富交互
- `Briefing History` 删除使用确认弹窗 + 刷新，不提供 undo
- `Diagnostics` 仅加固现有能力，不新增内部 debug toggle

非目标：

- 不扩展到 `09-briefing-console` 以外的新简报产品能力
- 不新增 admin / inspector / queue 等非 iOS 主链路功能
- 不复制 Web 业务逻辑；移动端只补 route 壳层与 iOS 消费端

## 3. 依赖与范围

输入文档：

- `docs/ios-progress.json`
- `docs/IOS-MASTER-FEATURE-LIST.md`
- `docs/ios-pages/10-briefing-reader.md`
- `docs/ios-pages/11-briefing-history.md`
- `docs/ios-pages/12-diagnostics.md`

主要代码范围：

- Track A: `ios/Features/Briefing/*`, `app/api/mobile/v1/weaver/*`, 以及直接相关的 shared DTO / mobile mapper
- Track B: `ios/Features/Diagnostics/*`，必要时包含 health 相关 mobile route / DTO，及最小 root-shell 集成

主线程职责：

- 只做计划、派工、进度文档更新、集成、验证、代码评审
- 不与两个 worker 争抢 Briefing / Diagnostics 业务文件写权限

## 4. 实施顺序

### Track A：Briefing Domain（串行）

#### 任务 A1：`10-briefing-reader`

目标：

- 为 iOS 简报模块补齐可直接打开指定文章的 Reader
- 支持读取文章详情、恢复正文、显示基本元信息
- 在正文长按文本后提供 `Wand` 查词 / 分析入口
- `analyze` 走最小可用流式体验，明确处理中、成功、失败状态

候选文件：

- `ios/Features/Briefing/*`
- `ios/Tests/Features/BriefingViewModelTests.swift`
- `app/api/mobile/v1/weaver/[id]/route.ts`
- `app/api/mobile/v1/weaver/wand/word/route.ts`
- `app/api/mobile/v1/weaver/wand/analyze/route.ts`
- `lib/mobile/briefing.ts`
- `lib/mobile/briefing.test.ts`
- `app/api/mobile/v1/routes.contract.test.ts`

验收：

- 首页 / 历史页进入 Reader 时能稳定恢复文章正文与上下文
- 长按后可执行 `Wand lookup` 与 `Wand analyze`
- `analyze` 至少具备进行中反馈、内容增量显示、失败提示
- 返回控制台或返回历史后，不丢失导航路径和已加载文章

#### 任务 A2：`11-briefing-history`

目标：

- 在 iOS 简报域内补齐历史列表、场景 / 状态筛选、详情跳转和删除
- 删除采用确认弹窗，成功后重新刷新服务端列表

候选文件：

- `ios/Features/Briefing/*`
- `ios/Tests/Features/BriefingViewModelTests.swift`
- `app/api/mobile/v1/weaver/history/route.ts`
- `app/api/mobile/v1/weaver/[id]/route.ts`
- `app/api/mobile/v1/weaver/[id]/route.test.ts`（如需要）
- `lib/mobile/briefing.ts`
- `lib/mobile/briefing.test.ts`
- `app/api/mobile/v1/routes.contract.test.ts`

验收：

- 历史列表能按场景和新旧状态筛选
- 点击列表项能进入 Reader 详情
- 删除确认后列表刷新，已删项不再残留
- 空态、错误态、筛选后无结果态都有明确反馈

### Track B：Diagnostics（独立）

#### 任务 B1：`12-diagnostics`

目标：

- 加固现有 Diagnostics 页的环境信息、health check、reload config、clear token 流程
- 保证 clear token 继续通过 root auth coordinator 回到未登录壳层
- 强化接口失败、配置刷新后的可见状态和信息一致性

候选文件：

- `ios/Features/Diagnostics/*`
- `ios/Tests/Features/DiagnosticsViewModelTests.swift`
- `ios/Tests/Features/HealthCheckServiceTests.swift`
- `ios/Core/Auth/LaunchCoordinator.swift`（仅在 clear-token 根路由联动必须时）
- `app/api/mobile/v1/health/route.ts`
- `app/api/mobile/v1/health/route.test.ts`

验收：

- Health Check 成功 / 失败状态清晰可见且可重试
- Reload Config 后环境 / Base URL / Build 信息刷新一致
- Clear Token 后根壳层回到未登录态，且 Diagnostics 不残留伪成功状态
- 不新增新的内部调试开关

## 5. 并行执行约束

- 只开两个顶层 track
- Track A 串行执行 `10-briefing-reader` → `11-briefing-history`
- Track B 独立执行 `12-diagnostics`
- 不允许两个 worker 同时编辑 `ios/Features/Briefing/*`
- 如运行时行为或测试结果不清晰，先按 `systematic-debugging` 找根因，再决定修复

## 6. 验证清单

单元 / 路由验证：

- 每个已完成条目都必须补充对应 iOS 单元测试与 mobile route / mapper 测试
- `app/api/mobile/v1/routes.contract.test.ts` 需覆盖新增 briefing route 壳层
- `lib/mobile/briefing.test.ts` 与 `ios/Tests/Features/BriefingViewModelTests.swift` 需覆盖 Reader / History 主路径
- `ios/Tests/Features/DiagnosticsViewModelTests.swift` 与 `app/api/mobile/v1/health/route.test.ts` 需覆盖 Diagnostics 加固行为

模拟器验证：

- `Briefing Console -> Briefing Reader -> Wand lookup/analyze`
- `Briefing History filter -> detail -> delete`
- `Diagnostics health check -> reload config -> clear token -> unauthenticated shell`

如果有验证做不完，必须在 `docs/ios-progress.json` 中明确记录：

- 已验证内容
- 未验证内容
- 残余风险

## 7. 进度回填要求

每个条目完成时都要更新 `docs/ios-progress.json`：

- `status`
- `executionLog`
- `verification`

全部三项完成后：

- 将 `10-briefing-reader`、`11-briefing-history`、`12-diagnostics` 标为 `done`
- 将 `wave-3` 标为 `done`
- 若 iOS backlog 已全量完成，在最终总结中明确说明

## 8. 停止条件

仅在以下情况停止：

- 出现当前规格未覆盖的真实产品决策缺口
- 环境或外部依赖阻塞
- 同一任务连续两次验证失败

其他常规确认一律不阻塞执行。
