# 当前任务状态

- **当前任务**: 修复 `dashboard/vocab/[word]` 页面加载时报出的 Hydration 错误（在 `<StickyHeader>` 下游的下拉菜单触发按钮由于 Radix ID 不匹配引起）。
- **状态**: ✅ 已完成
- **详细进展**:
  1. 通过控制台 Error 分析，错误由 `<DropdownMenuTrigger asChild>` 包裹的 `<Button>` 引起。
  2. 此类问题多发于 Next.js App Router (Server Rendered) 和 React 18+ Client Component 结合使用时，`asChild` 模式导致组件转发 Ref 时内部生成的 `id` 不一致。
  3. 已在 `StickyHeader.tsx` 中移除了 `asChild` 及内置的 `<Button>`，直接将原按钮样式应用到 `<DropdownMenuTrigger>`，从而避免了 Radix Primitive 的双层 ID 转发错乱。
  4. 重新执行 build 消除潜在代码错误。
- **下一步行动**: [等待输入] 问题已修复，补丁在 `components/vocabulary/detail/StickyHeader.tsx`。是否执行 Git 提交并结束当前查错阶段？
