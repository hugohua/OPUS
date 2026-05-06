import { Activity, Clock } from "lucide-react";
import Link from "next/link";
import type { ActionRequiredNode } from "@/lib/backend-core/arena/dashboard";

export interface ActionRequiredProps {
    nodes: ActionRequiredNode[];
}

export function ActionRequired({ nodes }: ActionRequiredProps) {
    if (nodes.length === 0) {
        // [Cold Start 防御] 没有做题记录/低分项时的兜底显示
        return (
            <section className="mt-8">
                <div className="flex justify-between items-end mb-4 px-1">
                    <h3 className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Activity className="w-4 h-4" />
                        状态良好 (All Clear)
                    </h3>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-border rounded-xl p-6 shadow-sm text-center flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 flex items-center justify-center mb-3">
                        <Activity className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mb-1">暂无薄弱语法点</h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-[200px]">
                        多做几道题，BKT 引擎会自动帮你找出短板。
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="mt-8">
            <div className="flex justify-between items-end mb-4 px-1">
                <h3 className="text-xs font-mono font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    重点突破 (Action Required)
                </h3>
            </div>

            <div className="space-y-3">
                {nodes.map((node, index) => {
                    const isWorst = index === 0;

                    // 根据最严重程度决定不同的渲染样式 (前列红色强提示，后面普通边框)
                    if (isWorst) {
                        return (
                            <div key={node.id} className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 rounded-xl p-4 shadow-sm relative overflow-hidden group">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
                                <div className="flex justify-between items-start mb-3 pl-2">
                                    <div className="pr-4">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{node.name}</h4>
                                            <span className="px-1.5 py-0.5 rounded flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[9px] font-mono text-zinc-500 dark:text-zinc-400">L3 NODE</span>
                                        </div>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">{node.description}</p>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <span className="text-sm font-mono font-bold text-rose-600 dark:text-rose-400">{node.score}%</span>
                                        <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400">掌握度 (MASTERY)</span>
                                    </div>
                                </div>
                                {/* Quick Drill 链接：跳转到靶向训练模式 */}
                                <Link
                                    href={`/dashboard/arena/blitz?node=${node.id}`}
                                    className="w-full mt-2 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Clock className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-600" />
                                    快速靶向特训 ({node.name})
                                </Link>
                            </div>
                        );
                    }

                    return (
                        <div key={node.id} className="bg-white dark:bg-zinc-900 border border-border rounded-xl p-4 shadow-sm relative pl-5 opacity-80 hover:opacity-100 transition-opacity">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-300 dark:bg-indigo-700/50"></div>
                            <div className="flex justify-between items-center">
                                <div className="pr-4">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm line-clamp-1">{node.name}</h4>
                                        <span className="px-1.5 py-0.5 rounded flex-shrink-0 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 text-[9px] font-mono text-zinc-500 dark:text-zinc-400">L3 NODE</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{node.description}</p>
                                </div>
                                <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{node.score}%</span>
                            </div>
                        </div>
                    );
                })}

                {/* Filler items to maintain 3 rows layout if nodes < 3 */}
                {nodes.length > 0 && Array.from({ length: Math.max(0, 3 - nodes.length) }).map((_, idx) => (
                    <div key={`filler-${idx}`} className="bg-white dark:bg-zinc-900 border border-dashed border-border rounded-xl p-4 shadow-sm relative pl-5 opacity-50 flex items-center justify-center">
                        <span className="text-xs font-mono text-zinc-400 dark:text-zinc-600">-- 测绘完成 (Level Passed) --</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
