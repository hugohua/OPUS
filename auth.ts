import NextAuth from "next-auth";
import authConfig from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { LoginSchema } from "@/lib/validations/auth";
import { db } from "@/lib/db";

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
                const validatedFields = LoginSchema.safeParse(credentials);
                if (!validatedFields.success) return null;

                const { email, password } = validatedFields.data;

                const user = await db.user.findUnique({
                    where: { email }
                });

                if (!user || !user.password) return null;

                const passwordsMatch = await bcrypt.compare(password, user.password);

                if (passwordsMatch) {
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email
                    };
                }
                return null;
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
