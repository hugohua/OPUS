# 当前任务状态

- **当前任务**: 修复 `dashboard/vocab/[word]` 页面进入后，“情景快照”模块的音频一直在加载、无法生成音频的问题。
- **状态**: ✅ 已完成
- **详细进展**:
  1. 经排查数据库记录，用户查词 `factory` 的 SmartContent 记录其实早在今年2月份已经由 AI 生成。当时 TTS 没有同步生成。
  2. 当访问具有历史 SmartContent 缓存但无 `ttsHash` 音频的单词页面时，前端代码会发起轮询。
  3. 但后端的查询接口 `getOrGenerateL2Context` 在命中本地缓存后，如果发现 `ttsHash` 为空并未在后台拉起 TTS 生成任务，导致前端 60秒 一直处于“音频生成中...”的空等挂起状态。
  4. 已经为 `getOrGenerateL2Context` 打补丁。现在一旦读取到历史缓存但缺少音频，它会**立刻异步触发** `triggerTTSGeneration`，确保前端轮询在 1~2秒 后就能拿到对应的音频 URL，从而展示播放按钮。
- **下一步行动**: [等待输入] 问题已修复，补丁在 `actions/content-generator.ts`。是否执行 Git 提交？还是有其他特定需求？
