import { auth, signOut } from "@/auth";
import {
    ArrowLeft, Settings, RefreshCw, BookOpen,
    AlertTriangle, ShieldCheck, Terminal,
    Activity, LogOut, Calendar, Award
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfileStats } from "@/actions/get-profile-stats";
import { getUserSettings } from "@/actions/update-user-settings";
import { getErrorLogs } from "@/actions/get-error-logs";
import { VocabPipeline } from "@/components/profile/vocab-pipeline";
import { LoadForecast } from "@/components/profile/load-forecast";
import { ConsistencyLog } from "@/components/profile/consistency-log";
import { PreferenceToggle } from "@/components/profile/preference-toggle";
import { ProfileRadarTabs } from "@/components/profile/profile-radar-tabs";
import { LevelBadge } from "@/components/profile/level-badge";
import { MultiTrackOverview } from "@/components/profile/multi-track-overview";
import { ArenaSummary } from "@/components/profile/arena-summary";
import { GlobalHeader } from "@/components/ui/global-header";
import { FloatingDockClient } from "@/components/dashboard/floating-dock-client";
import { Button } from "@/components/ui/button";
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const { name, email, image } = session.user;
    const initials = name ? name.charAt(0).toUpperCase() : "U";

    // ── 并行获取所有数据 ──
    const [stats, settings, mistakeLogs] = await Promise.all([
        getProfileStats(),
        getUserSettings(),
        getErrorLogs(),
    ]);

    return (
        <div className="relative min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased flex flex-col selection:bg-violet-500/30 pb-20">

            {/* Ambient Light */}
            <div className="pointer-events-none absolute top-0 right-0 h-[500px] w-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent z-0" />

            {/* Header */}
            <GlobalHeader
                title={null}
                leftSlot={
                    <Link href="/dashboard" className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-white/5 transition-all active:scale-95 -ml-2">
                        <ArrowLeft className="w-6 h-6" strokeWidth={2} />
                    </Link>
                }
                className="bg-transparent dark:from-transparent dark:via-transparent to-transparent dark:to-transparent border-none px-6"
            />

            {/* ═══════════════════════ Hero Section ═══════════════════════ */}
            <section className="relative z-10 px-6 pt-3 mb-8">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-br from-emerald-400 to-violet-600 rounded-full blur-[2px] opacity-70" />
                            <div className="relative w-16 h-16 rounded-full bg-zinc-900 border-2 border-zinc-950 flex items-center justify-center overflow-hidden">
                                {image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={image} alt={name || "User"} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-serif text-2xl font-bold text-white">{initials}</span>
                                )}
                            </div>
                        </div>

                        <div>
                            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{name || "Pilot"}</h1>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5 max-w-[180px] truncate">{email}</p>
                        </div>
                    </div>

                    {/* 合规指标: 累计存活天数 + 已掌握词汇 */}
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-zinc-400" />
                            <span className="text-lg font-bold font-mono text-zinc-900 dark:text-white">{stats.totalDaysSurvived}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">天</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-emerald-500" />
                            <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{stats.totalMastered}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">已掌握</span>
                        </div>
                    </div>
                </div>

                {/* Level Badge */}
                <LevelBadge level={stats.userLevel} />
            </section>

            {/* ═══════════════════════ 认知遥测 ═══════════════════════ */}
            <section className="relative z-10 px-6 mb-8">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <RefreshCw className="w-3 h-3" />
                    学习仪表盘
                </h2>

                <div className="space-y-3">
                    <VocabPipeline data={stats.memoryHealth} />
                    <LoadForecast data={stats.loadForecast} />
                    <MultiTrackOverview data={stats.multiTrack} />
                    <ArenaSummary data={stats.arenaSummary} />
                    <ConsistencyLog activeDays={stats.activeDays} />
                </div>

                {/* Arena 实战诊断雷达与语法树 Tabs (V7.0) */}
                <div className="mt-4">
                    <ProfileRadarTabs userId={session.user.id} />
                </div>
            </section>

            {/* ═══════════════════════ 知识保险库 ═══════════════════════ */}
            <section className="relative z-10 px-6 mb-8">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BookOpen className="w-3 h-3" />
                    知识保险库
                </h2>

                <div className="grid grid-cols-2 gap-3">
                    <Link href="/dashboard/profile/mistakes" className="group relative flex flex-col justify-between bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-white/15 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] p-4 overflow-hidden text-left hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all active:scale-[0.98]">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-xl group-hover:bg-indigo-500/20 dark:group-hover:bg-indigo-500/30 transition-all" />
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-white/10 text-indigo-500 dark:text-indigo-400">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            {mistakeLogs.totalUnresolved > 0 && (
                                <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-500 bg-rose-100 dark:bg-rose-500/10 px-1.5 py-0.5 rounded animate-pulse">
                                    {mistakeLogs.totalUnresolved} 待解决
                                </span>
                            )}
                        </div>
                        <div className="relative z-10">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">错题档案 (日志)</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">{mistakeLogs.totalUnresolved}</span>
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">项</span>
                            </div>
                            <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-2 leading-tight">
                                高频错题: {mistakeLogs.highFrequencyLogs.length}
                            </p>
                        </div>
                    </Link>
                    <Link href="/dashboard/cards?filter=weak" className="group relative flex flex-col justify-between bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-white/15 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] p-4 overflow-hidden text-left hover:border-rose-500/50 transition-all active:scale-[0.98]">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all" />
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-white/10 text-rose-500 dark:text-rose-400">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            {stats.errorWords > 0 && (
                                <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-500 bg-rose-100 dark:bg-rose-500/20 px-1.5 py-0.5 rounded animate-pulse">
                                    需要复习
                                </span>
                            )}
                        </div>
                        <div className="relative z-10">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">薄弱词汇</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">{stats.errorWords}</span>
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">词</span>
                            </div>
                            <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-2 leading-tight">
                                {stats.weakWordsCriteria}
                            </p>
                        </div>
                    </Link>
                </div>
            </section>

            {/* ═══════════════════════ 偏好设置 ═══════════════════════ */}
            <section className="relative z-10 px-6 mb-8">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Settings className="w-3 h-3" />
                    偏好设置
                </h2>

                <PreferenceToggle settings={settings} />
            </section>

            {/* ═══════════════════════ 管理控制台 ═══════════════════════ */}
            <section className="relative z-10 px-6 pb-24">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" />
                    管理控制台
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
                                    <div className="text-[9px] text-zinc-500">调试与优化 Prompt</div>
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
                                    <div className="text-[9px] text-zinc-500">Drill 生成状态</div>
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
                        <Button variant="destructive" className="w-full">
                            <LogOut className="w-4 h-4" />
                            <span className="text-xs font-bold">退出登录</span>
                        </Button>
                    </form>

                    <div className="mt-6 flex gap-4 justify-center">
                        <Link href="/dashboard/cards" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 underline decoration-zinc-500/50">词汇本</Link>
                    </div>
                </div>
            </section>

            <FloatingDockClient />
        </div>
    );
}
