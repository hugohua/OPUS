"use client";

import { motion } from "framer-motion";
import { Link as LinkIcon, SlidersHorizontal, Share2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/actions/get-dashboard-stats";

interface DailyDrillsProps {
    stats?: DashboardStats;
}

export function DailyDrills({ stats }: DailyDrillsProps) {
    const s = stats || {
        syntax: { count: 8, status: "ready" },
        chunking: { count: 52, status: "warning" },
        nuance: { count: 0, status: "locked" },
    };

    return (
        <section className="px-5">
            <div className="flex items-center justify-between mb-4 pl-1">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">任务状态</h2>
                <span className="font-mono text-[10px] text-zinc-500">{s.syntax.count + s.chunking.count} 待完成</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* 1. Syntax Refactor (Full Width) */}
                <Link href="/dashboard/session/syntax" className="col-span-2">
                    <div className="group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-emerald-500/30 bg-white dark:bg-zinc-900/60 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-xl p-5 active:scale-[0.99] transition-all cursor-pointer">
                        <div className="hidden dark:block absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>

                        <div className="relative flex justify-between items-start">
                            <div className="flex gap-4">
                                <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                    <Share2 className="w-6 h-6" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-zinc-900 dark:text-white">句法重构</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-1">
                                        通过 S-V-O 结构攻克复杂职场长难句。
                                    </p>
                                    <div className="flex items-center gap-2 mt-3">
                                        <div className="h-1.5 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min((s.syntax.count / 20) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="font-mono text-[10px] text-zinc-400">{s.syntax.count}/20</span>
                                    </div>
                                </div>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-400/20">
                                就绪
                            </span>
                        </div>
                    </div>
                </Link>

                {/* 2. Chunking (Half Width) */}
                <Link href="/dashboard/session/chunking">
                    <div className={cn(
                        "group relative overflow-hidden rounded-3xl border bg-white dark:bg-zinc-900/60 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-xl p-4 active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between h-40",
                        s.chunking.status === 'warning'
                            ? "border-amber-200 dark:border-amber-500/30"
                            : "border-zinc-200 dark:border-zinc-800"
                    )}>
                        {s.chunking.status === 'warning' && (
                            <div className="absolute top-0 right-0 p-4 opacity-50">
                                <LinkIcon className="w-16 h-16 text-amber-500/10 -mr-4 -mt-4 rotate-12 stroke-1" />
                            </div>
                        )}

                        <div>
                            <div className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl border mb-3 transition-colors",
                                s.chunking.status === 'warning'
                                    ? "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-500"
                                    : "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-500"
                            )}>
                                <LinkIcon className="w-5 h-5" strokeWidth={1.5} />
                            </div>
                            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">语块扩容</h3>
                            {s.chunking.status === 'warning' && (
                                <p className="font-mono text-[10px] text-amber-600 dark:text-amber-500 mt-1">积压警报</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                            <span className="text-2xl font-mono font-bold text-zinc-900 dark:text-white">{s.chunking.count}</span>
                            <span className="text-[10px] text-zinc-400">词条</span>
                        </div>
                    </div>
                </Link>

                {/* 3. Nuance (Half Width - Locked) */}
                <div className="group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-xl p-4 active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between h-40 grayscale hover:grayscale-0">
                    <div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 mb-3">
                            <SlidersHorizontal className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">语感精调</h3>
                        <p className="font-mono text-[10px] text-zinc-500 mt-1">未解锁</p>
                    </div>

                    <div className="flex items-center gap-1 mt-2">
                        <svg className="w-4 h-4 text-zinc-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span className="text-[10px] text-zinc-400">需 Lv.5</span>
                    </div>
                </div>

            </div>
        </section>
    );
}
