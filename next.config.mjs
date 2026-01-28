const nextConfig = {
    experimental: {
        serverActions: {
            allowedOrigins: ["localhost:3000"],
        },
    },
    async rewrites() {
        return [
            {
                source: "/api/tts/:path*",
                destination: "http://127.0.0.1:8000/tts/:path*",
            },
        ];
    },
};

export default nextConfig;
