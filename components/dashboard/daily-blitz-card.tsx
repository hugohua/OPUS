"use client";

import { motion } from "framer-motion";
import { Play, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

export function DailyBlitzCard() {
    const [audioEnabled, setAudioEnabled] = useState(true);

    return (
        <section>
            <Link href="/dashboard/session/BLITZ">
                <div className="relative group cursor-pointer w-full">
                    {/* Ambient Glow (Dark only) - Sunlight Theme */}
                    <div className="hidden dark:block absolute -inset-0.5 bg-gradient-to-r from-yellow-300 to-amber-500 rounded-3xl opacity-60 blur transition duration-1000 group-hover:opacity-100 animate-pulse"></div>

                    <div className="relative bg-white dark:bg-zinc-950 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xl dark:shadow-none h-[220px] flex flex-col justify-between overflow-hidden transition-colors">
                        {/* Background Texture (Dark Only) */}
                        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none hidden dark:block">
                            <div className="w-64 h-64 bg-amber-500/15 blur-3xl rounded-full"></div>
                        </div>

                        <div>
                            <div className="flex justify-between items-start">
                                <span className="inline-flex items-center rounded-md bg-yellow-100 dark:bg-yellow-400/10 px-2 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-300 ring-1 ring-inset ring-yellow-500/20 dark:ring-yellow-400/20 font-mono">
                                    Daily Blitz
                                </span>

                                {/* Audio Toggle (Functional) */}
                                <div
                                    className="flex items-center gap-2 cursor-pointer group/toggle z-10"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setAudioEnabled(!audioEnabled);
                                    }}
                                >
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider group-hover/toggle:text-zinc-700 dark:group-hover/toggle:text-zinc-300 transition-colors">
                                        Audio
                                    </span>
                                    <div className={cn(
                                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                        audioEnabled ? "bg-zinc-200 dark:bg-zinc-700" : "bg-zinc-100 dark:bg-zinc-800"
                                    )}>
                                        <span className={cn(
                                            "inline-block h-3 w-3 transform rounded-full transition duration-200 ease-in-out font-sans flex items-center justify-center text-[8px]",
                                            audioEnabled ? "translate-x-4 bg-emerald-500" : "translate-x-1 bg-zinc-400 dark:bg-zinc-600"
                                        )}>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <h2 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                                Start Session
                                <Volume2
                                    className={cn(
                                        "w-6 h-6 ml-1 transition-all duration-300",
                                        audioEnabled ? "opacity-100 translate-x-0 fill-zinc-900 dark:fill-white text-zinc-900 dark:text-white" : "opacity-0 -translate-x-2"
                                    )}
                                />
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">20 items due · Mixed Mode</p>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            READY TO LAUNCH
                        </div>
                    </div>
                </div>
            </Link>
        </section>
    );
}
