# OPUS iOS 设计风格规范

> 状态: v1
> 范围: `ios/` 原生 iOS App
> 原则: HIG-native first, OPUS brand restrained

这份文档是 OPUS iOS 端的设计风格真相源。它把 Apple Human Interface Guidelines 适配到 OPUS 的产品语境：一个低压力、可持续回访的随身职场英语训练器。

`docs/ui-rules.md` 继续用于 Web 端；原生 SwiftUI/UIKit 界面以本文档为准。

## 优先级

当规范互相冲突时，按以下顺序判断：

1. Apple 平台惯例：HIG、SwiftUI/UIKit 默认行为、系统无障碍设置。
2. 本文档。
3. OPUS 产品约束：`.agent/rules/SYSTEM_PROMPT.md` 与 `docs/ios-pages/`。
4. 已安装的 `ios-design-guidelines` skill，作为通用 HIG 审计清单。
5. Web 视觉规范 `docs/ui-rules.md`，只复用品牌语义和状态命名，不直接照搬视觉样式。

## 设计北极星

OPUS iOS 应该像一个安静、原生、可信赖的学习工具，而不是把 Web Dashboard 复制进 SwiftUI。

目标气质：

- 原生：系统导航、系统排版、系统颜色、标准手势。
- 安静：少颜色、少装饰、少视觉竞争。
- 支持：认知安全优先于信息密度，恢复感优先于刺激感。
- 职场：结构清楚、精确、任务导向，但默认不游戏化。
- 有反馈：轻微触觉、明确状态、即时等待反馈。

OPUS 的品牌感不靠大面积装饰实现，而靠单一强调色、清晰状态语言和训练流程的专属交互体现。

## 核心规则

### 1. 原生组件优先

只要系统组件能表达意图，就优先使用系统组件：

- 顶层入口使用 `TabView`。
- 层级导航使用 `NavigationStack`。
- 可扫描列表使用 `List`、`Section`、`.insetGrouped`。
- 搜索使用 `.searchable()`。
- 设置、诊断、表单型配置使用 `Form`。
- 局部任务使用 `sheet`，关键确认使用 `alert` 或 `confirmationDialog`。
- 固定底部操作或答题 dock 使用 `safeAreaInset(edge: .bottom)`。

只有当系统组件无法表达训练交互时，才创建自定义组件，例如 Arena 答题 dock、S-V-O 高亮、FSRS 分布条。

### 2. 品牌色是强调，不是背景

OPUS violet 是 tint 和主操作强调色，不是大面积背景色。

适合使用品牌色：

- 主 CTA 背景。
- 选中的 Tab、筛选项或 active state。
- 链接和可交互文本。
- AI/Wand 入口。
- 中性句子里的少量重点强调。

不适合使用品牌色：

- 整个卡片标题。
- 装饰性渐变。
- 大面积背景。
- 普通非交互图标。
- 非交互标签。

### 3. 内容高于装饰

多数 OPUS iOS 页面是任务界面。用户应该一眼知道自己在哪里、下一步做什么、当前状态如何。

默认层级：

1. 当前任务或目的地。
2. 必要操作。
3. 进度与状态。
4. 次级说明。
5. 调试或元信息。

任何装饰元素如果抢走前三层注意力，都应该删掉或降级。

### 4. 认知安全是设计要求

目标用户可能因为信息过载而退出。设计必须降低心理压力。

- 每个屏幕或区块只保留一个清晰主操作。
- 避免顶部和底部同时堆满控制项。
- 空态要解释发生了什么，并给出下一步。
- 除非任务需要，不展示刺激焦虑的 backlog 数字。
- 文案短、具体、中文优先。
- 切换 Tab 或从详情返回时保留进度、筛选和滚动上下文。

## 排版

### 默认策略

使用系统 text styles，不用固定字号作为全局 token。这样可以自然支持 Dynamic Type、Bold Text 和系统字重。

推荐映射：

| 意图 | SwiftUI 样式 | 说明 |
| --- | --- | --- |
| 顶层页面标题 | `.largeTitle` 或 `.title` | 尽量使用系统导航标题。 |
| 页面引导标题 | `.title2.bold()` | 少量使用，避免营销页式 hero。 |
| Section 标题 | `.headline` 或 `.subheadline.weight(.semibold)` | 颜色保持中性。 |
| 卡片/列表标题 | `.headline` | 密集列表不要用自定义 18pt 标题。 |
| 正文 | `.body` | 默认阅读和任务文本。 |
| 次级正文 | `.callout` 或 `.subheadline` | 使用 `.secondary`。 |
| Caption | `.caption` / `.caption2` | 不小于 `.caption2`。 |
| 指标数字 | `.title2.monospacedDigit().bold()` | 使用等宽数字，不要整套 UI 都 monospaced。 |
| 数据/技术标签 | `.caption.monospaced()` | 仅用于 ID、延迟、批次、题号。 |
| 简报标题 | `.title3`，必要时 `.serif` | 衬线只用于阅读内容，不用于 UI chrome。 |

### 避免

- 全局默认使用 `.rounded`。
- 在可复用 UI 中硬编码字号。
- 大量 uppercase + tracking 标签。
- 一个组件内混用多种字体气质。
- 对超过两行的文本使用过紧行距。

### Dynamic Type

所有布局必须在无障碍字号下可读。

- 使用 `ViewThatFits`、自适应 stack 和多行文本，不截断关键信息。
- 无障碍字号下，横向 metadata 行应该能变成纵向排列。
- 图标承载含义时，应跟随文本尺度放大。
- Vocabulary、Arena 等密集页面至少用 `.accessibility3` 检查。

## 颜色

### Surface 色

优先使用系统语义色：

- 分组任务/列表背景：`Color(.systemGroupedBackground)`。
- 阅读或纯内容背景：`Color(.systemBackground)`。
- 分组 surface/card：`Color(.secondarySystemGroupedBackground)`。
- 嵌套弱 surface：`Color(.tertiarySystemGroupedBackground)`。
- 主文本：`.primary`。
- 次级文本：`.secondary`。
- 分隔线：`Color(.separator)` 或 `Divider`。

自定义 HSL 色必须包在语义名称后面，并提供 Light、Dark、Increased Contrast 变体。

### Accent 与状态

交互强调只保留一个主 tint：

- OPUS brand: violet/indigo。

状态色只在表达状态时使用：

| 状态 | 色系 | 必须配合 |
| --- | --- | --- |
| 成功 / mastered / ready | Green | 文案或 checkmark。 |
| 警告 / learning / due soon | Orange 或 amber | 文案或 caution icon。 |
| 错误 / destructive / leech / failed | Red | 文案和 icon。 |
| 信息 / context / AI support | Blue 或 violet | 标签或 symbol。 |
| 禁用 / locked | Gray | disabled 状态和说明。 |

禁止只靠颜色表达信息。彩色边框没有文字或图标时不算完整状态。

### Dark Mode

Dark Mode 应该原生、克制，不要默认做成 Web 端的 `Deep Space`。

推荐：

- 系统背景。
- overlay 和 dock 使用 Material。
- 更柔和的 separator。
- 状态底色降低饱和度。

避免：

- 非系统语义的纯黑大面积界面。
- 霓虹 glow。
- 大面积 violet/blue 渐变。
- 每张卡都 glassmorphism。

## Surface 与层级

### 默认 surface 策略

多数内容应落在以下形态之一：

1. 行、设置、诊断、词库、历史：`List` + `.insetGrouped`。
2. 首页和训练 Hub：`ScrollView` + 分组 section。
3. 主动训练：focus surface + 底部 Material dock。
4. 长文简报：reader surface。

### 卡片

卡片只用于高信号模块：

- 首页主任务。
- FSRS 摘要。
- 训练模式预览。
- Arena 节点预览。
- Reader metadata。
- 空态、错误态、加载态区块。

卡片规则：

- 圆角通常 12-16pt。
- 优先使用细 separator，不依赖重阴影。
- 禁止 card 套 card。
- 避免重 elevation。
- 除非浮在动态内容上，否则不要加装饰性 blur。
- 标题保持中性色。

### Material

Material 只按语义使用：

- 底部答题 dock：根据对比度使用 `.regularMaterial` 或 `.ultraThinMaterial`。
- 浮动 Tab/accessory：优先系统 tab bar 或 material。
- Sheet：默认系统 sheet 背景，只在内部 scoped panel 使用自定义 material。
- Toolbar/navigation：交给系统处理半透明效果。

Material 不能替代颜色设计。如果文字在 Material 上对比不足，应该换更厚的 material 或改成实色语义 surface。

## 布局

### 屏幕几何

- 文本和控件必须尊重 safe area。
- `.ignoresSafeArea()` 只用于背景。
- 最小点击热区 44x44pt。
- 主继续操作优先放在底部 thumb zone。
- 持久底部控件使用 `safeAreaInset(edge: .bottom)`，不要靠手写 `padding(.bottom, 120)` 兜底。
- 支持 iPhone SE 到 Pro Max 宽度。
- 避免固定卡片宽度，使用 flexible frame 和 adaptive grid。

### 间距

使用 8pt 节奏：

- 精细间距：4pt。
- 紧密组：8pt。
- 常规 stack：12-16pt。
- Section 间距：24-32pt。
- 屏幕横向 padding：根据密度使用 16-20pt。

操作密集页可用 16pt 屏幕 padding；阅读页可以更宽松。

## 导航

### 顶层结构

当前五 Tab 架构合理：

- 首页
- 训练
- 竞技
- 词库
- 简报

规则：

- 标签短且中文。
- 图标使用 SF Symbols。
- 顶层 Tab 稳定，不禁用、不隐藏。
- 选中态用 OPUS tint，但 tab bar 背景保持系统/material。

### 标题与 Toolbar

顶层 Tab 默认使用系统导航标题。

- 顶层 section：默认 large title，除非页面有充分理由使用自定义 header。
- 详情和训练页：inline title。
- Toolbar action 使用 `.confirmationAction`、`.cancellationAction`、`.topBarTrailing` 等系统 placement。
- 避免同时出现自定义 header 和系统 navigation title。

首页可以保留轻量 greeting，但必须和其他 Tab 保持一致。

### Push vs Sheet

持久目的地使用 push：

- Vocabulary detail。
- Training session。
- Arena mission。
- Briefing reader。

局部任务使用 sheet：

- Diagnostics。
- Wand analysis。
- 不值得全屏的 filter。
- 轻量配置。

每个 sheet 都必须有清晰 dismiss 路径。优先使用系统 toolbar cancel/close placement。

### 沉浸式训练例外

部分训练流程可以降低全局 chrome，但必须同时满足：

- 用户处于主动 drill 或 mission。
- 有清晰退出/返回路径。
- 进度可见。
- 下一步操作明显。
- 返回后保留 Tab 状态。

## 组件

### Button

默认层级：

1. Primary：prominent filled button，每屏或每 section 最多一个。
2. Secondary：bordered 或 neutral filled button。
3. Tertiary：borderless text 或 icon button。
4. Destructive：使用 role-based destructive style。

规则：

- 尽量使用系统 `Button` role 和 style。
- 相邻按钮尺寸保持一致，用 style 区分优先级。
- 常规按钮不使用渐变。
- icon-only button 必须 44pt 热区并提供 accessibility label。
- 触觉反馈只用于有意义的 press，不要每个轻触都震动。

### List 和 Row

以下场景优先使用 `List`：

- Vocabulary list。
- Briefing history。
- Diagnostics。
- Settings-like controls。
- 文本为主的训练模式目录。

以下场景可使用自定义卡片：

- Home summary。
- Feature comparison。
- Arena map-like structure。
- Drill prompt/answer zone。

Row 应支持：

- 打开详情时有 disclosure affordance。
- 常用操作使用 swipe actions。
- 状态标签 inline 展示。
- 大字号下可多行显示。

### Filter

根据选择类型使用对应原生控件：

- 2-4 个互斥选项：segmented control。
- 更长选项集：menu picker。
- 文本查询：search field。
- 短分类快速筛选：horizontal chips。
- 复杂组合筛选：sheet。

不要在页面顶部堆多条 horizontal chip rail，导致 search 和内容被挤走。

### Badge

Badge 用于表达状态，不用于装饰。

规则：

- 颜色必须配文案。
- 文案短。
- 除技术状态外，避免 all-caps。
- 形状优先系统 capsule。
- 除非表达 active work，不做无限循环动画。

### Progress

线性进度使用原生 `ProgressView`。FSRS 状态分布等分布型信息可以使用自定义 segmented meter。

每个进度视觉都要有可读文本等价物。

### State View

状态视图尽量出现在受影响区域内。

Loading：

- 内容加载优先使用 skeleton 或 section-level progress。
- App launch 和 authentication restore 可以全屏 loading。
- 用户操作后必须立即给等待反馈。

Empty：

- 说明什么为空。
- 说明为什么可能为空。
- 有价值时提供一个下一步。

Error：

- 中文友好消息。
- 可恢复错误提供 retry。
- 只有必须用户处理时才使用强烈破坏性颜色。

## Motion 和 Haptics

动效用于解释状态变化，不用于取悦。

推荐：

- 使用系统 sheet/navigation transition。
- 答案选择和进度移动使用短 spring 或 smooth animation。
- 可用时使用 `symbolEffect` 表达小图标状态变化。
- 成功、警告、错误、答题提交使用 haptics。

必须尊重：

- `accessibilityReduceMotion`
- `accessibilityReduceTransparency`
- `colorSchemeContrast`

避免：

- 重复装饰动画。
- 密集内容上的大幅 scale。
- 把动效作为唯一反馈渠道。

## 页面级规范

### Home

目标：快速回到训练并获得平静定位。

- 使用系统导航或克制 greeting header。
- Diagnostics 放在 toolbar 或次级入口。
- 展示一个主训练操作。
- FSRS 摘要紧凑、不过度制造焦虑。
- 卡片用于摘要，不用于每一行。

### Training Hub

目标：选择下一条训练路径。

- 优先分组 section。
- 模式目录使用 row。
- 推荐任务可用 featured card。
- 不可用模式展示为带说明的 disabled row，不要隐藏。

### Session Runner

目标：低认知负荷完成当前 drill。

- inline title。
- 极少 chrome。
- prompt/content 放在一个清晰 focus surface。
- 答案控件靠近底部。
- 进度可见。
- continue/exit 路径明确。
- 答案结算和完成时给 haptics。

### Arena

目标：挑战感明确，但不过载。

- Overview 可使用卡片或 map-like nodes，但层级必须清楚。
- Active mission 使用 Material bottom dock。
- 题号导航必须可达。
- 答案颜色必须配 label/icon。

### Vocabulary

目标：扫描、搜索、筛选、查看详情。

- 使用 `.searchable()`。
- 优先 grouped `List`，不要整页 custom card stack。
- 高频筛选靠近 search；复杂筛选放 sheet/menu。
- detail 使用 push 或 sheet 均可，但模式必须一致。

### Briefing

目标：阅读和分析不打断心流。

- Reader 内容文本优先。
- 正文使用 Dynamic Type body。
- Wand 使用 contextual sheet。
- 长正文不要包在重卡片里。
- 衬线最多用于文章标题，正文优先可读性。

### Auth

目标：快速恢复信任。

- 使用简单系统 form layout。
- field error inline 展示。
- 登录文案短而清楚。
- 支持 secure text entry、keyboard type、return key flow。
- 如果产品需要第三方登录 parity，再加入 Sign in with Apple。

### Diagnostics

目标：检查环境并恢复配置问题。

- 使用 `Form` 或 grouped `List`。
- 使用 `LabeledContent`。
- 调试语言精确。
- 破坏性操作必须确认。

## 当前代码迁移方向

### Phase 1: Foundation

- 将 `OpusTypography` 改成系统 text styles 的封装，减少固定字号。
- 颜色迁移到系统 semantic colors + OPUS tint + 状态色。
- 所有 icon-only 控件补足 44pt。
- 自定义颜色补 increased contrast 方案。

### Phase 2: Navigation and Surfaces

- 顶层页面默认不隐藏 navigation bar。
- 适合列表的页面从 card stack 迁移到 `List`。
- 持久底部控件从手写 padding 迁移到 `safeAreaInset`。
- 减少装饰渐变和阴影。

### Phase 3: Page Passes

- Vocabulary：searchable grouped list。
- Training：分组模式目录 + 一个推荐卡片。
- Briefing：reader-first typography + contextual Wand sheet。
- Arena/Session：focus surface + Material bottom dock。
- Home：克制 summary layout，避免 Web Dashboard 化。

## Do / Don't

| Do | Don't |
| --- | --- |
| 使用系统 text styles。 | 在可复用 UI 中硬编码字号。 |
| 使用系统 semantic colors。 | 用自定义 HSL 铺满整个界面。 |
| 列表使用 `List`。 | 每一行都包 custom card。 |
| 每屏一个 prominent 主操作。 | 多个 CTA 互相竞争。 |
| OPUS violet 用作 tint。 | 大面积 violet 装饰背景。 |
| dock 和 overlay 使用 Material。 | 每个 surface 都 glassmorphism。 |
| 保留 Tab、滚动和筛选状态。 | 切换页面后重置上下文。 |
| 颜色配合 label/icon。 | 只靠颜色表达状态。 |
| 支持 Dynamic Type。 | 截断或裁切关键信息。 |
| 训练页保持专注。 | 所有页面都做成沉浸式自定义 UI。 |

## Review Checklist

iOS UI 变更上线前检查：

- [ ] 除已批准的主动训练页外，页面使用原生导航。
- [ ] 文本使用系统样式或可随 Dynamic Type 缩放。
- [ ] 所有交互控件至少 44pt。
- [ ] 关键内容尊重 safe area。
- [ ] 颜色语义清楚，并兼容 Light、Dark、Increased Contrast。
- [ ] 状态不只靠颜色表达。
- [ ] 适合列表的内容使用原生 row。
- [ ] Sheet 有明确 dismiss。
- [ ] Loading、empty、error 状态完整。
- [ ] Reduce Motion 和无障碍大字号不破坏布局。
- [ ] OPUS 品牌可感知但克制。

## 参考

- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Designing for iOS: https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
- Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Color: https://developer.apple.com/design/human-interface-guidelines/color
- Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars/
- Buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Apple Design Resources: https://developer.apple.com/design/resources/
- Platform Design Skills iOS skill: https://github.com/ehmo/platform-design-skills/tree/main/skills/ios
