'use client';

import {
    ChevronLeft,
    ChevronRight,
    MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function ContentSimView() {
    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-black">

            {/* Toolbar */}
            <div className="h-auto md:h-20 shrink-0 border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:px-8 bg-zinc-900/50 gap-4 md:gap-0">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 w-full md:w-auto">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Simulation Timeline</span>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-2xl font-bold text-white">Day 1</h2>
                            <span className="text-xs text-violet-400">Onboarding Phase</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded-lg border border-white/5">
                        <button className="w-8 h-8 flex items-center justify-center rounded bg-zinc-700 text-zinc-400 hover:text-white">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="px-4 text-xs font-mono text-zinc-300">Day 1</div>
                        <button className="w-8 h-8 flex items-center justify-center rounded bg-violet-600 text-white shadow-lg shadow-violet-500/20">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between w-full md:w-auto gap-4">
                    <div className="text-right flex-1 md:flex-none">
                        <div className="text-xs font-bold text-zinc-300">Target Score: 600</div>
                        <div className="text-[10px] text-zinc-500">Vocabulary Coverage: 85%</div>
                    </div>
                    <button className="px-4 py-2 bg-white text-black text-xs font-bold rounded hover:bg-zinc-200 whitespace-nowrap">Reset Sim</button>
                </div>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="w-full max-w-5xl mx-auto border border-white/10 rounded-xl overflow-hidden overflow-x-auto">

                    {/* Table Header */}
                    <div className="min-w-[800px] grid grid-cols-12 gap-4 p-3 bg-zinc-900 border-b border-white/10 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        <div className="col-span-1">Rank</div>
                        <div className="col-span-3">Word</div>
                        <div className="col-span-2">POS</div>
                        <div className="col-span-2">Frequency</div>
                        <div className="col-span-3">Difficulty Check</div>
                        <div className="col-span-1 text-right">Action</div>
                    </div>

                    {/* Row 1: Optimal */}
                    <div className="min-w-[800px] grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-white/[0.02] items-center hover:bg-white/[0.05] transition-colors group">
                        <div className="col-span-1 text-xs font-mono text-zinc-400">#1</div>
                        <div className="col-span-3 flex flex-col">
                            <span className="text-sm font-bold text-white">Consensus</span>
                            <span className="text-[10px] text-zinc-500">共识</span>
                        </div>
                        <div className="col-span-2 text-xs text-zinc-400">Noun</div>
                        <div className="col-span-2">
                            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="w-[90%] h-full bg-emerald-500"></div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">Optimal</span>
                        </div>
                        <div className="col-span-1 text-right opacity-0 group-hover:opacity-100">
                            <button className="text-zinc-400 hover:text-white">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Warning */}
                    <div className="min-w-[800px] grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-amber-500/[0.05] items-center hover:bg-amber-500/[0.1] transition-colors group relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>

                        <div className="col-span-1 text-xs font-mono text-zinc-400">#2</div>
                        <div className="col-span-3 flex flex-col">
                            <span className="text-sm font-bold text-white">Subjunctive</span>
                            <span className="text-[10px] text-zinc-500">虚拟语气</span>
                        </div>
                        <div className="col-span-2 text-xs text-zinc-400">Adj</div>
                        <div className="col-span-2">
                            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="w-[30%] h-full bg-rose-500"></div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">Too Advanced?</span>
                            <p className="text-[9px] text-zinc-500 mt-1">Goal is 600, this is Lvl 900 word.</p>
                        </div>
                        <div className="col-span-1 text-right">
                            <button className="px-2 py-1 bg-amber-500 text-black text-[10px] font-bold rounded hover:bg-amber-400">Demote</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
