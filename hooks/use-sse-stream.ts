import { useState, useCallback } from "react";

interface UseSSEStreamOptions {
    onComplete?: (text: string) => void;
    onError?: (error: string) => void;
}

/**
 * Custom Hook for consuming SSE streams from lib/streaming/sse.ts
 * Based on docs/dev-notes/sse-streaming-architecture.md
 */
export function useSSEStream(options: UseSSEStreamOptions = {}) {
    const [text, setText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ✅ 解构 options，避免依赖整个对象
    const { onComplete, onError } = options;

    const startStream = useCallback(async (endpoint: string, body: Record<string, any>) => {
        setIsLoading(true);
        setText("");
        setError(null);

        // ✅ 添加超时保护
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            abortController.abort();
            setError("生成超时，请重试");
            setIsLoading(false);
        }, 60000); // 60秒超时

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: abortController.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No readable stream");

            const decoder = new TextDecoder();
            let buffer = "";
            let fullContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            switch (data.type) {
                                case "content":
                                    fullContent += data.data;
                                    setText(fullContent);
                                    break;
                                case "done":
                                    setIsLoading(false);
                                    onComplete?.(fullContent);
                                    break;
                                case "error":
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
            setIsLoading(false);
            onError?.(errorMessage);
        } finally {
            clearTimeout(timeoutId);
        }
    }, [onComplete, onError]); // ✅ 精确依赖

    return { text, isLoading, error, startStream };
}
