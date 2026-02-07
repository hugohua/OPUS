# SSE 流式处理架构 (Universal Streaming Utility)

## 概述

基于 `tuoye` 项目的成功模式，OPUS 实现了标准化的 LLM 流式响应处理工具，位于 `lib/streaming/sse.ts`。

**核心目标**:
- ✅ **DRY (Don't Repeat Yourself)**: 消除重复的流式处理代码
- ✅ **标准化 SSE 格式**: 统一事件结构 `{type, data}`
- ✅ **Production-Ready**: 完善的错误处理、日志和回调机制
- ✅ **开箱即用**: 一行代码返回 SSE Response

---

## 架构设计

### 单例 OpenAI 客户端

```typescript
let _openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
    if (!_openaiClient) {
        _openaiClient = new OpenAI({
            apiKey: process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY,
            baseURL: process.env.DASHSCOPE_BASE_URL || 
                     "https://dashscope.aliyuncs.com/compatible-mode/v1"
        });
    }
    return _openaiClient;
}
```

**设计原则**:
- 全局共享 OpenAI SDK 实例（避免重复连接）
- 自动读取环境变量（优先 DashScope，Fallback OpenAI）
- 懒加载（首次调用时初始化）

---

## 核心 API

### `handleOpenAIStream(messages, options)`

**签名**:
```typescript
export async function handleOpenAIStream(
    messages: ChatCompletionMessageParam[],
    options?: HandleOpenAIStreamOptions
): Promise<Response>
```

**Options**:
```typescript
interface HandleOpenAIStreamOptions {
    // **Unified Config**:
    //   - `OPENAI_API_KEY`: 统一 API Key
    //   - `OPENAI_BASE_URL`: 统一 Base URL
    //   - `AI_MODEL_NAME`: 默认模型 (e.g. qwen-full)
    model?: string;              // 默认: AI_MODEL_NAME || "gpt-4o"
    temperature?: number;        // 默认: 0.7
    errorContext?: string;       // 日志前缀，默认: "OpenAI Stream"
    onContent?: (chunk: string) => void;     // 每个 chunk 回调
    onComplete?: (fullText: string) => void; // 完成回调
}
```

**返回值**:
标准 Next.js `Response` 对象，Content-Type 为 `text/event-stream`。

---

## SSE 事件格式

### 标准事件类型

```typescript
type SSEEvent = 
    | { type: 'content'; data: string }      // 流式内容片段
    | { type: 'done' }                       // 流式完成
    | { type: 'error'; error: string };      // 错误事件
```

### 实际输出示例

```
data: {"type":"content","data":"Hello"}

data: {"type":"content","data":" world"}

data: {"type":"done"}
```

---

## 使用场景

### 1. WeaverLab (L3 故事生成)

**文件**: `app/api/weaver/generate/route.ts`

```typescript
import { handleOpenAIStream, buildMessages } from '@/lib/streaming/sse';

export async function POST(req: Request) {
    const userPrompt = buildWeaverUserPrompt({...});
    const messages = buildMessages(userPrompt, WEAVER_SYSTEM_PROMPT);
    
    return handleOpenAIStream(messages, {
        model: "qwen-plus",
        temperature: 0.7,
        errorContext: "WeaverLab Generation",
        onComplete: (text) => {
            console.log(`Generated story: ${text.length} chars`);
        }
    });
}
```

**效果**:
- 从 **87 行** 缩减到 **62 行**
- 移除手动 SSE 包装逻辑
- 统一错误处理

---

### 2. 未来扩展场景

**潜在应用**:
- L2 SmartContent 流式生成（如需实时反馈）
- 对话式交互功能
- Multi-Turn Chat (需保留对话历史)

**示例代码**:
```typescript
export async function POST(req: Request) {
    const { history, userInput } = await req.json();
    
    const messages = [
        { role: "system", content: "System prompt..." },
        ...history,
        { role: "user", content: userInput }
    ];
    
    return handleOpenAIStream(messages, {
        onComplete: async (text) => {
            // 保存对话历史到数据库
            await saveChatHistory(userId, text);
        }
    });
}
```

---

## 前端集成

### React Hook 示例

```typescript
const [text, setText] = useState('');
const [isLoading, setIsLoading] = useState(false);

const handleStream = async () => {
    setIsLoading(true);
    const response = await fetch('/api/my-endpoint', {
        method: 'POST',
        body: JSON.stringify({ prompt: "..." })
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
                        setText(prev => prev + data.data);
                        break;
                    case 'done':
                        setIsLoading(false);
                        break;
                    case 'error':
                        console.error(data.error);
                        setIsLoading(false);
                        break;
                }
            }
        }
    }
};
```

---

## 技术细节

### 1. `for await` 流式迭代

参考 `tuoye` 项目模式，使用 OpenAI SDK 的标准异步迭代器：

```typescript
const completion = await openai.chat.completions.create({
    model,
    messages,
    stream: true
});

for await (const chunk of completion) {
    const content = chunk.choices[0]?.delta?.content || '';
    // 处理 chunk...
}
```

**优势**:
- SDK 内部处理 HTTP 连接、重连逻辑
- 自动解析 OpenAI SSE 格式
- 比手动 `fetch` + `ReadableStream` 更稳定

---

### 2. ReadableStream 包装

将 `for await` 迭代器包装为 Next.js 兼容的 `ReadableStream`：

```typescript
const stream = new ReadableStream({
    async start(controller) {
        for await (const chunk of completion) {
            const event = { type: 'content', data: chunk };
            const sseData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(sseData));
        }
        controller.close();
    }
});

return new Response(stream, {
    headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    }
});
```

---

### 3. 错误处理机制

**三层保护**:
1. **Try-Catch 包裹整个流**
2. **错误通过 SSE 发送到前端** (`{type: 'error'}`)
3. **日志记录**（带 `errorContext`）

```typescript
catch (error) {
    console.error(`[${errorContext}] Stream Error:`, error);
    
    const errorEvent = {
        type: 'error',
        error: error instanceof Error ? error.message : String(error)
    };
    
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
    controller.close();
}
```

---

## 环境变量配置

工具自动读取以下环境变量（优先级从高到低）:

```env
# DashScope 配置（优先）
DASHSCOPE_API_KEY=sk-xxx
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL_NAME=qwen-plus

# OpenAI 配置（Fallback）
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
```

---

## 调试与监控

### 日志输出

所有错误自动输出到控制台：
```
[WeaverLab Generation] Stream Error: Connection timeout
```

### 前端错误捕获

```typescript
switch (data.type) {
    case 'error':
        // 显示友好错误提示
        toast.error(data.error);
        break;
}
```

---

## 最佳实践

### 1. 明确 errorContext

便于日志追踪和问题定位：
```typescript
errorContext: "L2 Batch Generation - Scenario: Business Email"
```

### 2. 使用 onComplete 做后处理

避免在流式过程中写数据库（性能问题）：
```typescript
onComplete: async (fullText) => {
    await prisma.generatedContent.create({
        data: { text: fullText, userId }
    });
}
```

### 3. 前端防抖优化

避免高频 `setState` 导致的性能问题：
```typescript
const debouncedUpdate = useMemo(
    () => debounce((text) => setText(text), 50),
    []
);

// 在 SSE 解析中使用
case 'content':
    debouncedUpdate(prev => prev + data.data);
```

---

## 与其他系统的集成

### 与 `lib/ai/client.ts` 的关系

**差异**:
- `lib/ai/client.ts`: 使用 **AI SDK** (`@ai-sdk/openai`) 用于 `generateObject` 等非流式场景
- `lib/streaming/sse.ts`: 使用 **OpenAI SDK** (`openai`) 专注于流式响应

**为何分开**:
1. AI SDK 的 `streamObject` 在 DashScope 兼容性上存在问题
2. OpenAI SDK 的 `chat.completions.create({stream: true})` 是业界标准，稳定性更高
3. 各司其职：AI SDK 处理结构化输出（Zod Schema），OpenAI SDK 处理流式文本

---

## 参考资源

- **实现参考**: [tuoye/server.js](file:///Users/hugo/github/tuoye/server.js) - `handleOpenAIStream` 函数
- **使用示例**: [WeaverLab Route](file:///Users/hugo/github/OPUS/app/api/weaver/generate/route.ts)
- **详细文档**: [lib/streaming/README.md](file:///Users/hugo/github/OPUS/lib/streaming/README.md)

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-02-01 | 初始实现，基于 tuoye 项目模式 |

---

## FAQ

### Q: 为什么不直接用 AI SDK 的 `streamText`?
**A**: AI SDK 与 DashScope Compatible Mode 存在兼容性问题。OpenAI SDK 是行业标准，稳定性更高。

### Q: 可以用于非 DashScope 的 LLM 吗？
**A**: 可以。只需修改 `baseURL` 指向任意 OpenAI 兼容接口（如 OpenRouter、Azure OpenAI）。

### Q: 如何添加流式限流？
**A**: 在 `onContent` 回调中加入 Rate Limit 逻辑：
```typescript
let chunkCount = 0;
onContent: (chunk) => {
    chunkCount++;
    if (chunkCount > 1000) {
        throw new Error("Content too long");
    }
}
```
