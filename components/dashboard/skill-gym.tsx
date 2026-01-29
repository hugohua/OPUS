"use client";

import {
    Zap,        // Speed Run
    Volume2,    // Audio Gym
    Brain,      // Context Lab
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SKILLS = [
    {
        id: "speed-run",
        name: "Speed Run",
        desc: "Visual & Meaning (L0)",
        sub: "Includes: Syntax, Trap",
        icon: Zap,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        href: "/dashboard/session/SYNTAX?mix=VISUAL"
    },
    {
        id: "audio-gym",
        name: "Audio Gym",
        desc: "Listening & Logic (L1)",
        sub: "Includes: Echo, Phrase",
        icon: Volume2,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        href: "/dashboard/session/AUDIO?mix=PHRASE"
    },
    {
        id: "context-lab",
        name: "Context Lab",
        desc: "Real-world Ops (L2)",
        sub: "Includes: Cloze, Nuance",
        icon: Brain,
        color: "text-violet-400",
        bg: "bg-violet-500/10",
        href: "/dashboard/session/CHUNKING"
    }
];

export function SkillGym() {
    return (
        <section>
            <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-widest text-[10px]">Skill Gym</h3>
            <div className="grid grid-cols-2 gap-3">
                {SKILLS.map((skill) => (
                    <Link
                        key={skill.id}
                        href={skill.href}
                        className={cn(
                            "block",
                            // Context Lab spans full width if odd number of items
                            skill.id === "context-lab" && "col-span-2"
                        )}
                    >
                        <button className="w-full bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 p-4 rounded-xl text-left transition-all active:scale-95 group shadow-sm dark:shadow-none h-full relative overflow-hidden">

                            <div className="flex items-start justify-between">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform",
                                    skill.bg,
                                    skill.color
                                )}>
                                    <skill.icon className="w-5 h-5" strokeWidth={1.5} />
                                </div>

                                {/* Sub-skills Tag */}
                                <span className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded-md border  opacity-60",
                                    skill.color.replace('text-', 'border-').replace('400', '500/20'),
                                    skill.bg
                                )}>
                                    {skill.sub.replace('Includes: ', '')}
                                </span>
                            </div>

                            <div className="font-medium text-base text-zinc-900 dark:text-zinc-100">{skill.name}</div>
                            <div className="text-xs text-zinc-500 mt-1 font-medium">{skill.desc}</div>
                        </button>
                    </Link>
                ))}
            </div>
        </section>
    );
}
