# Audio Preload Architecture

本技术规范记录了 Opus 项目为实现 **Zero-Wait (零等待)** 听觉体验而构建的「全局音频预加载引擎」。

## 1. 核心理念 (Philosophy)

Opus 的核心交互准则围绕“流畅的心流 (Flow)”展开。在答题（Session/Drive）场景中，传统的“翻页 -> 请求音频 -> 播放”模式会带来网络 I/O 延迟，严重破坏沉浸感。
我们的解决方案是：**解耦 UI 渲染与音频获取时间线，利用浏览器底层缓存静默预载**。

- **Fail-Safe**：预加载失败不可阻断业务流。它仅仅是一个“渐进式增强 (Progressive Enhancement)”。
- **Side-Effect Isolation**：预请求不应该污染核心的状态机引擎 (`useDrillSession`)，必须作为一个外挂的泛型 Hook。
- **Network Storm Prevention**：严防用户快速跳题（Blitz 模式）带来的并发洪水，击穿 Next.js API 和并发配额。

---

## 2. 架构分解 (Architecture Layers)

引擎分为三层：

### Layer 1: 内存共享与哈希层 (`lib/tts/hash.ts`)
所有 TTS 资源基于对 `text_voice_language_speed` 属性群的 MD5 哈希作为绝对资源 ID。
我们导出了一个全区范围的 `ttsMemoryCache = new Map<string, string>()`：
- `preload.ts` 预加载成功后，会将拿到的音频源 URL 写入这个 Cache。
- `useTTS.ts` 播放前，不仅会查自己的内部状态，而且会**首先查询这个全局 `ttsMemoryCache`**。如果命中，直接 0 延迟播放，直接跳过向服务器 `/api/tts/generate` 的发问。

### Layer 2: 浏览器网络层 (`lib/tts/preload.ts`)
提供纯碎的 API 调用与 DOM 绑定函数：`generateAndPreloadAudio(target)`。
执行链路：
1. 请求后端的 Generator 返回长效直链。
2. 实例化 `new window.Audio(url)`，设置 `preload = 'auto'`，强行推入浏览器的 Native 原生媒体缓存区域 (Media Source Cache)。
3. 保存实例到 `preloadedAudiosCache` 阻止 JS 垃圾回收 (GC) 把这个孤立组件干掉。
4. 注册哈希进 `ttsMemoryCache`。

### Layer 3: React 调度框架 (`hooks/use-audio-preload.ts`)
真正被业务代码接入的中间件。设计为接收任意类型数组 `T[]` 的完全泛型。

**核心机制：**
1. **Debounce (防抖拦截)**: 挂载 `500ms` 的计时器。只有当用户的指针 (`currentIndex`) 停留在原地超过半秒，才会释放出对于未来几道题的抓取洪流。这完美化解了 Network Storm (并发风暴)。
2. **Lookahead (视野池)**: 默认往前看 `3` 个索引。
3. **Session Reset 防幽灵缓存 (`previousItemsRef` 守护)**: 由于我们记录了已经发过请求的 `Index` (`prefetchedIndicesRef: Set`) 以避免重复加载，如果在完全不重新 Mount 的情况下被强行塞入了新的 Session 数组，之前记录的 Index 1, 2, 3 会导致新局的前几道题无法发音预载。我们通过追踪数组引用内存地址变换来自动 `.clear()` 这些状态。

---

## 3. 集成指南 (Integration Guide)

当你在新的答题页面或者播放列表使用这套组件时：

### 1. 引入并定义提取器 (Extractor)
因为 Hook 是泛型的，它不知道你传进去的领域模型（可能是 `DriveItem` 或 `BriefingPayload` 或其他随便什么对象）里究竟哪些字段藏着需要发音的文本。所以你需要传入 `extractTextFn` 解包：

```typescript
import { useAudioPreload } from '@/hooks/use-audio-preload';
import { useSharedUserSettings } from '@/components/providers/user-settings-provider';

// 在你的渲染主组件内：
const { autoPlay } = useSharedUserSettings();

const extractSessionAudio = React.useCallback((item: YourCustomDataType) => {
    // 按需解析，如果这道题有 Question 和 Answer 双语，你可以 return 一个含有两项的数组。
    return [
        {
            text: item.rawTextToRead,
            voice: 'Cherry', // DashScopeVoice enum
            speed: 1.0
        }
    ];
}, []);
```

### 2. 挂载 Hook

```typescript
useAudioPreload<YourCustomDataType>({
    items: theDataArray,
    currentIndex: theCurrentIndexWeArePlaying,
    extractTextFn: extractSessionAudio,
    lookahead: 3,           // 默认预加载未来 3 题
    enabled: autoPlay       // 只有用户启用了设置才工作 (非常重要：节约无用流量)
});
```

---

## 4. 移动端 (Mobile Safari) 注意事项

iOS 对 HTML5 Canvas 和 Audio 有臭名昭著的防滥用策略：**必须存在由用户亲自触发的手势 Event (Click/Tap) 才允许系统播放或下载声音上下文**。

这意味着，这个纯挂载的后台预加载，能够顺畅工作的前提是：**在预加载执行前，用户已经在这个 DOM 页面上至少点过某个按钮**（例如开始游戏/继续测试）。由于在目前的答题架构中这点均已自然满足，我们不需要黑魔法的 Workaround。如果后续要在首页未交互状况下直接 preload，会面临静默加载失败的报错。这是 Progressive Enhancement 原则，顺其自然即可。
