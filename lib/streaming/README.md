# Universal SSE Streaming Utility

标准化 LLM 流式响应处理工具，基于 tuoye 项目的成功模式。

## 核心组件

### `handleOpenAIStream(messages, options)`

统一的 OpenAI SDK 流式处理封装，返回标准 SSE Response。

**特性**:
- ✅ 单例 OpenAI 客户端（自动配置 DashScope/OpenAI）
- ✅ 标准 SSE 格式 `{type: "content"|"done"|"error", data}`
- ✅ 完善的错误处理和日志
- ✅ 可选的 `onContent` 和 `onComplete` 回调

## 使用示例

### 基本用法

```typescript
import { handleOpenAIStream, buildMessages } from '@/lib/streaming/sse';

export async function POST(req: Request) {
    const { prompt } = await req.json();
    
    const messages = buildMessages(prompt, "You are a helpful assistant");
    
    return handleOpenAIStream(messages, {
        model: "qwen-plus",
        temperature: 0.7
    });
}
```

### 完整示例（带回调）

```typescript
import { handleOpenAIStream } from '@/lib/streaming/sse';

export async function POST(req: Request) {
    const messages = [
        { role: "system", content: "System prompt..." },
        { role: "user", content: "User input..." }
    ];
    
    return handleOpenAIStream(messages, {
        model: process.env.QWEN_MODEL_NAME || "qwen-plus",
        temperature: 0.7,
        errorContext: "My Feature",
        onContent: (chunk) => {
            // 可选: 记录指标
            console.log("Received chunk:", chunk.length);
        },
        onComplete: (fullText) => {
            // 可选: 保存到数据库、触发后处理等
            console.log("Generation completed:", fullText.length, "chars");
        }
    });
}
```

## 前端消费示例

```typescript
const response = await fetch('/api/my-endpoint', {
    method: 'POST',
    body: JSON.stringify({ prompt: "Hello" })
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
                case 'content':
                    // 累积显示
                    setText(prev => prev + data.data);
                    break;
                case 'done':
                    console.log('Stream completed');
                    break;
                case 'error':
                    console.error('Server error:', data.error);
                    break;
            }
        }
    }
}
```

## 项目中的应用

### 已重构
- ✅ **WeaverLab** (`/api/weaver/generate`) - L3 故事生成

### 待迁移
- 🔄 未来可迁移的流式场景（如需要）:
  - L2 SmartContent 批量生成
  - 对话式交互功能

## 配置

工具自动读取以下环境变量（优先级从高到低）:

```env
# Unified Config
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_MODEL_NAME=qwen-plus
```

## 调试

所有错误会：
1. 打印到控制台（带 `errorContext`）
2. 通过 SSE 发送到前端 `{type: 'error', error: "..."}`

## 最佳实践

1. **明确 errorContext**: 便于日志追踪
   ```typescript
   errorContext: "WeaverLab Generation"
   ```

2. **使用 onComplete 做后处理**: 如保存到数据库、触发通知
   ```typescript
   onComplete: async (text) => {
       await saveToDatabase(text);
   }
   ```

3. **前端防抖**: 避免高频 setState
   ```typescript
   const debouncedUpdate = debounce(setText, 50);
   ```

## 参考

- 设计灵感: [tuoye/server.js](file:///Users/hugo/github/tuoye/server.js)
- 实际应用: [WeaverLab Route](file:///Users/hugo/github/OPUS/app/api/weaver/generate/route.ts)
