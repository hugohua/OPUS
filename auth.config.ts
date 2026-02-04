import type { NextAuthConfig } from "next-auth";

export default {
    providers: [], // Providers added in auth.ts for Node runtime
    trustHost: true, // 允许通过域名、IP、localhost 访问
    pages: {
        signIn: "/login",
        // error: "/error", // Error code passed in url query string as ?error=
    },
} satisfies NextAuthConfig;
