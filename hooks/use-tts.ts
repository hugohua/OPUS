"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { generateAudioHash, ttsMemoryCache } from "@/lib/tts/hash";
import { TTSRequest, TTSResponse, TTSState } from "@/types/tts";
import { toast } from "sonner";

// Global audio object ensures that there is ONLY ONE AUDIO playing across the whole app.
// If multiple components (e.g. rapid Next clicking) trigger play(), the singleton will automatically halt the old one.
let globalAudio: HTMLAudioElement | null = null;
if (typeof window !== "undefined") {
    globalAudio = new window.Audio();
}

export function useTTS() {
    const [state, setState] = useState<TTSState>({
        status: "idle",
        url: null,
        error: null,
        duration: 0,
        currentTime: 0,
        isCached: undefined,
    });

    const currentHashRef = useRef<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stop();
        };
    }, []);

    const stop = useCallback(() => {
        // Cancel any pending fetch requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        if (globalAudio) {
            // Only stop if *this hook* was the last one to control globalAudio
            // Actually, for multiple Rapid next clicks, we should unconditionally stop globalAudio
            globalAudio.pause();
            globalAudio.currentTime = 0;
            // Clear event listeners so old hooks don't receive events meant for the new one
            globalAudio.oncanplaythrough = null;
            globalAudio.onplay = null;
            globalAudio.onended = null;
            globalAudio.onerror = null;
            globalAudio.ontimeupdate = null;
        }

        // Invalidate current hash to prevent pending audio from playing
        currentHashRef.current = null;
        setState((prev) => ({
            ...prev,
            status: "idle",
            currentTime: 0,
            isCached: undefined
        }));
    }, []);

    const play = useCallback(async (options: TTSRequest) => {
        // 1. Calculate Hash
        const hash = generateAudioHash({
            text: options.text,
            voice: options.voice,
            language: options.language,
            speed: options.speed,
        });

        // Stop previous gracefully
        stop();
        currentHashRef.current = hash;
        abortControllerRef.current = new AbortController();

        const isMemoryCached = ttsMemoryCache.has(hash);
        setState((prev) => ({ ...prev, status: "loading", error: null, isCached: isMemoryCached ? true : undefined }));

        try {
            let audioUrl = ttsMemoryCache.get(hash);

            if (!audioUrl) {
                // 2. Fetch from API (Generate directly, it handles cache)
                const res = await fetch("/api/tts/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(options),
                    signal: abortControllerRef.current.signal,
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || errData.detail?.error || "TTS API Error");
                }

                const data: TTSResponse = await res.json();

                if (!data.success || !data.url) {
                    throw new Error(data.error || "Failed to generate audio");
                }

                audioUrl = data.url;
                ttsMemoryCache.set(hash, audioUrl);

                if (currentHashRef.current === hash) {
                    setState((prev) => ({ ...prev, isCached: !!data.cached }));
                }
            }

            // Check if we aborted while fetching (e.g. user clicked Next)
            if (currentHashRef.current !== hash) return;

            // 3. Play Audio using Global instance
            if (!globalAudio) return;

            globalAudio.src = audioUrl;

            // Event Listeners (using assignment so only the *latest* hook receives events)
            globalAudio.oncanplaythrough = () => {
                if (currentHashRef.current === hash) {
                    globalAudio?.play().catch((e) => {
                        // Ignore abort errors which are normal when user interacts quickly
                        if (e.name !== 'AbortError') {
                            console.error("Autoplay failed", e);
                            setState((prev) => ({ ...prev, status: "error", error: "Autoplay blocked" }));
                        }
                    });
                }
            };

            globalAudio.onplay = () => {
                if (currentHashRef.current === hash) {
                    setState((prev) => ({ ...prev, status: "playing", url: audioUrl! }));
                }
            };

            globalAudio.onended = () => {
                if (currentHashRef.current === hash) {
                    setState((prev) => ({ ...prev, status: "idle", currentTime: 0 }));
                }
            };

            globalAudio.onerror = (e) => {
                if (currentHashRef.current === hash) {
                    console.error("Audio playback error", e);
                    setState((prev) => ({ ...prev, status: "error", error: "Playback error" }));
                }
            };

            // Update time
            globalAudio.ontimeupdate = () => {
                if (currentHashRef.current === hash && globalAudio) {
                    setState((prev) => ({
                        ...prev,
                        currentTime: globalAudio.currentTime,
                        duration: globalAudio.duration || 0
                    }));
                }
            };

            // Force load to trigger oncanplaythrough immediately if cached
            globalAudio.load();

        } catch (err: any) {
            if (err.name === 'AbortError') {
                // Ignore abort errors
                return;
            }
            console.error("TTS Error:", err);
            
            // UX Enhancement: Translate opaque fetch failures to understandable UI
            const errorMessage = err.message === 'fetch failed' 
                ? 'TTS Backend (Python Server) Unreachable. Please check if port 8000 is running.' 
                : err.message;
                
            toast.error(errorMessage);
            setState((prev) => ({ ...prev, status: "error", error: errorMessage }));
            currentHashRef.current = null;
        }
    }, [stop]);

    return {
        ...state,
        play,
        stop,
        isLoading: state.status === "loading",
        isPlaying: state.status === "playing",
    };
}
