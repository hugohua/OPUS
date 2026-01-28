"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { generateAudioHash } from "@/lib/tts/hash";
import { TTSRequest, TTSResponse, TTSState } from "@/types/tts";
import { toast } from "sonner";

// Memory cache for audio URLs to avoid re-fetching in the same session
const memoryCache = new Map<string, string>();

export function useTTS() {
    const [state, setState] = useState<TTSState>({
        status: "idle",
        url: null,
        error: null,
        duration: 0,
        currentTime: 0,
    });

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentHashRef = useRef<string | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stop();
        };
    }, []);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setState((prev) => ({
            ...prev,
            status: "idle",
            currentTime: 0
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

        // If already playing this hash, just ensure it's playing
        if (currentHashRef.current === hash && audioRef.current && state.status !== "error") {
            if (audioRef.current.paused) {
                audioRef.current.play().catch(console.error);
                setState(prev => ({ ...prev, status: "playing" }));
            }
            return;
        }

        // Stop previous
        stop();
        currentHashRef.current = hash;
        setState((prev) => ({ ...prev, status: "loading", error: null }));

        try {
            let audioUrl = memoryCache.get(hash);

            if (!audioUrl) {
                // 2. Fetch from API (Generate directly, it handles cache)
                const res = await fetch("/api/tts/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(options),
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.detail?.error || "TTS API Error");
                }

                const data: TTSResponse = await res.json();

                if (!data.success || !data.url) {
                    throw new Error(data.error || "Failed to generate audio");
                }

                audioUrl = data.url;
                memoryCache.set(hash, audioUrl);
            }

            // 3. Play Audio
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            // Event Listeners
            audio.addEventListener("canplaythrough", () => {
                if (currentHashRef.current === hash) {
                    audio.play().catch((e) => {
                        console.error("Autoplay failed", e);
                        setState((prev) => ({ ...prev, status: "error", error: "Autoplay blocked" }));
                    });
                }
            });

            audio.addEventListener("play", () => {
                if (currentHashRef.current === hash) {
                    setState((prev) => ({ ...prev, status: "playing", url: audioUrl! }));
                }
            });

            audio.addEventListener("ended", () => {
                if (currentHashRef.current === hash) {
                    setState((prev) => ({ ...prev, status: "idle", currentTime: 0 }));
                }
            });

            audio.addEventListener("error", (e) => {
                if (currentHashRef.current === hash) {
                    console.error("Audio playback error", e);
                    setState((prev) => ({ ...prev, status: "error", error: "Playback error" }));
                }
            });

            // Update time
            audio.addEventListener("timeupdate", () => {
                if (currentHashRef.current === hash) {
                    setState((prev) => ({
                        ...prev,
                        currentTime: audio.currentTime,
                        duration: audio.duration || 0
                    }));
                }
            });

        } catch (err: any) {
            console.error("TTS Error:", err);
            toast.error(err.message);
            setState((prev) => ({ ...prev, status: "error", error: err.message }));
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
