import { getErrorLogs } from "@/actions/get-error-logs";
import { MistakeCard } from "@/components/profile/mistakes/mistake-card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { GlobalHeader } from "@/components/ui/global-header";

export const dynamic = "force-dynamic";

export default async function MistakesPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const searchParams = await props.searchParams;
    const { highFrequencyLogs, recentLogs, totalUnresolved, categories, grammarNodes } = await getErrorLogs();

    // 解析当前选中的 filter (默认为 all)
    const currentFilter = searchParams.filter ? String(searchParams.filter) : 'all';

    // 根据 filter 过滤列表
    const filteredHighFreq = highFrequencyLogs.filter(log => currentFilter === 'all' || log.grammarNodeId === currentFilter);
    const filteredRecent = recentLogs.filter(log => currentFilter === 'all' || log.grammarNodeId === currentFilter);

    return (
        <div className="relative w-full min-h-screen max-w-md mx-auto bg-[#F8FAFC] text-slate-900 font-sans antialiased flex flex-col shadow-2xl sm:border-x sm:border-slate-200 overflow-hidden selection:bg-indigo-100">

            {/* Header: Strict adherence to Global Fusion Header Spec */}
            <GlobalHeader
                className="bg-gradient-to-b from-[#F8FAFC] via-[#F8FAFC]/98 to-transparent border-none backdrop-blur-none bg-transparent pt-12 pb-3 px-5"
                leftSlot={
                    <Link href="/dashboard/profile" className="flex items-center justify-center -ml-2 w-8 h-8 rounded-full hover:bg-slate-200/50 transition-colors text-slate-500">
                        <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
                    </Link>
                }
                title={
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-slate-900 tracking-tight">错题本</span>
                        {totalUnresolved > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-[10px] font-mono font-bold text-rose-600">
                                {totalUnresolved} 待解决
                            </span>
                        )}
                    </div>
                }
                rightSlot={
                    <button className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                    </button>
                }
            >
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <Link href="/dashboard/profile/mistakes?filter=all" className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm transition-colors ${currentFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        All Issues 全盘
                    </Link>
                    {grammarNodes && grammarNodes.map((node) => (
                        <Link
                            key={node.id}
                            href={`/dashboard/profile/mistakes?filter=${node.id}`}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${currentFilter === node.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            {node.name} ({node.count})
                        </Link>
                    ))}
                </div>
            </GlobalHeader>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto px-4 space-y-3 relative z-10 -mt-2">

                {filteredHighFreq.length === 0 && filteredRecent.length === 0 && (
                    <div className="flex flex-col items-center justify-center pt-24 pb-12 opacity-60">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <p className="text-sm font-bold text-slate-600">错题本已清空</p>
                        <p className="text-xs text-slate-400 mt-1">干得漂亮，继续保持</p>
                    </div>
                )}

                {filteredHighFreq.length > 0 && (
                    <>
                        <div className="flex items-center gap-2 pt-2 pb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                            <h2 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">高频易错 (≥3 次)</h2>
                            <div className="flex-1 h-px bg-slate-200"></div>
                        </div>
                        {filteredHighFreq.map((log) => (
                            <MistakeCard key={log.id} log={log} isRecent={false} />
                        ))}
                    </>
                )}

                {filteredRecent.length > 0 && (
                    <>
                        <div className="flex items-center gap-2 pt-4 pb-1">
                            <h2 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">近期记录 ({filteredRecent.length}题)</h2>
                            <div className="flex-1 h-px bg-slate-200"></div>
                        </div>
                        {filteredRecent.map((log) => (
                            <MistakeCard key={log.id} log={log} isRecent={true} />
                        ))}
                    </>
                )}
            </main>
            <div className="pb-12"></div>
        </div>
    );
}
