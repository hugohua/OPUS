"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Search, Check, Sparkles, ArrowRight } from "lucide-react";
import { MagicWandDrawer } from "@/components/arena/magic-wand-drawer";

export default function MissionPage() {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isWandOpen, setIsWandOpen] = useState(false);
    const [activeBlank, setActiveBlank] = useState<number | null>(null);

    const options = [
        { id: "A", text: "enhance", isCorrect: true },
        { id: "B", text: "enhances", isCorrect: false },
        { id: "C", text: "enhancing", isCorrect: false },
        { id: "D", text: "enhanced", isCorrect: false },
    ];

    const handleSelect = (id: string) => {
        if (selectedOption) return;
        setSelectedOption(id);
    };

    const isRevealed = selectedOption !== null;

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col relative w-full h-full overflow-hidden">

            {/* Header */}
            <header className="py-4 px-4 flex items-center justify-between bg-surface dark:bg-zinc-900 border-b border-border z-10">
                <Link href="/dashboard/arena" className="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <X className="w-5 h-5" />
                </Link>
                <div className="flex bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-full items-center">
                    <span className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Part 6</span>
                </div>
                <button className="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <Search className="w-5 h-5" />
                </button>
            </header>

            {/* Main Content - Scrollable Article Area */}
            {/* Give enough padding-bottom so the sticky drawer at the bottom doesn't hide text permanently. */}
            <main className="flex-1 overflow-y-auto px-6 py-6 pb-[300px] bg-zinc-50 dark:bg-zinc-950/50">
                <div className="mb-6 pb-4 border-b border-border/60">
                    <p className="text-xs font-mono text-secondary mb-1">To: All Staff</p>
                    <p className="text-xs font-mono text-secondary mb-2">From: IT Department</p>
                    <h2 className="text-lg font-bold text-primary">Subject: Quarterly System Maintenance</h2>
                </div>

                <div className="font-serif text-base text-primary leading-loose space-y-4">
                    <p>
                        Please be advised that the IT department will be conducting scheduled maintenance on our primary servers this weekend.
                    </p>
                    <p>
                        The new software update will
                        {/* Interactive Blank 1 */}
                        {selectedOption ? (
                            <span
                                className={`inline-block font-sans font-bold px-2 py-0.5 rounded cursor-pointer mx-1 shadow-sm ${options.find(o => o.id === selectedOption)?.isCorrect
                                        ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/50'
                                        : 'bg-rose-100 text-rose-700 ring-2 ring-rose-400 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-500/50 line-through decoration-rose-300'
                                    }`}
                            >
                                {options.find(o => o.id === selectedOption)?.text}
                            </span>
                        ) : (
                            <span
                                onClick={() => setActiveBlank(1)}
                                className={`inline-block font-sans px-3 py-0.5 rounded border mx-1 cursor-pointer transition-colors ${activeBlank === 1
                                        ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 border-violet-400 dark:border-violet-500 border-solid ring-2 ring-violet-500/20'
                                        : 'bg-surface dark:bg-zinc-900 text-secondary border-border border-dashed hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                [ 填空 1 ]
                            </span>
                        )}
                        the system's overall performance and resolve the latency issues reported last month. During this period, access to the internal portal will be temporarily suspended.
                    </p>
                    <p>
                        We apologize for any
                        {/* Static Blank 2 */}
                        <span className="inline-block bg-surface dark:bg-zinc-900/50 text-secondary font-sans px-3 py-0.5 rounded border border-border border-dashed mx-1">
                            [ 填空 2 ]
                        </span>
                        this may cause and appreciate your patience.
                    </p>
                </div>
            </main>

            {/* Backdrop overlay when blank is active */}
            <div className={`absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px] z-40 transition-opacity duration-300 pointer-events-none ${activeBlank === 1 || isRevealed ? 'opacity-100' : 'opacity-0'}`}></div>

            {/* Sticky Bottom Answer Container */}
            <div
                className={`fixed bottom-0 inset-x-0 w-full max-w-md mx-auto bg-surface dark:bg-zinc-900 rounded-t-3xl z-50 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-spring ${activeBlank === 1 || isRevealed ? 'translate-y-0' : 'translate-y-full'
                    }`}
            >
                <div className="flex-none pt-3 pb-2 flex flex-col items-center">
                    <div className="w-10 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-2"></div>
                    <div className="flex items-center justify-between w-full px-6 mb-2">
                        <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400 tracking-wider">QUESTION 1</span>
                        {isRevealed && (
                            <button
                                onClick={() => setIsWandOpen(true)}
                                className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-1 rounded hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                            >
                                <Sparkles className="w-3.5 h-3.5" /> AI 解析
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 px-6 pb-2 space-y-2.5 max-h-[40vh] overflow-y-auto no-scrollbar">
                    {options.map((opt) => {
                        const isSelected = selectedOption === opt.id;

                        let stateClasses = "border-border bg-background dark:bg-zinc-950/50 text-secondary hover:border-violet-500";
                        let icon = null;

                        if (isRevealed) {
                            if (opt.isCorrect) {
                                stateClasses = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]";
                                icon = <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
                            } else if (isSelected && !opt.isCorrect) {
                                stateClasses = "border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-400";
                                icon = <X className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
                            } else {
                                stateClasses = "border-border bg-background dark:bg-zinc-950/50 text-secondary dark:opacity-60 opacity-50";
                            }
                        }

                        return (
                            <button
                                key={opt.id}
                                onClick={() => handleSelect(opt.id)}
                                disabled={isRevealed}
                                className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 font-medium transition-all ${!isRevealed ? 'active:scale-[0.98]' : ''} ${stateClasses}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded flex items-center justify-center font-mono text-xs font-bold ${isRevealed && opt.isCorrect ? 'bg-emerald-200/50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : isRevealed && isSelected && !opt.isCorrect ? 'bg-rose-200/50 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400' : 'bg-surface dark:bg-zinc-800 shadow-sm text-secondary'}`}>
                                        {opt.id}
                                    </span>
                                    <span className={`text-base transition-all ${isRevealed && isSelected && !opt.isCorrect ? 'line-through decoration-rose-300 dark:decoration-rose-700/50' : ''} ${!isRevealed ? 'text-primary' : ''}`}>
                                        {opt.text}
                                    </span>
                                </div>
                                {icon}
                            </button>
                        );
                    })}
                </div>

                {/* Floating Next Button attached to container bottom */}
                {isRevealed && (
                    <div className="p-4 pt-2 pb-safe bg-surface dark:bg-zinc-900 border-t border-border mt-2 rounded-b-3xl">
                        <button className="w-full inline-flex items-center justify-center rounded-lg text-sm font-bold transition-colors h-12 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-lg active:scale-[0.98]">
                            继续 <ArrowRight className="w-4 h-4 ml-2" />
                        </button>
                    </div>
                )}
            </div>

            <MagicWandDrawer open={isWandOpen} onOpenChange={setIsWandOpen} />
        </div>
    );
}
