# Arena Dashboard 前端渲染方案

## 1. Zero-Wait SSR 架构重构
竞技场首页 (`app/dashboard/arena/page.tsx`) 已完成重构，从之前的带载流 Skeleton State 变成了全服务端的 Async Component。
- **并行请求**：通过 `getRadarData()` 与 `getActionRequiredNodes()` 在 SSR 阶段同时读取 L1 雷达池和 L3 行动提示池。
- **直出体验**：服务端一次性渲染骨架、文本与玻璃拟态层，极大抹平了用户的弱网等待焦虑。

## 2. 动态数学引擎与 SVG 雷达渲染
- 雷达图组件 `radar-chart.tsx` 不依赖 Echarts 等沉重的第三方可视化库，采用原生 `<svg>` 实现。
- **坐标系转换**：计算任意分数点 $r$ 在极点上的直角坐标 $$x = r imes \cos(heta), y = r imes \sin(heta)$$，通过改变 $\theta = 2\pi / N$ 支持自适应 $N$ 角形的底盘。
- **弹流动效 (Spring Entrance)**：用 `framer-motion` 是杀鸡用牛刀。组件里维护了一个初值全为 0 的 local state，`useEffect` $mount$ 之后利用 CSS `transition-all duration-1000 ease-out` 触发顶点舒展动画。让 "Zero-Wait" 直接渲染的 DOM 在客户端有了生命力。

## 3. 亮暗色对齐与可用性 (A11y/Color Contrast)
整个 Dashboard 遵循 `docs/ui-rules.md`：
- 在深色模式下，对低对比度的蓝色 `text-blue-600` 强行替换成了显眼的 `text-indigo-400`。
- 将背景卡片提纯为语义化、结构化的 Zinc 令牌组合。
- Action Required 列表自带 "All Clear" 防空窗冷启动兜底。不够 3 个选项时自动输出 Filler 元素保持 UI 的整洁与高度一致。
