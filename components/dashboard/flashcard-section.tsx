"use client";

import { Layers, Car } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const FLASHCARD_MODES = [
    {
        id: "phrase-deck",
        name: "Phrase Deck",
        desc: "Business Collocations",
        sub: "L0 • Visual",
        icon: Layers,
        color: "text-indigo-400",
        bg: "bg-indigo-500/10",
        href: "/dashboard/session/PHRASE"
    },
    {
        id: "drive-mode",
        name: "Audio Drive",
        desc: "Passive Listening",
        sub: "L0 • Audio",
        icon: Car,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        href: "/drive"
    }
];

export function FlashcardSection() {
    return (
        <section>
            <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-widest text-[10px]">
                Flashcards
            </h3>

            <div className="grid grid-cols-2 gap-3">
                {FLASHCARD_MODES.map((mode) => (
                    <Link
                        key={mode.id}
                        href={mode.href}
                        className="block col-span-2 md:col-span-1"
                    >
                        <button className="w-full bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 p-4 rounded-xl text-left transition-all active:scale-95 group shadow-sm dark:shadow-none h-full relative overflow-hidden">

                            <div className="flex items-start justify-between">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform",
                                    mode.bg,
                                    mode.color
                                )}>
                                    <mode.icon className="w-5 h-5" strokeWidth={1.5} />
                                </div>

                                {/* Tag */}
                                <span className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded-md border opacity-60 font-mono",
                                    mode.color.replace('text-', 'border-').replace('400', '500/20'),
                                    mode.bg
                                )}>
                                    {mode.sub}
                                </span>
                            </div>

                            <div className="font-medium text-base text-zinc-900 dark:text-zinc-100">
                                {mode.name}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1 font-medium">
                                {mode.desc}
                            </div>
                        </button>
                    </Link>
                ))}
            </div>
        </section>
    );
}
