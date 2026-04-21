# 01 Auth And Launch

## 1. 页面目标

- 完成原生登录、注册、邀请码校验、冷启动恢复和未登录拦截。
- 建立 iOS 的 Bearer Token 会话模型，不复用 Web 的 NextAuth cookie 流。
- 为后续所有受保护页面提供统一的启动守卫和会话失效回退路径。

## 2. Web 现状映射

- 认证能力来源于 `actions/auth.ts` 与 `auth.ts`。
- iOS 现有 token 存储基础已经在 `ios/Core/Auth/AuthTokenStore.swift` 与 `ios/Core/Auth/KeychainTokenStore.swift`。
- 当前缺的是移动端可直接消费的 HTTP route 壳层和 App 启动时的会话恢复协调器。

## 3. 交互流与状态流

### 3.1 启动流

1. App 启动后先读取 `RuntimeConfig` 与本地 token。
2. 若本地无 token，直接进入未登录入口。
3. 若本地有 token，先拉 `GET /api/mobile/v1/auth/me` 验证会话。
4. 验证成功则进入主壳层；失败则清 token 并回到登录入口。

### 3.2 登录 / 注册流

1. 用户在登录页或注册页提交表单。
2. 成功后写入 Keychain，并触发主壳层切换。
3. 失败时按字段错误、邀请码错误、网络错误三类分别展示。

### 3.3 会话失效流

1. 任一受保护请求返回 `401`。
2. 网络层统一触发会话失效处理。
3. 清理本地 token、重置受保护状态、回退到登录页。

## 4. 数据模型 / API 契约

### 4.1 Route 壳层

- `POST /api/mobile/v1/auth/login`
- `POST /api/mobile/v1/auth/register`
- `POST /api/mobile/v1/auth/refresh`
- `POST /api/mobile/v1/auth/logout`
- `GET /api/mobile/v1/auth/me`

### 4.2 建议 DTO

- `MobileAuthSession`
  - `accessToken`
  - `expiresAt`
  - `user: { id, name, email }`
- `MobileAuthError`
  - `code`
  - `message`
  - `fieldErrors?`

### 4.3 iOS 侧模块边界

- `AuthTokenStore` 只负责 token 存取。
- `AuthSessionService` 负责 login/register/logout/me。
- `LaunchCoordinator` 负责启动恢复与根路由判定。
- `APIClient` 负责注入 `Authorization` header 与 `401` 错误映射。

## 5. 边界与失败场景

- 本地 token 存在但 `me` 校验失败时，不能短暂展示业务页再弹回登录。
- 登录成功但 Keychain 写入失败时，不能让 UI 误判为已登录。
- 邀请码校验失败要展示业务含义明确的错误，而不是统一的通用 toast。
- 环境切换后如果残留旧 token，需要定义是否自动清空，本期建议清空并要求重新登录。

## 6. 测试用例

- 单元测试
  - token 存取、覆盖、删除与启动恢复。
  - `401` 到会话失效的错误映射。
  - `login/register/me/logout` 的 DTO 映射。
- UI 测试
  - 登录成功进入主壳层。
  - 注册失败时正确展示字段错误。
  - 冷启动带 token 时自动恢复。
  - token 失效后被拦截并回到登录态。

## 7. 待确认问题

- 注册是否必须包含邀请码，还是部分环境允许跳过。
- `refresh` 是否在本期实现真实刷新，还是先按重新登录处理。
- 登录页与注册页是否需要独立视觉设计，还是先用统一原生表单骨架。
