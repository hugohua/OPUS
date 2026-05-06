"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SyntaxMatrixData, SyntaxKnot } from "@/lib/backend-core/arena/dashboard";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Target, ChevronRight } from "lucide-react";

const L1_DOMAINS = [
    { code: 'L1_VERBS', label: 'Verbs', cn: '动词', short: 'VERB' },
    { code: 'L1_CLAUSES', label: 'Clauses', cn: '从句', short: 'CLSE' },
    { code: 'L1_PARTS_OF_SPEECH', label: 'Nouns', cn: '词性', short: 'NOUN' },
    { code: 'L1_CONNECTIVES', label: 'Conj.', cn: '连词', short: 'CONJ' },
    { code: 'L1_SPECIAL_SYNTAX', label: 'Syntax', cn: '句法', short: 'SYNT' },
];

export interface SyntaxMatrixProps {
    data: SyntaxMatrixData;
    activeDomain: string;
}

export function SyntaxMatrix({ data, activeDomain }: SyntaxMatrixProps) {
    const [selectedKnot, setSelectedKnot] = useState<{ knot: SyntaxKnot, categoryName: string } | null>(null);

    // [Hydration & State Sync] 当顶级路由 domain 参数变化时，无论如何关闭下方的 Drawer，防止不同树的数据幽灵挂载
    useEffect(() => {
        setSelectedKnot(null);
    }, [activeDomain]);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            {/* L1 Navigation */}
            <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 shadow-inner w-full">
                {L1_DOMAINS.map(domain => {
                    const isActive = domain.code === activeDomain;
                    return (
                        <Link
                            key={domain.code}
                            href={`/dashboard/arena?tab=matrix&domain=${domain.code}`}
                            replace
                            className={`relative py-1.5 flex flex-col items-center justify-center rounded-md transition-all ${isActive
                                ? "bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/50 dark:border-white/10 text-zinc-900 dark:text-zinc-50 z-10"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/30"
                                }`}
                        >
                            <span className="text-[10px] font-bold tracking-tight">{domain.cn}</span>
                            <span className={`text-[8px] font-mono font-bold ${isActive ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                                {domain.short}
                            </span>
                        </Link>
                    );
                })}
            </div>

            {/* Matrix Content */}
            <div className="space-y-8">
                {data.categories.length === 0 ? (
                    <div className="text-center py-10 text-sm text-zinc-500 font-mono">
                        该领域暂无活跃的训练模块。
                    </div>
                ) : (
                    data.categories.map(category => (
                        <section key={category.l2Node.id}>
                            <div className="flex items-center gap-3 mb-3">
                                <h2 className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                                    {category.l2Node.nameEn || category.l2Node.name}
                                </h2>
                                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800"></div>
                                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                                    {category.knots.reduce((acc, k) => acc + k.availableQs, 0)} 题 (Qs)
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {category.knots.map(knot => (
                                    <MatrixTile
                                        key={knot.id}
                                        knot={knot}
                                        onClick={() => setSelectedKnot({ knot, categoryName: category.l2Node.nameEn || category.l2Node.name })}
                                    />
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </div>

            {/* Bottom Drawer for Action */}
            <SyntaxTileDrawer
                selected={selectedKnot}
                l1Name={data.l1Node.name}
                onClose={() => setSelectedKnot(null)}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// 极简 "Accent vs Area" 瓦片组件
// ---------------------------------------------------------------------------
function MatrixTile({ knot, onClick }: { knot: SyntaxKnot, onClick: () => void }) {
    const isVulnerable = knot.masteryScore < 40;
    const isMastered = knot.masteryScore >= 80;

    const accentColor = isVulnerable ? 'bg-rose-500' : isMastered ? 'bg-emerald-500' : 'bg-indigo-400';
    const textColor = isVulnerable ? 'group-hover:text-rose-600 dark:group-hover:text-rose-400' : isMastered ? 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400' : 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400';
    const badgeBg = 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-700/50 text-zinc-500 dark:text-zinc-400';

    return (
        <div
            onClick={onClick}
            className="aspect-square rounded-xl p-3 flex flex-col justify-between bg-white dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 transition-all cursor-pointer group relative overflow-hidden shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] active:scale-[0.98]"
        >
            {/* Top Accent Line */}
            <div className={`absolute top-0 left-0 w-full h-[2px] opacity-80 ${accentColor}`}></div>

            <div className="flex justify-between items-start">
                <span className={`text-[10px] font-mono font-bold px-1 rounded border ${badgeBg}`}>
                    {knot.shortCode}
                </span>

                {isVulnerable ? (
                    <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                    </span>
                ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${accentColor}`}></span>
                )}
            </div>

            <div>
                <h3 className={`text-[11px] font-bold text-zinc-800 dark:text-zinc-200 leading-tight transition-colors ${textColor}`}>
                    {knot.nameEn || knot.name}
                </h3>
                <p className={`text-[9px] mt-0.5 font-mono ${isVulnerable ? 'text-rose-500 font-bold' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {knot.masteryScore}% 掌握度
                </p>
            </div>

            {/* Micro Progress Bar */}
            <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div className={`h-full rounded-full ${accentColor}`} style={{ width: `${knot.masteryScore}%` }}></div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 底部唤起抽屉 (Drawer)
// ---------------------------------------------------------------------------
function SyntaxTileDrawer({
    selected,
    l1Name,
    onClose
}: {
    selected: { knot: SyntaxKnot, categoryName: string } | null,
    l1Name: string,
    onClose: () => void
}) {
    if (!selected) return null;
    const { knot, categoryName } = selected;
    const isVulnerable = knot.masteryScore < 40;

    return (
        <Drawer open={!!selected} onOpenChange={(open) => !open && onClose()}>
            <DrawerContent className="bg-background rounded-t-2xl outline-none max-h-[85vh] border-border pb-safe">
                <VisuallyHidden.Root>
                    <DrawerTitle>靶向特训 (Target Drill Action)</DrawerTitle>
                </VisuallyHidden.Root>

                {/* Handle */}
                <div className="flex-none pt-3 pb-2 flex justify-center">
                    <div className="w-10 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
                </div>

                <div className="p-6 pt-2 flex flex-col gap-6">
                    {/* Header Info */}
                    <div className="flex justify-between items-start">
                        <div>
                            {/* Breadcrumbs */}
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mb-2">
                                <span>{l1Name}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span>{categoryName}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span className={isVulnerable ? 'text-rose-500' : 'text-indigo-500 dark:text-indigo-400'}>{knot.shortCode}</span>
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                {knot.nameEn || knot.name}
                                {knot.nameEn && <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400 ml-1">{knot.name}</span>}
                            </h3>
                        </div>
                        {isVulnerable && (
                            <div className="flex flex-col items-end">
                                <span className="px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-mono font-bold border border-rose-200 dark:border-rose-500/20">
                                    亟待提升 (ACTION REQ)
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Stats Panel */}
                    <div className="flex gap-3">
                        <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 rounded-xl p-3">
                            <span className="block text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mb-1 uppercase">BKT 掌握度</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className={`text-xl font-bold ${isVulnerable ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                    {knot.masteryScore}<span className="text-sm">%</span>
                                </span>
                                {isVulnerable && <span className="text-[10px] text-rose-500 font-mono">↓ 薄弱项</span>}
                            </div>
                        </div>
                        <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 rounded-xl p-3">
                            <span className="block text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mb-1 uppercase">储备题库</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-xl font-bold text-zinc-800 dark:text-zinc-200">{knot.availableQs}</span>
                                <span className="text-[10px] text-zinc-500 font-mono">可用题解</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Button -> Quick Drill Router */}
                    <Link
                        href={`/dashboard/arena/blitz?node=${knot.id}`}
                        onClick={onClose}
                        className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold shadow-[0_4px_0_#0f172a] dark:shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-200 active:translate-y-[4px] active:shadow-none delay-75 transition-all"
                    >
                        <Target className="w-4 h-4 text-indigo-400 dark:text-indigo-600" />
                        开启靶向特训 ({Math.min(knot.availableQs, 10)} 题)
                    </Link>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
