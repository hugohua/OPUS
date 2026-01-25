# Opus Unified UI System (Technical Notes)

**Date**: 2026-01-25
**Version**: v1.0
**Status**: Implemented
**Related**: [Zero-Wait Architecture](./zero-wait-architecture-v1.md)

## 1. 设计哲学：The Smart Frame
为了解决页面导航不一致的问题，并适配移动端沉浸式学习体验，我们构建了 **Unified Header System**，核心理念是 **"Smart Frame"** —— 一个既能提供一致导航又能根据上下文变形的智能框架。

### 1.1 核心组件 (`components/ui/header.tsx`)
采用 **三段式插槽 (3-Slot Layout)** 布局，确保在任何屏幕尺寸下的布局稳定性：

1.  **Left (Navigation)**:
    *   固定为返回导航。
    *   **逻辑**: 默认 `router.back()`，支持覆盖（如 Drill 模式强制返回 Dashboard）。
    *   **交互**: 加大点击热区 (`w-10 h-10`)，防止误触。

2.  **Center (Context)**:
    *   采用 `absolute left-1/2 -translate-x-1/2` 绝对定位。
    *   **优势**: 即使左右两侧按钮宽度不一致（如左侧无按钮，右侧有长宽按钮），中间的标题/进度条依然严格居中。

3.  **Right (Actions)**:
    *   动态操作区 (`ReactNode`)。
    *   支持放置系统状态灯、菜单、暂停按钮等。

## 2. 变体系统 (Variants)
组件通过 `variant` 属性支持多种业务场景：

| Variant | 适用场景 | Center 内容 | Right 内容 | 数据源 |
| :--- | :--- | :--- | :--- | :--- |
| `default` | 管理后台, 模拟大厅 | **页面标题** (`h1`) | 系统状态 / 菜单 | `title` prop |
| `drill` | 训练 Session | **进度条** + **步数** | (预留) 暂停/退出 | `progress`, `stepLabel` |
| `reader` | 阅读器 (Future) | **文章标题** + **阅读时间** | 设置 | `title`, `subtitle` |

## 3. 视觉规范 (Deep Space Theme)
严格遵循项目 UI 规范 (`ui-rules.md`)：

*   **背景**: `bg-zinc-950/80` + `backdrop-blur-md` (高级毛玻璃效果)。
*   **边框**: `border-b border-white/5` (极细微的分割线，仅在深色模式下可见)。
*   **高度**: `h-14` (56px) —— 比标准的 64px 更紧凑，为移动端内容留出更多空间。
*   **层级**: `z-50`，通常配合 `relative` 或 `sticky` 使用。

## 4. 关键集成案例

### 4.1 队列管理后台 (`/dashboard/admin/queue`)
*   **Variant**: `default`
*   **特色**: 右侧集成了 `SystemStatusBadge`（带呼吸动画的 Online 指示器）。
*   **代码示例**:
    ```tsx
    <Header 
        variant="default" 
        title="队列控制台" 
        rightAction={<SystemStatusBadge />} 
    />
    ```

### 4.2 训练会话 (`SessionRunner`)
*   **Variant**: `drill`
*   **特色**: 实时绑定 `queue.length` 和 `currentIndex` 计算进度。
*   **代码示例**:
    ```tsx
    <Header
        variant="drill"
        progress={progressPercentage}
        stepLabel="SYNTAX DRILL 05 / 20"
        onBack={() => router.push('/dashboard')} // 强制回首页
    />
    ```

## 5. 组件代码结构
位于 `components/ui/header.tsx`。基于 Shadcn UI 生态，无额外重依赖。
