import withSerwistInit from "@serwist/next";

// Serwist PWA 配置
const withSerwist = withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    // 开发环境禁用 Service Worker，避免干扰热更新
    disable: process.env.NODE_ENV === "development",
    // 运行期生成的音频只走 runtime caching，不进入 precache manifest。
    manifestTransforms: [
        async (entries) => ({
            manifest: entries.filter((entry) => !entry.url.startsWith("/audio/")),
            warnings: [],
        }),
    ],
});

const nextConfig = {
    turbopack: {},
    experimental: {
        serverActions: {
            allowedOrigins: ["*"],
        },
    },
    output: "standalone",
    // TTS 请求现由 app/api/tts/generate/route.ts 处理
    // rewrite 已移除，确保 Next.js 作为主脑处理 DB 缓存
    // 静态音频文件长缓存 (Hash 变则 URL 变，所以可以永久缓存)
    async headers() {
        return [
            {
                source: "/audio/:path*",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, immutable",
                    },
                ],
            },
        ];
    },
};

export default withSerwist(nextConfig);
