/// <reference lib="webworker" />

/**
 * Opus PWA Service Worker 入口
 * 功能：
 *   基于 Serwist 实现 PWA 离线支持和资源缓存。
 *   静态资源使用 CacheFirst，API/Server Actions 使用 NetworkOnly。
 * 注意：
 *   此文件由 @serwist/next 在构建时编译为 public/sw.js。
 *   public/sw.js 和 public/serwist-*.js 是构建产物，已加入 .gitignore。
 */

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, RangeRequestsPlugin, Serwist } from "serwist";

// Serwist 全局配置声明
declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const LEGACY_AUDIO_CACHE_NAME = "static-audio-assets";
const TTS_AUDIO_CACHE_NAME = "opus-tts-audio";

const runtimeCaching = [
    {
        // TTS 音频使用独立缓存桶，避免和通用静态音频策略互相挤占。
        matcher: ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) =>
            sameOrigin && url.pathname.startsWith("/audio/"),
        handler: new CacheFirst({
            cacheName: TTS_AUDIO_CACHE_NAME,
            plugins: [
                new ExpirationPlugin({
                    maxEntries: 256,
                    maxAgeSeconds: 30 * 24 * 60 * 60,
                    maxAgeFrom: "last-used",
                }),
                new RangeRequestsPlugin(),
            ],
        }),
    },
    ...defaultCache,
];

const serwist = new Serwist({
    // 预缓存清单（由 @serwist/next 在构建时自动注入）
    precacheEntries: self.__SW_MANIFEST,
    // 跳过等待，立即激活新版本
    skipWaiting: true,
    // 新 SW 激活后立即接管所有页面
    clientsClaim: true,
    // iOS Safari 不支持 Navigation Preload API，开启会增加 SW 冷启动开销但无实际收益
    navigationPreload: false,
    // 运行时缓存策略：优先命中 /audio/ 的专用缓存，其余回退到 Serwist 默认策略。
    runtimeCaching,
});

serwist.addEventListeners();

self.addEventListener("activate", (event) => {
    // 清理历史音频缓存桶，避免升级后遗留孤儿缓存占用配额。
    event.waitUntil(self.caches.delete(LEGACY_AUDIO_CACHE_NAME));
});
