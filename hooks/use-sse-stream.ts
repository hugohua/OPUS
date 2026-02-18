import { useState, useCallback, useRef, useEffect } from "react";

interface UseSSEStreamOptions {
    onComplete?: (text: string) => void;
    onError?: (error: string) => void;
    onResponse?: (response: Response) => void;
}

/**
 * Custom Hook for consuming SSE streams from lib/streaming/sse.ts
 * 
 * v2.0 — RAF 缓冲批量渲染 (ChatGPT-style smooth streaming)
 * 
 * 核心优化:
 *   每个 token 不再直接 setState，而是累积到 ref buffer，
 *   通过 requestAnimationFrame 合并到一次渲染（~16ms/帧）。
 *   将 React 重渲染次数从 20-50次/秒 降至 ≤60次/秒（帧率对齐）。
 */
export function useSSEStream(options: UseSSEStreamOptions = {}) {
    const [text, setText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ✅ 解构 options，避免依赖整个对象
    const { onComplete, onError, onResponse } = options;

    // ... [Refs and Effects kept same] ...
    // ✅ RAF 缓冲: 累积 token 到 ref，按帧刷新
    const pendingTextRef = useRef("");    // 当前帧内待追加的文本
    const fullContentRef = useRef("");    // 完整内容（累积）
    const rafIdRef = useRef<number | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // ✅ Cleanup: 组件卸载时取消 RAF 和中止请求
    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    /**
     * 强制刷新缓冲区（用于 done/error 事件）
     * 确保最终内容一致性
     */
    const flushBuffer = useCallback(() => {
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        if (pendingTextRef.current) {
            const finalContent = fullContentRef.current;
            pendingTextRef.current = "";
            setText(finalContent);
        }
    }, []);

    /**
     * 调度一次 RAF 批量更新
     * 同一帧内的多个 token 会被合并成一次 setState
     */
    const scheduleFlush = useCallback(() => {
        if (rafIdRef.current !== null) return; // 已有 RAF 排队，跳过
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const snapshot = fullContentRef.current;
            pendingTextRef.current = "";
            setText(snapshot);
        });
    }, []);

    const startStream = useCallback(async (endpoint: string, body: Record<string, any>) => {
        // 中止之前的请求 (如果存在)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // 重置状态
        setIsLoading(true);
        setText("");
        setError(null);
        pendingTextRef.current = "";
        fullContentRef.current = "";

        // ✅ 新建 Controller 并绑定
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // ✅ 添加超时保护
        const timeoutId = setTimeout(() => {
            if (abortControllerRef.current === abortController) {
                abortController.abort();
                setError("生成超时，请重试");
                setIsLoading(false);
            }
        }, 60000); // 60秒超时

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: abortController.signal
            });

            // ✅ 触发响应回调 (用于获取 Header)
            if (onResponse) {
                onResponse(response);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No readable stream");

            const decoder = new TextDecoder();
            let sseBuffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split("\n");
                sseBuffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            switch (data.type) {
                                case "content":
                                    // ✅ RAF 缓冲: 不直接 setState，累积到 ref
                                    fullContentRef.current += data.data;
                                    pendingTextRef.current += data.data;
                                    scheduleFlush();
                                    break;
                                case "done":
                                    // ✅ 强制刷新确保最终内容完整
                                    flushBuffer();
                                    setIsLoading(false);
                                    onComplete?.(fullContentRef.current);
                                    break;
                                case "error":
                                    flushBuffer();
                                    setError(data.error);
                                    setIsLoading(false);
                                    onError?.(data.error);
                                    break;
                            }
                        } catch (parseError) {
                            console.error("Failed to parse SSE data:", line);
                        }
                    }
                }
            }
        } catch (err) {
            // ✅ AbortError 是预期行为（Strict Mode 双重调用 / 用户重新生成），静默忽略
            if (err instanceof DOMException && err.name === 'AbortError') {
                return;
            }
            flushBuffer();
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
            setIsLoading(false);
            onError?.(errorMessage);
        } finally {
            clearTimeout(timeoutId);
        }
    }, [onComplete, onError, onResponse, scheduleFlush, flushBuffer]); // ✅ 精确依赖

    return { text, isLoading, error, startStream, setText };
}
