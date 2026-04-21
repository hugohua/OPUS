# Wave 0 Foundation Plan

## 1. 目标

在不扩展业务范围的前提下，先打通 iOS 原生端的基础链路，为后续页面实现提供稳定底座。

本波次只覆盖：

- `Auth & Launch`
- 移动端 auth route 壳层
- App 启动恢复与未登录拦截
- 根壳层的受保护导航切换
- 统一 loading / error / empty 状态约定

本波次不覆盖：

- 首页真实数据接入
- 训练、竞技、词库、简报的业务页实现
- Arena / Session / Weaver 的深流程

## 2. 输入与依赖

- 总纲文档：`docs/IOS-MASTER-FEATURE-LIST.md`
- 页面 spec：`docs/ios-pages/01-auth-and-launch.md`
- 当前 iOS 基础：`ios/Core/Auth/*`、`ios/Core/Networking/*`、`ios/App/*`
- 当前服务端认证来源：`actions/auth.ts`、`auth.ts`

## 3. 实施顺序

### 任务 1：补移动端 auth route 壳层

目标：

- 新增移动端可消费的登录、注册、退出、会话查询接口。

候选文件：

- `app/api/mobile/v1/auth/login/route.ts`
- `app/api/mobile/v1/auth/register/route.ts`
- `app/api/mobile/v1/auth/logout/route.ts`
- `app/api/mobile/v1/auth/me/route.ts`
- 视需要补 `refresh/route.ts`

验收：

- route 不复制业务逻辑，只做移动端 DTO 包装。
- 错误响应结构对 iOS 稳定。

### 任务 2：补 iOS 会话服务与启动协调器

目标：

- 让 App 能在启动时恢复会话，并在 token 失效时统一回到未登录态。

候选文件：

- `ios/App/*`
- `ios/Core/Auth/*`
- 视需要新增 `ios/Core/Session/*`

验收：

- 冷启动存在 token 时会先校验会话。
- `401` 错误会统一触发清 token 和根路由回退。

### 任务 3：定义根壳层导航与守卫

目标：

- 在主壳层与未登录入口之间建立单一切换点，避免每个页面自行处理鉴权。

候选文件：

- `ios/App/OpusApp.swift`
- `ios/App/AppDependencies.swift`
- `ios/Features/Dashboard/DashboardTabContainerView.swift`

验收：

- 未登录用户无法停留在受保护页面。
- 登录成功后只需切换一次根状态，不需要页面层自行弹转。

### 任务 4：统一页面通用状态约定

目标：

- 为后续首页、训练页、竞技页提供统一的 loading / error / empty 展示接口。

候选文件：

- `ios/Core/UI/*`
- `ios/Features/Dashboard/Components/*`

验收：

- 至少定义一套可复用的状态容器或规范。
- 后续页面不必重新各写一套空态和错误态骨架。

### 任务 5：补基础测试与验证路径

目标：

- 在真正实现业务页前，先锁住认证和根壳层底座。

测试范围：

- token store
- auth session service
- launch coordinator
- route contract

验收：

- 单元测试覆盖关键状态切换。
- 模拟器可完成启动恢复、登录进入主壳层、清 token 回未登录态。

## 4. 建议执行方式

- 主线程只协调本波次，不同时并行改多个共享根文件。
- route 壳层与 iOS 壳层可以拆成两个子任务，但根路由切换和通用状态约定最好串行完成。
- 每完成一个任务都更新 `docs/ios-progress.json`，不要等整波完成再回填。

## 5. 验证清单

- `GET /api/mobile/v1/auth/me` 在有效 token 下返回稳定 DTO。
- 无 token 冷启动进入未登录入口。
- 有 token 冷启动进入主壳层。
- token 失效后能从任意受保护流程回到未登录入口。
- 根壳层不会因为某个业务页未完成而卡死。

## 6. 波次完成标准

- `01-auth-and-launch` 可以从 `todo` 进入 `done`。
- `wave-0` 所需 route 和 iOS 基础模块已具备后续页面复用条件。
- 后续 `Home` 与 `Training Hub` 可以在不重复实现鉴权底座的前提下开始开发。
