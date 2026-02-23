/**
 * Low-level utility for prefetching and caching TTS audio streams in the browser.
 * Uses native HTML Audio object to force download caching without playing.
 */

import { DashScopeVoice } from "@/lib/constants/drive";
import { generateAudioHash, ttsMemoryCache } from "@/lib/tts/hash";

// Memory cache of preloaded audio elements to prevent GC and redundant requests.
const preloadedAudiosCache = new Map<string, HTMLAudioElement>();

export interface PreloadTarget {
    text: string;
    voice: DashScopeVoice | string;
    speed: number;
}

/**
 * Hits the /api/tts/generate endpoint and forces native audio preloading.
 * Fails silently if generation faults, treating preloading as a progressive enhancement.
 * @param target Details needed to generate the TTS 
 */
export const generateAndPreloadAudio = async (
    target: PreloadTarget
): Promise<void> => {
    try {
        const response = await fetch('/api/tts/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: target.text,
                voice: target.voice,
                language: 'en-US',
                speed: target.speed
            })
        });

        if (!response.ok) return;

        const { url } = await response.json();
        if (!url || preloadedAudiosCache.has(url)) return;

        // ✅ Cache raw audio into browser memory
        const audio = new window.Audio(url);
        audio.preload = 'auto';
        audio.load(); // Kick off network request immediately

        preloadedAudiosCache.set(url, audio);

        // Share the URL with the application-level TTS hook so it doesn't fetch again
        const hash = generateAudioHash({
            text: target.text,
            voice: target.voice,
            language: 'en-US',
            speed: target.speed
        });
        ttsMemoryCache.set(hash, url);

        // Log lightly for debug traces
        console.log(`[TTS Prefetch] Loaded: ${target.text.slice(0, 15)}...`);
    } catch (err) {
        // Silent failure - caching is progressive enhancement only
        console.warn(`[TTS Prefetch] Silent Fail: ${target.text.slice(0, 10)}`, err);
    }
};
