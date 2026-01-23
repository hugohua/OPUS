import type { NextAuthConfig } from "next-auth";

export default {
    providers: [], // Providers added in auth.ts for Node runtime
    pages: {
        signIn: "/login",
        // error: "/error", // Error code passed in url query string as ?error=
    },
} satisfies NextAuthConfig;
