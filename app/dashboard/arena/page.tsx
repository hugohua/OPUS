import Link from "next/link";
import { Zap, BookOpen, Activity, Grid, HelpCircle } from "lucide-react";
import { getRadarData, getActionRequiredNodes, getSyntaxMatrixData } from "@/actions/grammar-dashboard";
import { GrammarRadar } from "@/components/arena/grammar-radar";
import { ActionRequired } from "@/components/arena/action-required";
import { SyntaxMatrix } from "@/components/arena/syntax-matrix";
import { redirect } from "next/navigation";
import { GlobalHeader } from "@/components/ui/global-header";
import { HeaderActionDropdown } from "@/components/dashboard/header-action-dropdown";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { FloatingDockClient } from "@/components/dashboard/floating-dock-client";

export default async function ArenaDashboard({ searchParams }: { searchParams: Promise<{ tab?: string, domain?: string }> }) {
    const params = await searchParams;
    const tab = params.tab || 'overview';
    const domain = params.domain || 'L1_VERBS';

    // [SSR Zero-Wait] 条件并行获取数据，避免无谓查询
    const [radarDomains, actionRequiredNodes, matrixData] = await Promise.all([
        tab === 'overview' ? getRadarData() : Promise.resolve([]),
        tab === 'overview' ? getActionRequiredNodes() : Promise.resolve([]),
        tab === 'matrix' ? getSyntaxMatrixData(domain) : Promise.resolve(null)
    ]);

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col relative selection:bg-brand-core/20 sm:border-x sm:border-border max-w-md mx-auto shadow-2xl">

            {/* Header - Variant A Strict Compliance */}
            <GlobalHeader
                title="实战演练"
                showStatusLight={true}
                rightSlot={<HeaderActionDropdown variant="arena" />}
            >
                {/* Tab Switcher */}
                <div className="flex p-1 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-lg border border-zinc-200/50 dark:border-white/5 shadow-inner backdrop-blur-md pointer-events-auto mt-1">
                    <Link
                        href="/dashboard/arena?tab=overview"
                        replace
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${tab === 'overview' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm border border-zinc-200 dark:border-white/10' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                    >
                        <Activity className="w-3.5 h-3.5" />
                        宏观大盘
                    </Link>
                    <Link
                        href={`/dashboard/arena?tab=matrix&domain=${domain}`}
                        replace
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${tab === 'matrix' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm border border-zinc-200 dark:border-white/10' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                    >
                        <Grid className="w-3.5 h-3.5" />
                        语法矩阵
                    </Link>
                </div>
            </GlobalHeader>

            {/* Main Container */}
            <main className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
                {tab === 'overview' ? (
                    <div className="space-y-8">
                        {/* 1. Grammar Proficiency Radar (L1 Domains) */}
                        <GrammarRadar initialData={radarDomains} />

                        {/* 2. Action Required (L3 Weak Nodes) */}
                        <ActionRequired nodes={actionRequiredNodes} />

                        {/* 3. Select Mode Category */}
                        <section className="space-y-4 pt-4 border-t border-border/50">
                            <h3 className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest px-1">实战模式 (Training Modes)</h3>

                            <Link href="/dashboard/arena/blitz" className="block w-full text-left bg-white border border-border rounded-xl p-5 shadow-sm hover:border-violet-500 hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden dark:bg-zinc-900/60 dark:backdrop-blur-xl dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center border border-violet-100 dark:border-violet-500/20 shrink-0 group-hover:bg-violet-500 group-hover:text-white transition-colors text-violet-600 dark:text-violet-400">
                                        <Zap className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">单句闪电战 (Part 5)</h4>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">3-5分钟碎片时间<br />词汇与语法快测</p>
                                    </div>
                                </div>
                            </Link>

                            <Link href="/dashboard/arena/mission" className="block w-full text-left bg-white border border-border rounded-xl p-5 shadow-sm hover:border-violet-500 hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden dark:bg-zinc-900/60 dark:backdrop-blur-xl dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center border border-border shrink-0 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-700 transition-colors text-zinc-500 dark:text-zinc-400">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">阅读狙击战 (Part 6/7)</h4>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">10-15分钟沉浸时间<br />商务长文实战</p>
                                    </div>
                                </div>
                            </Link>
                        </section>
                    </div>
                ) : (
                    /* The New Syntax Matrix Tab */
                    matrixData ? (
                        <SyntaxMatrix data={matrixData} activeDomain={domain} />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white dark:bg-zinc-900/60 border border-dashed border-border rounded-xl">
                            <Activity className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-4" />
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">系统离线 (Matrix Offline)</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[240px]">
                                语法全景图数据拉取失败，这通常是因为当前网络或数据库连接异常引起的。
                            </p>
                            <Link href="/dashboard/arena?tab=overview" replace className="mt-6 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-xs font-bold transition-all active:scale-[0.98]">
                                返回安全概览
                            </Link>
                        </div>
                    )
                )}
            </main>

            <FloatingDockClient />
        </div>
    );
}
