# Opus Header UX / UI 规范 (Top Navigation Design System)

这份规范确立了 Opus 头部导航的**唯一性真理（Single Source of Truth）**。作为系统的全局视觉锚点，Header 的设计必须克制，摒弃一切非必要元素。

这套规范约束前端开发与后续的 UI 扩展，确保系统在未来增加新模块时，顶层架构依然保持极度统一和高度克制。

---

## 一、 路由分发原则 (Variant Routing)

Header 只有两种变体，严格依据页面所在的**信息层级（Information Hierarchy）**进行互斥调用，禁止混用。

* **Variant A: 融合大厅头 (Global Fusion Header)**
  * **组件**: `components/ui/global-header.tsx`
  * **适用层级**：根路由 (`/`) 或一级子系统主页（如 `/arena`, `/simulate`）。
  * **用户心智**：“我在哪里？我处于什么状态？”（探索与分发）。

* **Variant B: 沉浸执行头 (Immersive Focus Header)**
  * **组件**: `components/ui/immersive-header.tsx`
  * **适用层级**：叶子节点路由，即具体的任务执行页（如单句闪电战、阅读狙击战）。
  * **用户心智**：“我要完成什么任务？我还能退出吗？”（专注与执行）。

---

## 二、 空间槽位约束 (Slot Anatomy & Constraints)

Header 被划分为左、中、右三个物理槽位（Slots）。为防止头部由于堆砌功能而变得臃肿，必须执行以下容量限制：

### Variant A (Global) 槽位规范

* **Left Slot (模块标识)**
  * **内容**：当前一级模块的标题（如 `The Arena`, `训练矩阵`）。
  * **约束**：**最多允许 1 个名词词组**。禁止在此处使用面包屑（Breadcrumb）或堆砌版本号等副标题。如果模块有运行状态（如就绪），可通过 **呼吸灯（Ping Dot）** 附加。

* **Center Slot (空白区)**
  * **约束**：**强制留白**。禁止在全局 Header 居中放置 Logo 或标题，保持视觉呼吸感。

* **Right Slot (全局操作与收敛区)**
  * **内容**：核心全局数据（如连胜天数/护盾）或统一的下拉操作收敛入口。
  * **约束**：最多允许 **2 个视觉单元**（例如 1 个数据胶囊 + 1 个操作按钮）。推荐在仅有标题的页面统一使用“三个点 `...`”的 DropdownMenu 交互（如 `HeaderActionDropdown`），用以收敛低频操作。

### Variant B (Immersive) 槽位规范

* **Left Slot (逃生舱/Exit)**
  * **内容**：返回（`←`）或关闭（`X`）按钮。
  * **约束**：强制使用单色线框图标（Icon only），尺寸固定。**绝对禁止使用带文字的“返回”按钮**。

* **Center Slot (上下文元数据)**
  * **内容**：当前任务的具体进度标签或章节名。
  * **约束**：必须相对于屏幕绝对居中，不受左右槽位宽度的影响。针对跳动的数字或标签，推荐使用等宽字体 (Monospace) 或包裹在一个药丸状背景块 (`rounded-full`) 中。

* **Right Slot (当前上下文操作)**
  * **内容**：与当前执行任务高度相关的次要操作（如：跳过、设置）。
  * **约束**：最多允许展示 2 个圆形图标。

---

## 三、 物理与滚动行为 (Physics & Scroll Behavior)

* **零边界 (Zero Boundaries)**：所有 Header 必须移除底边框（`border-b-0` 或 `border-transparent`），或者使用极淡的高光边框（如 `dark:border-white/10`）。层级区分仅依靠背景颜色的物理属性。
* **安全区下推 (Safe Area)**：必须带有 `pt-[calc(env(safe-area-inset-top)+0.75rem)]`，适配移动端设备的刘海/灵动岛。
* **滚动穿透拦截 (Scroll Penetration)**：
  * **Variant A (Global)**：采用纵向渐变遮罩 (`bg-gradient-to-b`)。主体容器务必使用 `pointer-events-none` 允许滚动穿透，子元素槽位单独声明 `pointer-events-auto` 恢复交互。模拟原生 App 的融合感。
  * **Variant B (Immersive)**：采用高强度毛玻璃 (`backdrop-blur-xl`)。由于执行页通常有进度条，进度条 (`progress` prop) 会吸附在 Header 最底部。

---

## 四、 避坑指南 (Do's & Don'ts)

| 规则维度 | 🟢 推荐做法 (Do) | 🔴 绝对禁止 (Don't) |
| --- | --- | --- |
| **高度控制** | 保持单行文本，严格控制上下 Padding (如 `pb-3`, `gap-3`)。 | 绝对禁止在 Left/Center Slot 堆砌多行副标题（如将 `BKT ENGINE ACTIVE` 放到第二行），这会导致 Header 巨高无比。 |
| **字体排印** | Header 文本遵循主文字规范：Sans-serif (标题 `text-xl`) 和 Monospace (数字/标签/呼吸灯辅助)。 | 绝对禁止在 Header 中使用超大字号 (`text-2xl` 及以上) 或 Serif 衬线体。 |
| **操作按钮** | 统一使用收敛的圆形/胶囊按钮 (Solid/Soft Fill)。 | 绝对禁止在 Header 中使用带有厚重阴影或实线边框的主操作矩形按钮。 |
| **品牌露出** | 通过系统级的呼吸灯颜色 (Emerald) 暗示运行状态。 | 绝对禁止在内部页面的 Header 强行塞入 Opus 的产品 Logo 或干扰性彩印。 |
| **状态呈现** | **严禁出现触发用户焦虑的数字（如：你有 50 词待背的 Review Hell）**，可用中性的展示方式如“累计存活天数🛡️”代替。 | 严禁添加带火苗 🔥 的倒计时或 Streak 催逼元素 (Anti-Spec 原则)。 |
