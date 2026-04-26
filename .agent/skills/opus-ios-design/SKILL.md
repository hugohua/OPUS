---
name: opus-ios-design
description: 用于设计、审查或修改 OPUS 原生 iOS SwiftUI/UIKit 界面，包括 iOS 视觉风格、HIG 对齐、Dynamic Type、无障碍、导航、surface 体系，以及从 Web/Tailwind UI 向原生 iOS 风格迁移的任务。
---

# OPUS iOS Design

使用此 skill 保证 OPUS iOS 界面原生、克制、可访问，并符合产品的认知安全目标。

## 必读上下文

在做任何 iOS UI 决策或审查前，先读：

1. `docs/ios-design-style-guide.md`：OPUS iOS 设计真相源。
2. `.agent/rules/000-critical-language.md`：聊天和用户可见文案必须使用简体中文，技术术语除外。
3. `.agent/rules/SYSTEM_PROMPT.md`：产品定位和认知安全约束。

如果全局 `ios-design-guidelines` skill 可用，将它作为 Apple HIG 通用审计层；OPUS 专属取舍以本项目文档为准。

## 决策顺序

规范冲突时按此优先级处理：

1. Apple 平台惯例和无障碍预期。
2. `docs/ios-design-style-guide.md`。
3. OPUS 产品与认知安全规则。
4. 通用 `ios-design-guidelines` 检查。
5. Web `docs/ui-rules.md`，只用于品牌语义和状态命名。

## 工作规则

- 优先使用原生 SwiftUI/UIKit 组件，不复制 Web 组件。
- 使用系统 text styles 和 Dynamic Type，避免固定字号 token 主导可复用 UI。
- 使用系统 semantic colors；OPUS violet 只作为克制 tint 和主操作强调。
- 标准流程优先使用 `List`、`Section`、`Form`、`.searchable()`、`NavigationStack`、`TabView`。
- 自定义卡片只用于高信号摘要、训练 prompt、Arena 结构和状态区块。
- 所有交互热区至少 44x44pt。
- 尊重 safe area；`.ignoresSafeArea()` 只用于背景。
- 每个状态色都必须配合文字、图标或 accessibility 含义。
- 固定底部答题 dock 或继续操作使用 `safeAreaInset(edge: .bottom)`。
- 用户可见 UI 文案保持简体中文。

## OPUS 专属例外

沉浸式训练页可以降低全局 chrome，但必须同时满足：

- 用户正在主动 drill 或 mission。
- 进度可见。
- 下一步操作明显。
- 有清晰退出/返回路径。
- 返回后保留 Tab 状态。

## 审查输出格式

做设计审查时按此结构输出：

1. `结论`：对齐、部分对齐或不对齐。
2. `必须修正`：HIG、无障碍或认知安全 blocker。
3. `建议优化`：提升原生感的改进。
4. `可保留`：有理由保留的 OPUS 自定义设计。
5. `验证`：需要运行的 simulator、Dynamic Type、Dark Mode、Reduce Motion 或对比度检查。

涉及代码时，给出具体文件和行号。
