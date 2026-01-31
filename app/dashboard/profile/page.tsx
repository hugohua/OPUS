import { auth, signOut } from "@/auth";
import { ArrowLeft, Settings, Zap, BookOpen, AlertTriangle, RefreshCw, LogOut, Bookmark, ShieldCheck, Terminal, Activity } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const { name, email, image } = session.user;
    const initials = name ? name.charAt(0).toUpperCase() : "U";
    // Mock Data for now
    const level = 12;
    const role = "Syntax Architect";
    const streak = 24;
    const xpCurrent = 2450;
    const xpTarget = 3000;
    const xpPercent = (xpCurrent / xpTarget) * 100;

    return (
        <div className="relative min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased flex flex-col selection:bg-violet-500/30 pb-20">

            {/* Ambient Light */}
            <div className="pointer-events-none absolute top-0 right-0 h-[500px] w-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent z-0"></div>

            {/* Header */}
            <header className="relative z-20 flex items-center justify-between px-6 h-16 shrink-0 bg-transparent">
                <Link href="/dashboard" className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-white/5 transition-all active:scale-95 -ml-2">
                    <ArrowLeft className="w-6 h-6" strokeWidth={2} />
                </Link>

                <button className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-white/5 transition-all active:scale-95 -mr-2">
                    <Settings className="w-5 h-5" strokeWidth={2} />
                </button>
            </header>

            {/* Hero Section */}
            <section className="relative z-10 px-6 mb-8">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-br from-amber-300 to-violet-600 rounded-full blur-[2px] opacity-70"></div>
                            <div className="relative w-16 h-16 rounded-full bg-zinc-900 border-2 border-zinc-950 flex items-center justify-center overflow-hidden">
                                {image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={image} alt={name || "User"} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-serif text-2xl font-bold text-white">{initials}</span>
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-zinc-900 border border-zinc-700 text-[9px] font-mono px-1.5 py-0.5 rounded text-white">
                                Lvl.{level}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{name || "Pilot"}</h1>
                                <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-200 to-amber-400 text-[9px] font-bold text-amber-900 tracking-wider">PRO</span>
                            </div>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5 max-w-[150px] truncate">{email}</p>
                            <p className="text-xs text-violet-500 font-medium mt-1">{role}</p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5">
                            <span className="text-2xl font-bold font-mono text-orange-500">{streak}</span>
                            <Zap className="w-5 h-5 text-orange-500 fill-current animate-pulse" />
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wide">Day Streak</span>
                    </div>
                </div>

                <div className="mt-6">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1.5">
                        <span>XP Progress</span>
                        <span>{xpCurrent.toLocaleString()} / {xpTarget.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.4)] transition-all duration-1000"
                            style={{ width: `${xpPercent}%` }}
                        ></div>
                    </div>
                </div>
            </section>

            {/* Brain Telemetry */}
            <section className="relative z-10 px-6 mb-8">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <RefreshCw className="w-3 h-3" />
                    Brain Telemetry
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                    {/* Radar Chart */}
                    <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-medium text-zinc-500">Skill Radar</span>
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-mono">BALANCED</span>
                        </div>
                        <div className="relative h-40 w-full flex items-center justify-center">
                            {/* Static SVG for Demo */}
                            <svg viewBox="0 0 100 100" className="w-32 h-32 absolute text-zinc-200 dark:text-zinc-800 fill-none stroke-currentColor stroke-[0.5]">
                                <polygon points="50,5 95,35 80,90 20,90 5,35" />
                                <polygon points="50,25 75,40 65,75 35,75 25,40" />
                                <line x1="50" y1="50" x2="50" y2="5" />
                                <line x1="50" y1="50" x2="95" y2="35" />
                                <line x1="50" y1="50" x2="80" y2="90" />
                                <line x1="50" y1="50" x2="20" y2="90" />
                                <line x1="50" y1="50" x2="5" y2="35" />
                            </svg>

                            <svg viewBox="0 0 100 100" className="w-32 h-32 absolute drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                                <polygon points="50,15 85,35 60,80 30,85 15,35" className="fill-emerald-500/20 stroke-emerald-500 stroke-2" />
                            </svg>
                            <span className="absolute top-0 text-[9px] font-mono text-zinc-400">Visual</span>
                            <span className="absolute right-0 top-8 text-[9px] font-mono text-zinc-400">Meaning</span>
                            <span className="absolute right-4 bottom-2 text-[9px] font-mono text-rose-400 font-bold">Context</span>
                            <span className="absolute left-6 bottom-2 text-[9px] font-mono text-zinc-400">Logic</span>
                            <span className="absolute left-0 top-8 text-[9px] font-mono text-zinc-400">Audio</span>
                        </div>
                    </div>

                    {/* Memory Health */}
                    <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between">
                        <span className="text-xs font-medium text-zinc-500">Memory Health</span>
                        <div className="relative w-24 h-24 mx-auto my-2">
                            <div className="w-full h-full rounded-full" style={{ background: 'conic-gradient(#ef4444 0% 20%, #eab308 20% 50%, #10b981 50% 100%)' }}></div>
                            <div className="absolute inset-2 bg-white dark:bg-zinc-900 rounded-full flex flex-col items-center justify-center">
                                <span className="text-xl font-bold font-mono text-zinc-900 dark:text-white">92%</span>
                                <span className="text-[8px] text-zinc-400 uppercase">Retention</span>
                            </div>
                        </div>
                        <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>New</div>
                            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>Young</div>
                            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Mature</div>
                        </div>
                    </div>

                    {/* Load Forecast */}
                    <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-xs font-medium text-zinc-500">Next 5 Days</span>
                            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">LOAD</span>
                        </div>

                        <div className="flex-1 flex items-end justify-between gap-2 h-24 pb-1">
                            {[
                                { day: 'Wed', count: 142, h: '80%', color: 'bg-rose-400/80 hover:bg-rose-500' },
                                { day: 'Thu', count: 98, h: '60%', color: 'bg-amber-400/80 hover:bg-amber-500' },
                                { day: 'Fri', count: 45, h: '40%', color: 'bg-emerald-400/80 hover:bg-emerald-500' },
                                { day: 'Sat', count: 32, h: '30%', color: 'bg-emerald-400/80 hover:bg-emerald-500' },
                                { day: 'Sun', count: 20, h: '25%', color: 'bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400' },
                            ].map((d, i) => (
                                <div key={i} className="group relative w-full flex flex-col justify-end gap-1 cursor-pointer">
                                    <div className={`w-full ${d.color} rounded-t-sm transition-all relative`} style={{ height: d.h }}>
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] bg-zinc-900 text-white px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            {d.count} cards
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-mono text-zinc-400 text-center">{d.day}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Consistency Log */}
                    <div className="col-span-1 md:col-span-3 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-hidden">
                        <div className="flex justify-between items-end mb-3">
                            <span className="text-xs font-medium text-zinc-500">Consistency Log</span>
                            <span className="text-[10px] font-mono text-zinc-400">Last 3 Months</span>
                        </div>
                        <div className="flex flex-wrap gap-1 opacity-80">
                            {/* Mock Heatmap */}
                            {Array.from({ length: 60 }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-3 h-3 rounded-sm ${Math.random() > 0.3 ? 'bg-emerald-500' : Math.random() > 0.5 ? 'bg-emerald-500/40' : 'bg-zinc-100 dark:bg-zinc-800'}`}
                                ></div>
                            ))}
                        </div>
                    </div>

                </div>
            </section>

            {/* Knowledge Vault */}
            <section className="relative z-10 px-6 mb-8">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BookOpen className="w-3 h-3" />
                    Knowledge Vault
                </h2>

                <div className="grid grid-cols-2 gap-3">
                    <button className="group relative flex flex-col justify-between bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-hidden text-left hover:border-rose-500/50 transition-all active:scale-[0.98]">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all"></div>
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-rose-500 bg-rose-100 dark:bg-rose-500/20 px-1.5 py-0.5 rounded animate-pulse">FIX ME</span>
                        </div>
                        <div className="relative z-10">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Error Log</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">42</span>
                                <span className="text-[10px] text-zinc-400">items</span>
                            </div>
                            <p className="text-[9px] text-zinc-400 mt-2 leading-tight">
                                12 critical items need immediate review (FSRS &lt; 70%).
                            </p>
                        </div>
                    </button>

                    <button className="group relative flex flex-col justify-between bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-hidden text-left hover:border-amber-500/50 transition-all active:scale-[0.98]">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                                <Bookmark className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="relative z-10">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Bookmarks</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">108</span>
                                <span className="text-[10px] text-zinc-400">saved</span>
                            </div>
                            <div className="mt-2 flex gap-1 overflow-hidden opacity-60">
                                <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded truncate max-w-[50px]">mitigate</span>
                                <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded truncate max-w-[50px]">consensus</span>
                            </div>
                        </div>
                    </button>
                </div>
            </section>

            {/* Preferences */}
            <section className="relative z-10 px-6 mb-8">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Settings className="w-3 h-3" />
                    Preferences
                </h2>

                <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">Auto-play Audio</span>
                            <span className="text-[10px] text-zinc-400">Play sound when card appears</span>
                        </div>
                        <div className="w-10 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </div>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">Haptic Feedback</span>
                            <span className="text-[10px] text-zinc-400">Vibrate on success/error</span>
                        </div>
                        <div className="w-10 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Admin Console */}
            <section className="relative z-10 px-6 pb-24">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" />
                    Admin Console
                </h2>

                <div className="bg-zinc-100 dark:bg-black/40 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-4">

                    <div className="grid grid-cols-1 gap-3 mb-4">
                        <Link href="/admin/inspector" className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:text-indigo-500 transition-colors">
                                    <Terminal className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-bold font-mono">Prompt Inspector</div>
                                    <div className="text-[9px] text-zinc-500">Debug & Optimize Prompts</div>
                                </div>
                            </div>
                            <span className="text-xs font-mono text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white">→</span>
                        </Link>

                        <Link href="/admin/queue" className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:text-emerald-500 transition-colors">
                                    <Activity className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-bold font-mono">Queue Manager</div>
                                    <div className="text-[9px] text-zinc-500">Drill Generation Status</div>
                                </div>
                            </div>
                            <span className="text-xs font-mono text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white">→</span>
                        </Link>
                    </div>

                    {/* Sign Out */}
                    <form
                        action={async () => {
                            "use server";
                            await signOut({ redirectTo: "/login" });
                        }}
                    >
                        <button className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-rose-100/50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-200/50 dark:hover:bg-rose-500/20 transition-all active:scale-[0.98]">
                            <LogOut className="w-4 h-4" />
                            <span className="text-xs font-bold">Sign Out</span>
                        </button>
                    </form>

                    <div className="mt-6 flex gap-4 justify-center">
                        <a href="#" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 underline decoration-zinc-500/50">Vocab Book</a>
                        <a href="#" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 underline decoration-zinc-500/50">Support & Feedback</a>
                    </div>
                </div>
            </section>

        </div>
    );
}
