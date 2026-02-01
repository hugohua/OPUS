/**
 * Universal SSE Streaming Utility
 * 
 * 参考 tuoye 项目的 handleOpenAIStream 模式
 * 提供统一的 OpenAI SDK 流式处理封装
 * 
 * 使用场景:
 * - WeaverLab (L3 故事生成)
 * - 未来的流式场景 (L2 例句批量生成、对话等)
 */

import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";

// ============================================================
// OpenAI 客户端初始化（支持 DashScope）
// ============================================================

let _openaiClient: OpenAI | null = null;

/**
 * 获取 OpenAI SDK 客户端实例（单例模式）
 * 自动读取环境变量配置 DashScope 或 OpenAI
 */
export function getOpenAIClient(): OpenAI {
    if (!_openaiClient) {
        _openaiClient = new OpenAI({
            apiKey: process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY,
            baseURL: process.env.DASHSCOPE_BASE_URL || process.env.OPENAI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
        });
    }
    return _openaiClient;
}

// ============================================================
// SSE 事件类型定义
// ============================================================

export type SSEEvent =
    | { type: 'content'; data: string }
    | { type: 'done' }
    | { type: 'error'; error: string };

// ============================================================
// 核心工具函数
// ============================================================

export interface HandleOpenAIStreamOptions {
    /** 模型名称，默认读取 QWEN_MODEL_NAME 或 qwen-plus */
    model?: string;
    /** 温度参数，默认 0.7 */
    temperature?: number;
    /** 错误上下文（用于日志），默认 "OpenAI Stream" */
    errorContext?: string;
    /** 内容回调（每个 chunk） */
    onContent?: (content: string) => void;
    /** 完成回调（全部内容） */
    onComplete?: (fullContent: string) => void;
}

/**
 * 处理 OpenAI SDK 流式响应，返回标准 SSE Response
 * 
 * @param messages - OpenAI 消息数组
 * @param options - 配置选项
 * @returns Next.js Response (SSE 格式)
 * 
 * @example
 * ```ts
 * export async function POST(req: Request) {
 *   const messages = [
 *     { role: "system", content: "You are a helpful assistant" },
 *     { role: "user", content: "Hello!" }
 *   ];
 *   return handleOpenAIStream(messages, {
 *     model: "qwen-plus",
 *     onComplete: (text) => console.log("Done:", text)
 *   });
 * }
 * ```
 */
export async function handleOpenAIStream(
    messages: ChatCompletionMessageParam[],
    options: HandleOpenAIStreamOptions = {}
): Promise<Response> {
    const {
        model = process.env.QWEN_MODEL_NAME || "qwen-plus",
        temperature = 0.7,
        errorContext = "OpenAI Stream",
        onContent,
        onComplete
    } = options;

    const openai = getOpenAIClient();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            let fullContent = "";

            try {
                // 调用 OpenAI SDK 创建流式响应
                const completion = await openai.chat.completions.create({
                    model,
                    messages,
                    stream: true,
                    temperature,
                });

                // 使用 for await 迭代流（tuoye 模式）
                for await (const chunk of completion) {
                    const content = chunk.choices[0]?.delta?.content || '';

                    if (content) {
                        fullContent += content;

                        // 发送 SSE 格式的内容事件
                        const event: SSEEvent = { type: 'content', data: content };
                        const sseData = `data: ${JSON.stringify(event)}\n\n`;
                        controller.enqueue(encoder.encode(sseData));

                        // 触发内容回调
                        if (onContent) {
                            onContent(content);
                        }
                    }
                }

                // 发送完成事件
                const doneEvent: SSEEvent = { type: 'done' };
                const doneSseData = `data: ${JSON.stringify(doneEvent)}\n\n`;
                controller.enqueue(encoder.encode(doneSseData));

                // 触发完成回调
                if (onComplete) {
                    onComplete(fullContent);
                }

                controller.close();

            } catch (error) {
                console.error(`[${errorContext}] Stream Error:`, error);

                // 发送错误事件
                const errorEvent: SSEEvent = {
                    type: 'error',
                    error: error instanceof Error ? error.message : String(error)
                };
                const errorSseData = `data: ${JSON.stringify(errorEvent)}\n\n`;
                controller.enqueue(encoder.encode(errorSseData));

                controller.close();
            }
        }
    });

    // 返回标准 SSE 响应
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    });
}

// ============================================================
// 辅助函数: 简化 Prompt 构造
// ============================================================

/**
 * 从简单的 prompt 字符串构造 messages 数组
 * @param prompt - 用户输入或完整 prompt
 * @param systemPrompt - 可选的系统提示词
 */
export function buildMessages(
    prompt: string,
    systemPrompt?: string
): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    return messages;
}
