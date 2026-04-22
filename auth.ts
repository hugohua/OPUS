import NextAuth from "next-auth";
import authConfig from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { authenticateUserByCredentials } from "@/lib/auth/shared";

export const {
    handlers: { GET, POST },
    auth,
    signIn,
    signOut,
} = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                return await authenticateUserByCredentials(credentials);
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                // Use token.id or fallback to standard 'sub' claim
                session.user.id = (token.id as string) || (token.sub as string);
            }
            return session;
        },
    },
    session: { strategy: "jwt" },
});
