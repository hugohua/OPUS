"use client";

import {
    Puzzle, // Grammar 
    Eye,    // Visual
    Ear,    // Listening
    Zap     // Speed
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SKILLS = [
    {
        id: "grammar",
        name: "Grammar",
        desc: "Part 5 Focus",
        icon: Puzzle,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        href: "/dashboard/session/syntax?mode=grammar"
    },
    {
        id: "visual",
        name: "Visual Traps",
        desc: "Discrimination",
        icon: Eye,
        color: "text-pink-400",
        bg: "bg-pink-500/10",
        href: "/dashboard/session/visual"
    },
    {
        id: "listening",
        name: "Listening",
        desc: "Part 2 Reflex",
        icon: Ear,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        href: "/dashboard/session/audio"
    },
    {
        id: "speed",
        name: "Speed Read",
        desc: "WPM Training",
        icon: Zap,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        href: "/dashboard/session/reading"
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
                        className="block"
                    >
                        <button className="w-full bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 p-4 rounded-xl text-left transition-all active:scale-95 group shadow-sm dark:shadow-none">
                            <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform",
                                skill.bg,
                                skill.color
                            )}>
                                <skill.icon className="w-4 h-4" strokeWidth={2} />
                            </div>
                            <div className="font-medium text-sm text-zinc-900 dark:text-zinc-200">{skill.name}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">{skill.desc}</div>
                        </button>
                    </Link>
                ))}
            </div>
        </section>
    );
}
