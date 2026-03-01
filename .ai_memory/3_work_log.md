# 开发流水账

## 2026-01-17
- 初始化 AI 记忆系统
- 分析项目文档 (PRD, TDD, TASK_LIST, UI_STYLE)
- 发现当前项目仅有基础骨架，需要完整初始化

## 2026-03-01
- 创建了 `FloatingDockClient` 并在 5 个主入口页 (simulate, arena, vocabulary, weaver, profile) 注入底部导航，适配 PWA 场景下的返回逻辑。
- 调整了这些入口页面的 scroll main 容器的底部 padding，以防止内容被导航栏遮挡。
- 执行 PWA 原生化分析与架构审计，并通过全局 CSS 重写 (`touch-callout`, `tap-highlight`)、按需文本选择控制 (`user-select: none`) 提升移动端触感，后续限定为主视图移动端尺寸生效。
- 引入了 iOS 风格深色毛玻璃 (Vibrancy & Blur) 设计，对 `GlobalHeader`, `FloatingDock` 及 `WeaverConsole` 控制栏实施了 `backdrop-blur-2xl` 透贴。
- 设计并实现了端到端 Haptic Touch (偏好设置驱动的 Web Vibration API)，作用于导航切换、Arena 答题、Weaver 生成等核心交互节点，达成物理按压的沉浸式体验。
- 对齐 iOS Typography & Safe Margins 原则：全面重构核心阅读器与答题卡片的行高至 `1.6` 比例，并严格约束交互按钮拥有至少 `56px` 的热区，预防误触。
- 深化定制 Vaul 抽屉动画，实现纯正的 iOS Modal Presentation：全局启用背景景深缩放，并统一各业务抽屉组件高度为 `96vh`、圆角重置为 `20px`。
