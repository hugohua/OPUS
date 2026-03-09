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
import { Serwist } from "serwist";

// Serwist 全局配置声明
declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
    // 预缓存清单（由 @serwist/next 在构建时自动注入）
    precacheEntries: self.__SW_MANIFEST,
    // 跳过等待，立即激活新版本
    skipWaiting: true,
    // 新 SW 激活后立即接管所有页面
    clientsClaim: true,
    // iOS Safari 不支持 Navigation Preload API，开启会增加 SW 冷启动开销但无实际收益
    navigationPreload: false,
    // 运行时缓存策略（使用 Serwist 默认策略，已排除 API 路由）
    runtimeCaching: defaultCache,
});

serwist.addEventListeners();
