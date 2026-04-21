# iOS Master Feature List

> 状态: Draft v1
> 日期: 2026-04-21
> 基线: 当前仓库中已实现的 Web 能力 + 现有 iOS 五入口骨架

## 1. 背景与目标

这份文档用于沉淀 OPUS iOS 端的总纲清单，定位为:

- 一份面向产品、设计、客户端、服务端联动的总览文档
- 一份后续页面级特性分析与设计文档的统一入口
- 一份明确边界的“当前可实施能力清单”，而不是未来 PRD 蓝图汇总

当前仓库已经具备两类真实基础:

- Web 端已落地的主链路能力，集中在 `app/dashboard`、`app/vocabulary`、`app/weaver`、`app/dashboard/arena`、`app/dashboard/session/[mode]`、`app/drill/audio`
- iOS 原生壳层与基础设施，集中在 `ios/App`、`ios/Core`、`ios/Features/Dashboard`、`ios/Features/Diagnostics`

当前 iOS 骨架已经明确采用五入口信息架构，而不是 PRD 中的双 Tab:

- `首页`
- `训练`
- `竞技`
- `词库`
- `简报`

其中 `Diagnostics` 已作为独立调试能力存在，并通过首页诊断入口以 sheet 方式呈现。

本期目标不是重写产品定义，而是将“当前 Web 已实现能力如何迁移到 iOS”说清楚，形成后续逐页分析、交互设计、接口拆分和测试规划的统一依据。

## 2. 范围与边界

### 2.1 功能基线

本期只以“当前仓库已实现的 Web 能力”为基线，不纳入尚未落地的未来态 PRD 功能。

纳入范围:

- 登录 / 注册 / 启动恢复
- 首页聚合
- 训练入口与训练会话
- 竞技概览、Part 5、Part 6 Mission
- 词库列表与详情链路
- 简报生成、阅读、历史
- Diagnostics 调试页

不纳入范围:

- `Profile` 及其二级页面
- `Admin`、`Inspector`、`Queue` 等管理后台
- `Drive` / 被动听力驾驶页的独立产品化设计
- PWA、浏览器专属体验、桌面端布局
- 当前仓库中未落地的未来态实验功能

### 2.2 原生端约束

- 导航以现有 iOS 五入口骨架为准，来源见 `ios/Features/Dashboard/DashboardTab.swift`
- 鉴权模型以原生 `Bearer Token` 为准，延续 `ios/Core/Auth/AuthTokenStore.swift` 与 `KeychainTokenStore.swift` 的方向
- 服务端优先复用现有 action / service / route 逻辑，只补移动端可消费的 HTTP 壳层
- iOS 不直接调用 Web 页面级组合逻辑，不复用 NextAuth cookie 流

### 2.3 实施原则

- 不复制业务逻辑: 共享服务层，分离 Web 适配层与 Mobile route 壳层
- 不扩大功能范围: 只覆盖当前真实存在的主链路入口
- 不混用未来能力: PRD 未来态需求作为参考，不进入本期清单

## 3. 信息架构

### 3.1 iOS 顶层结构

| 入口 | iOS 目标形态 | Web 对齐来源 | 当前 iOS 状态 |
| --- | --- | --- | --- |
| 首页 | 聚合型 Home | `app/dashboard/page.tsx` | 已有静态骨架与预览数据 |
| 训练 | 训练模式 Hub | `components/dashboard/training-section.tsx`、`components/dashboard/skill-gym.tsx`、`app/dashboard/cards/page.tsx`、`app/drill/audio/page.tsx`、`app/dashboard/session/[mode]/page.tsx` | 仅 placeholder |
| 竞技 | Arena Dashboard | `app/dashboard/arena/page.tsx` | 仅 placeholder |
| 词库 | Vocabulary List + Detail | `app/vocabulary/page.tsx`、词汇详情链路 | 仅 placeholder |
| 简报 | Briefing Hub | `app/weaver/page.tsx`、`app/weaver/history/page.tsx` | 仅 placeholder |
| Diagnostics | 调试与环境校验 | `ios/Features/Diagnostics/*`、`app/api/mobile/v1/health/route.ts` | 已接基础健康检查 |

### 3.2 页面映射说明

- 首页不是完整业务页集合，而是入口聚合页，负责 FSRS 摘要、训练入口、最新简报和诊断入口
- 训练入口在 iOS 中建议独立成页，而不是继续全部堆在首页
- 竞技与简报在 Web 端都包含“概览页 + 深入页”，iOS 也需要拆成母页与子流程页
- `Diagnostics` 不是正式 Tab，但必须保留，因为它已经承担 iOS 环境验证与网络联调职责

## 4. 全局能力清单

| 能力域 | iOS 侧所需能力 | 当前可复用来源 | 备注 |
| --- | --- | --- | --- |
| 鉴权 | 登录、注册、邀请码校验、token 存储、登出、过期处理 | `actions/auth.ts`、`auth.ts`、`ios/Core/Auth/*` | 需要移动端 token route 壳层 |
| 启动恢复 | 冷启动恢复会话、未登录拦截、环境加载 | `RuntimeConfig`、`BuildInfo`、`AuthTokenStore` | 需要启动路由守卫 |
| 网络层 | Base URL、请求构建、Header 注入、错误映射、日志开关 | `ios/Core/Networking/*`、`ios/Core/Configuration/*` | 现有原生基础层已具备雏形 |
| 加载态 | 首屏 skeleton、列表 loading、分页 loading、流式 loading | Web 页面与现有 iOS Diagnostics/Home | 所有业务页必须统一设计 |
| 错误态 | Unauthorized、网络错误、空数据、重试 | 各 action / route 已有错误分支 | 需要统一 iOS 展示策略 |
| 空态 | 空训练队列、空简报历史、无词汇结果、无待复习音频 | `getAudioSession`、`getNextDrillBatch`、`getWeaverHistory`、`getVocabList` | 不允许只展示空白容器 |
| 埋点 / 遥测 | 训练结果回流、Arena Attempt、错题本、审计 | `recordOutcome.ts`、`arena-telemetry.ts`、审计服务 | 需要统一到移动端接口 |
| 流式内容 | 简报生成 / Wand 分析的 SSE 消费 | `app/api/weaver/generate/route.ts`、`app/api/wand/analyze/route.ts` | 需要移动端流式消费方案 |
| 本地存储 | token、轻量偏好、必要缓存 | Keychain + 本地轻缓存 | 不在本期扩展离线模式 |

## 5. 页面功能矩阵

> 说明: 这一节是后续页面级分析的入口。每个页面至少锁定用户目标、UI 组成与关键状态、服务端依赖、测试关注点、当前状态和后续文档编号。

| 页面 | 用户目标与核心任务 | iOS UI 组成与关键状态 | 服务端依赖与现有可复用能力 | 测试覆盖要求与高风险点 | 当前状态 / 后续文档 |
| --- | --- | --- | --- | --- | --- |
| Auth & Launch | 完成登录、注册、邀请码校验、冷启动恢复与未登录拦截 | 启动页、登录页、注册页、加载态、登录失败态、token 失效态 | `actions/auth.ts`、`auth.ts`、`ios/Core/Auth/*`、`RuntimeConfig` | token 持久化、失效恢复、邀请码错误、未授权拦截、切环境 | iOS 未实现；见 `01-auth-and-launch.md` |
| 首页 | 快速进入今日训练，查看 FSRS 摘要、核心训练入口、最新简报与调试入口 | Hero CTA、FSRS 摘要、训练入口卡片、技能训练卡片、最新简报卡片、诊断入口、加载/空态/错误态 | `app/dashboard/page.tsx`、`actions/get-dashboard-stats.ts`、`actions/weaver-actions.ts#getLatestBriefing` | 聚合接口一致性、多个模块并发加载、空简报、未登录首页 | iOS 仅静态 preview；见 `02-home.md` |
| 训练页 | 浏览所有训练模式并进入对应流程 | 训练分区、模式卡片、推荐入口、空态、错误态 | `components/dashboard/training-section.tsx`、`components/dashboard/skill-gym.tsx`、`app/dashboard/cards/page.tsx`、`app/drill/audio/page.tsx` | 页面与首页职责划分、入口去重、模式可用性判断 | iOS 仅 placeholder；见 `03-training-hub.md` |
| Session Runner | 完成 `SYNTAX/PHRASE/BLITZ/CHUNKING/CONTEXT/Lx_MIXED/DAILY_BLITZ/ARENA_PART5` 等训练闭环 | 骨架屏、题面、选项、音频/文本内容、进度、完成页、空队列、错误态 | `app/dashboard/session/[mode]/page.tsx`、`components/session/session-runner.tsx`、`actions/get-next-drill.ts`、`actions/record-outcome.ts` | 模式分发、批量拉题、预取、跨轨打分、负 vocabId 跳过回流 | iOS 未实现；见 `04-session-runner.md` |
| Arena Dashboard | 查看语法雷达、薄弱点、矩阵，并进入 Part 5 / Mission | 大盘概览、雷达图、薄弱点列表、矩阵 Tab、模式入口卡片、离线兜底态 | `app/dashboard/arena/page.tsx`、`actions/grammar-dashboard.ts` | 雷达图空数据、矩阵切域、概览与矩阵切换、未登录态 | iOS 仅 placeholder；见 `05-arena-dashboard.md` |
| Arena Part 5 | 完成单句实战答题、结果反馈与 Arena 遥测回流 | 题干、选项、反馈态、解析抽屉、下一题、完成页 | `app/dashboard/arena/blitz/page.tsx`、`components/session/session-runner.tsx`、`actions/get-next-drill.ts`、`actions/arena-telemetry.ts` | Quick Drill 节点参数、Arena Attempt 与 FSRS 双回流、纯语法题跳过 FSRS | iOS 未实现；见 `06-arena-part5.md` |
| Arena Mission | 完成长文多空实战、分空答题与错题回流 | 沉浸式阅读页、空位导航、底部答题 dock、Wand 入口、加载态、失败态 | `app/dashboard/arena/mission/page.tsx`、`actions/part6-queue.ts`、`actions/arena-telemetry.ts` | 多空位状态管理、错题快照、长文滚动与 dock 联动、缓存 miss 兜底 | iOS 未实现；见 `07-arena-mission.md` |
| 词库 | 搜索、筛选、浏览 FSRS 词表并查看详情 | HUD、搜索、状态筛选、标签筛选、排序、列表、分页/无限加载、词条详情 sheet | `app/vocabulary/page.tsx`、`components/vocabulary/vocabulary-list.tsx`、`actions/get-vocab-list.ts` | 分页一致性、筛选参数映射、详情数据补齐、空结果态 | iOS 仅 placeholder；见 `08-vocabulary.md` |
| 简报控制台 | 选择场景、词汇与密度，发起简报生成 | 场景选择、词汇选择、密度选择、提交、生成中、失败重试 | `app/weaver/page.tsx`、`app/api/weaver/generate/route.ts`、`actions/weaver-actions.ts#getWeaverAnchor` | 流式生成、取消生成、鉴权失败、生成参数校验 | iOS 仅 placeholder；见 `09-briefing-console.md` |
| 简报阅读器 | 阅读已生成内容，并触发词句分析 | 标题、正文、场景标签、词汇高亮、Wand 查词/分析、返回控制 | `app/weaver/page.tsx`、`app/api/wand/word/route.ts`、`app/api/wand/analyze/route.ts` | SSE 分析流、上下文查词、阅读状态恢复、错误与超时 | iOS 未实现；见 `10-briefing-reader.md` |
| 简报历史 | 查看历史简报并筛选进入详情或删除 | 历史列表、场景筛选、新旧状态筛选、空态、删除确认 | `app/weaver/history/page.tsx`、`actions/weaver-actions.ts#getWeaverHistory`、`deleteWeaverArticle` | 列表分页/筛选、删除一致性、历史空态、详情跳转 | iOS 未实现；见 `11-briefing-history.md` |
| Diagnostics | 校验环境、版本、token、健康检查、清 token | 环境信息、Build 信息、Token 状态、Health Check、Reload Config、Clear Token | `ios/Features/Diagnostics/*`、`app/api/mobile/v1/health/route.ts` | 环境切换、接口不可达、token 清除后的重定向 | iOS 已实现基础版；见 `12-diagnostics.md` |

## 6. API 改造清单

> 原则: 不新建独立业务层，不复制现有业务逻辑。移动端接口优先采用“route 壳层 + 共享 service / action”的方式。

### 6.1 auth

**现有真实来源**

- `actions/auth.ts`
- `auth.ts`
- `ios/Core/Auth/AuthTokenStore.swift`

**移动端需要补的 route 壳层**

- `POST /api/mobile/v1/auth/login`
- `POST /api/mobile/v1/auth/register`
- `POST /api/mobile/v1/auth/refresh`
- `POST /api/mobile/v1/auth/logout`
- `GET /api/mobile/v1/auth/me`

**建议 DTO**

- `MobileAuthSession`
  - `accessToken`
  - `expiresAt`
  - `user: { id, name, email }`
- `MobileAuthError`
  - `code`
  - `message`
  - `fieldErrors?`

**说明**

- Web 继续使用 NextAuth cookie/session
- iOS 单独使用 Bearer Token
- 业务层共享用户鉴权结果，不共享传输形态

### 6.2 dashboard

**现有真实来源**

- `actions/get-dashboard-stats.ts`
- `actions/weaver-actions.ts#getLatestBriefing`
- `app/dashboard/page.tsx`

**移动端需要补的 route 壳层**

- `GET /api/mobile/v1/dashboard/summary`

**建议 DTO**

- `MobileDashboardSummary`
  - `fsrs`
  - `primaryTask`
  - `trainingEntries`
  - `skillEntries`
  - `latestBriefing`
  - `diagnostics`

**说明**

- 首页不应由 iOS 自己分散请求后拼装
- 需要一个聚合 summary payload 承接首页卡片

### 6.3 session

**现有真实来源**

- `actions/get-next-drill.ts`
- `actions/record-outcome.ts`
- `actions/audio-session.ts`
- `app/dashboard/cards/actions.ts`
- `components/session/session-runner.tsx`
- `app/drill/audio/page.tsx`

**移动端需要补的 route 壳层**

- `POST /api/mobile/v1/session/batch`
- `POST /api/mobile/v1/session/outcome`
- `GET /api/mobile/v1/session/audio`
- `POST /api/mobile/v1/session/audio/grade`
- `GET /api/mobile/v1/session/review-cards`

**建议 DTO**

- `MobileSessionBatchRequest`
  - `mode`
  - `limit`
  - `excludeVocabIds`
  - `grammarNodeId?`
- `MobileSessionBatchResponse`
  - `items: BriefingPayload[]`
  - `source`
  - `hasMore?`
- `MobileOutcomeRequest`
  - `userId`
  - `vocabId`
  - `grade`
  - `mode`
  - `duration?`
  - `track?`
  - `contextSentence?`
- `MobileReviewCard`
  - `id`
  - `word`
  - `phonetic`
  - `meaning`
  - `collocations`

**说明**

- `Session Runner` 与 `Review Cards` 共享词汇来源，但不是同一种交互
- 音频训练已具备独立 action，移动端只需 route 包装
- 需保留 `vocabId < 0` 纯语法题不回流 FSRS 的现有行为

### 6.4 arena

**现有真实来源**

- `actions/grammar-dashboard.ts`
- `actions/arena-telemetry.ts`
- `actions/part6-queue.ts`
- `app/dashboard/arena/page.tsx`
- `app/dashboard/arena/blitz/page.tsx`
- `app/dashboard/arena/mission/page.tsx`

**移动端需要补的 route 壳层**

- `GET /api/mobile/v1/arena/overview`
- `GET /api/mobile/v1/arena/matrix?domain=...`
- `POST /api/mobile/v1/arena/attempt`
- `GET /api/mobile/v1/arena/mission`

**建议 DTO**

- `MobileArenaOverview`
  - `radarDomains`
  - `actionRequiredNodes`
  - `trainingModes`
- `MobileSyntaxMatrix`
  - `l1Node`
  - `categories`
- `MobileArenaAttemptRequest`
  - `questionSeedId`
  - `anchorVocabId`
  - `isCorrect`
  - `responseTimeMs`
  - `selectedOption`
  - `questionType`
  - `part`
  - `snapshotPayload?`

**说明**

- Arena 结果提交必须继续复用 `recordArenaOutcome`
- Part 5 题面来源仍来自 session 批量拉题
- Part 6 Mission 会话来源独立，需单独保留 `mission` route

### 6.5 vocab

**现有真实来源**

- `actions/get-vocab-list.ts`
- `actions/vocab-actions.ts`
- `app/vocabulary/page.tsx`
- `components/vocabulary/vocabulary-list.tsx`

**移动端需要补的 route 壳层**

- `GET /api/mobile/v1/vocab/list`
- `GET /api/mobile/v1/vocab/:id`
- `GET /api/mobile/v1/vocab/tags`

**建议 DTO**

- `MobileVocabListItem`
  - `id`
  - `word`
  - `phonetic`
  - `definition`
  - `abceedRank`
  - `fsrs`
- `MobileVocabListResponse`
  - `items`
  - `metadata: { total, page, totalPages, hasMore, stats }`
- `MobileVocabDetail`
  - 在 `MobileVocabListItem` 基础上补全词源、搭配、上下文、词族等详情字段

**说明**

- 列表筛选参数必须稳定支持 `search/status/sort/tagFilter/page/limit`
- 当前 `DUE` 与 `DIFFICULTY` 排序存在实现限制，iOS 文档中需要明确这是现状，不伪装成已完全可用

### 6.6 weaver

**现有真实来源**

- `actions/weaver-actions.ts`
- `app/api/weaver/generate/route.ts`
- `app/api/wand/word/route.ts`
- `app/api/wand/analyze/route.ts`
- `app/weaver/page.tsx`
- `app/weaver/history/page.tsx`

**移动端需要补的 route 壳层**

- `GET /api/mobile/v1/weaver/latest`
- `GET /api/mobile/v1/weaver/history`
- `GET /api/mobile/v1/weaver/:id`
- `POST /api/mobile/v1/weaver/generate`
- `DELETE /api/mobile/v1/weaver/:id`
- `GET /api/mobile/v1/weaver/wand/word`
- `POST /api/mobile/v1/weaver/wand/analyze`

**建议 DTO**

- `MobileBriefingPreview`
  - `id`
  - `title`
  - `createdAt`
  - `scenario`
  - `contextLabel?`
  - `vocabPreview?`
- `MobileBriefingDetail`
  - `id`
  - `title`
  - `createdAt`
  - `scenario`
  - `body`
  - `targetWords?`
- `MobileWandLookup`
  - `vocab`
  - `etymology`
  - `aiInsight`

**说明**

- `generate` 与 `wand analyze` 都是流式能力，iOS 需要明确 SSE 消费策略
- `history/detail/delete` 应避免让 iOS 直接解析原始复杂 `body` 结构

## 7. 测试清单

### 7.1 iOS 单元测试

- `RuntimeConfig`、`BuildInfo`、环境切换与 Base URL 读取
- `RequestBuilder`、`URLSessionAPIClient`、错误映射、Header 注入
- `AuthTokenStore` / `KeychainTokenStore` 的 token 存取与清除
- 首页 summary DTO 到 ViewModel 的映射
- 训练模式入口映射与导航路由
- `Session Runner` 状态机: 拉题、作答、完成、空队列
- Arena 概览与矩阵数据模型映射
- 词库筛选参数构造与分页状态
- 简报历史列表与详情模型解析

### 7.2 iOS UI 测试

- 登录成功 / 失败 / 邀请码无效
- 冷启动自动恢复 token
- 五入口切换与返回路径
- 首页加载态、空态、错误态
- 训练页进入不同会话
- `Session Runner` 作答到完成页
- Arena Part 5 作答反馈
- Arena Mission 长文多空操作
- 词库搜索、筛选、详情打开
- 简报生成到阅读器
- 简报历史筛选与删除
- Diagnostics 健康检查与清 token

### 7.3 服务端契约测试

- `auth`: login / register / refresh / logout / me
- `dashboard`: summary 聚合接口
- `session`: batch / outcome / audio / audio grade / review cards
- `arena`: overview / matrix / attempt / mission
- `vocab`: list / detail / tags
- `weaver`: latest / history / detail / generate / delete / wand

### 7.4 关键业务回流场景

- token 过期后刷新与重新登录
- 未授权访问受保护移动端接口
- `getNextDrillBatch` 空队列与 fallback
- `recordOutcome` 的跨轨打分降级
- `vocabId < 0` 纯语法题跳过 FSRS 回流
- Arena Attempt 双写错题本
- Part 6 cache miss 回落到 deterministic fallback
- `getAudioSession` 无待复习项目
- 简报 SSE 生成中断 / 失败 / 重试
- Wand 查词命中本地缓存但分析流失败

## 8. 页面拆解索引

### 8.1 后续文档存放约定

- 目录: `docs/ios-pages/`
- 命名: 固定序号前缀，避免后续调整顺序时重命名全量文档

### 8.2 每份页面文档统一输出模板

后续每一份页面级文档都使用以下固定模板:

1. 页面目标
2. Web 现状映射
3. 交互流与状态流
4. 数据模型 / API 契约
5. 边界与失败场景
6. 测试用例
7. 待确认问题

### 8.3 页面分析顺序与文件索引

| 顺序 | 文件 | 页面范围 | 对齐来源 | 备注 |
| --- | --- | --- | --- | --- |
| 01 | `docs/ios-pages/01-auth-and-launch.md` | 登录、注册、启动恢复、鉴权守卫 | `actions/auth.ts`、`auth.ts`、iOS Auth Core | 第一批，基础链路 |
| 02 | `docs/ios-pages/02-home.md` | 首页聚合 | `app/dashboard/page.tsx` | 第一批，入口页 |
| 03 | `docs/ios-pages/03-training-hub.md` | 训练模式 Hub | `training-section`、`skill-gym`、`cards`、`audio` | 第一批，入口页 |
| 04 | `docs/ios-pages/04-session-runner.md` | 通用训练会话 | `app/dashboard/session/[mode]`、`components/session/session-runner.tsx` | 第二批，核心承接页 |
| 05 | `docs/ios-pages/05-arena-dashboard.md` | 竞技概览与矩阵 | `app/dashboard/arena/page.tsx` | 第二批，核心承接页 |
| 06 | `docs/ios-pages/06-arena-part5.md` | Part 5 实战答题 | `app/dashboard/arena/blitz/page.tsx` | 第二批，核心承接页 |
| 07 | `docs/ios-pages/07-arena-mission.md` | Part 6 Mission 长文多空 | `app/dashboard/arena/mission/page.tsx` | 第二批，核心承接页 |
| 08 | `docs/ios-pages/08-vocabulary.md` | 词库列表与详情 | `app/vocabulary/page.tsx` | 第三批，内容管理页 |
| 09 | `docs/ios-pages/09-briefing-console.md` | 简报生成控制台 | `app/weaver/page.tsx` | 第三批，内容管理页 |
| 10 | `docs/ios-pages/10-briefing-reader.md` | 简报阅读与 Wand | `app/weaver/page.tsx`、`app/api/wand/*` | 第三批，内容承接页 |
| 11 | `docs/ios-pages/11-briefing-history.md` | 简报历史与删除 | `app/weaver/history/page.tsx` | 第三批，内容管理页 |
| 12 | `docs/ios-pages/12-diagnostics.md` | 调试页 | `ios/Features/Diagnostics/*` | 最后补工程支持页 |

### 8.4 分析推进原则

- 先分析入口页，再分析承接页，最后分析支撑页
- 单页设计文档必须回链到本总纲，不允许脱离边界自行扩 scope
- 新增页面如果不在本索引中，必须先更新本总纲再进入细化设计

## 9. 验收检查

在本总纲基础上，后续工作应满足以下验收标准:

- 当前 iOS 目标页面全部在文档中具名出现
- 每个页面都具备功能描述、依赖 API、测试关注点、后续文档编号
- API 改造清单均能映射到当前真实存在的 action / route / service
- 页面级分析模板统一，不需要后续重新定义章节结构

