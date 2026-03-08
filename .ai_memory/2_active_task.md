# 当前任务状态

- **当前任务**: 在 dashboard/simulate 和 dashboard/arena 页面右上角的下拉操作中，由于之前已经加上了 profile 页面入口，现在继续补充“返回首页(Home)”的入口。
- **状态**: ✅ 已完成
- **详细进展**:
  1. 定位到了 Simulate 和 Arena 页面共用的右侧下拉菜单组件：`components/dashboard/header-action-dropdown.tsx`
  2. 在 `variant === 'arena'` 和 `variant === 'simulate'` 两种模式的下拉菜单（`HeaderActionDropdown`）中，在“个人主页 (Profile)”下方添加了“返回首页 (Home)”的 `DropdownMenuItem`。
  3. 配置了点击跳转到 `/dashboard` 并且使用了 `Home` 图标。
- **下一步行动**: [等待输入] Home 入口已成功添加，请核查 UI 显示效果，看看是否需要进一步调整。
