import { useEffect, useRef } from 'react';
import { generateAndPreloadAudio, PreloadTarget } from '@/lib/tts/preload';

/**
 * 受控并发执行器：限制同时在飞的请求数量，避免瞬间打满外部 API 限额
 */
async function runWithConcurrency<T>(
    items: T[],
    fn: (item: T) => Promise<void>,
    maxConcurrent: number
): Promise<void> {
    let index = 0;
    const workers = Array.from({ length: Math.min(maxConcurrent, items.length) }, async () => {
        while (index < items.length) {
            const currentIndex = index++;
            try {
                await fn(items[currentIndex]);
            } catch {
                // 预加载失败静默忽略
            }
        }
    });
    await Promise.all(workers);
}

interface UseAudioPreloadParams<T> {
    /** 
     * The master list of items to orchestrate 
     */
    items: T[];

    /** 
     * The current index of the user in the list 
     */
    currentIndex: number;

    /** 
     * A callback that takes a generic item and returns an array of necessary TTS parameters
     * (e.g. A quiz item might return two targets: Question Audio and Answer Audio).
     */
    extractTextFn: (item: T) => PreloadTarget[];

    /** 
     * How many items ahead of currentIndex to preload 
     * @default 3 
     */
    lookahead?: number;

    /** 
     * Global killswitch (e.g. `autoPlay` preference) 
     * @default true 
     */
    enabled?: boolean;
}

export function useAudioPreload<T>({
    items,
    currentIndex,
    extractTextFn,
    lookahead = 3,
    enabled = true
}: UseAudioPreloadParams<T>) {

    // Track which indices we have already issued fetch commands for
    const prefetchedIndicesRef = useRef<Set<number>>(new Set());
    // Track previous array instance to know when to start a new session
    const previousItemsRef = useRef<T[] | null>(null);

    // Watch for complete item swaps or index resets to clear the prefetch cache
    useEffect(() => {
        if (previousItemsRef.current !== items) {
            // Unconditionally clear if the pointer is at 0 and items changed
            if (currentIndex === 0) {
                prefetchedIndicesRef.current.clear();
            }
            previousItemsRef.current = items;
        }
    }, [items, currentIndex]);

    useEffect(() => {
        if (!enabled) return;

        // Debounce timer: wait 500ms before triggering prefetch.
        // If the user clicks "Next" wildly, this timeout is cleared and recreated rapidly.
        const timerId = setTimeout(async () => {

            const allTargets: PreloadTarget[] = [];

            // Calculate target range: [currentIndex + 1, currentIndex + lookahead]
            for (let offset = 1; offset <= lookahead; offset++) {
                const targetIndex = currentIndex + offset;

                // Stop iterating if out of bounds of the current list size
                if (targetIndex >= items.length) break;

                // Skip if we already dispatched preload requests for this specific index
                if (prefetchedIndicesRef.current.has(targetIndex)) continue;

                const targets = extractTextFn(items[targetIndex]);

                for (const target of targets) {
                    if (target.text) {
                        allTargets.push(target);
                    }
                }

                // Optimistically mark as prefetched so overlap loops don't touch it
                prefetchedIndicesRef.current.add(targetIndex);
            }

            // 使用受控并发（最多同时 2 个请求），避免瞬间打满 DashScope API 限额
            if (allTargets.length > 0) {
                console.log(`[useAudioPreload] Dispatching ${allTargets.length} generation requests ahead of ${currentIndex} (concurrency=2)`);
                await runWithConcurrency(allTargets, generateAndPreloadAudio, 2);
            }

        }, 500);

        // Cleanup the timeout if the user navigates away or moves index before 500ms
        return () => clearTimeout(timerId);
    }, [currentIndex, items, enabled, extractTextFn, lookahead]);

}
