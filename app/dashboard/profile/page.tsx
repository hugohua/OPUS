import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, LogOut, Mail, User } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const { name, email, image } = session.user;

    const initials = name
        ? name.charAt(0).toUpperCase()
        : email
            ? email.charAt(0).toUpperCase()
            : "U";

    return (
        <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center p-6 relative">
            {/* Ambient Light */}
            <div className="fixed top-0 left-0 right-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent pointer-events-none" />

            <div className="w-full max-w-md relative z-10 space-y-8">
                {/* Header / Back Button */}
                <div className="flex items-center">
                    <Link href="/dashboard" className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="ml-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        Profile
                    </h1>
                </div>

                {/* Profile Card */}
                <Card className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border-zinc-200 dark:border-white/15 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                    <CardHeader className="items-center pb-2">
                        <div className="w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 border-4 border-white dark:border-zinc-900 shadow-md overflow-hidden relative">
                            {image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={image} alt={name || "User"} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-3xl font-serif font-bold text-zinc-400 dark:text-zinc-500">{initials}</span>
                            )}
                        </div>
                        <CardTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100 pt-2">
                            {name || "User"}
                        </CardTitle>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                            Syntactic Operative
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        {/* Info Rows */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
                                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Email</p>
                                    <p className="text-sm text-zinc-900 dark:text-zinc-200 truncate font-mono">{email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
                                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                                    <User className="w-4 h-4" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Member Since</p>
                                    <p className="text-sm text-zinc-900 dark:text-zinc-200 truncate font-mono">
                                        Jan 2026
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Sign Out Button */}
                        <form
                            action={async () => {
                                "use server";
                                await signOut({ redirectTo: "/login" });
                            }}
                        >
                            <Button
                                variant="destructive"
                                className="w-full h-12 rounded-xl font-medium shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20 transition-all active:scale-[0.98]"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Sign Out
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
