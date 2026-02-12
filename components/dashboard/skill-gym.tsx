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
        name: "极速挑战",
        desc: "视觉 & 语义 (L0)",
        sub: "含: 语法, 陷阱",
        icon: Zap,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        href: "/dashboard/session/L0_MIXED"
    },
    {
        id: "audio-gym",
        name: "听力训练",
        desc: "听力 & 逻辑 (L1)",
        sub: "含: 复读, 短语",
        icon: Volume2,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        href: "/dashboard/session/L1_MIXED"
    },
    {
        id: "context-lab",
        name: "情境实验室",
        desc: "实战演练 (L2)",
        sub: "含: 填空, 辨析",
        icon: Brain,
        color: "text-violet-400",
        bg: "bg-violet-500/10",
        href: "/dashboard/session/L2_MIXED"
    }
];

export function SkillGym() {
    return (
        <section>
            <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-widest text-[10px]">技能训练</h3>
            <div className="grid grid-cols-3 gap-2">
                {SKILLS.map((skill) => (
                    <Link
                        key={skill.id}
                        href={skill.href}
                        className="block"
                    >
                        <button className="w-full bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 p-3 rounded-xl text-left transition-all active:scale-95 group shadow-sm dark:shadow-none h-full relative overflow-hidden">

                            <div className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform",
                                skill.bg,
                                skill.color
                            )}>
                                <skill.icon className="w-4 h-4" strokeWidth={1.5} />
                            </div>

                            <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 leading-tight">{skill.name}</div>
                            <div className="text-[10px] text-zinc-500 mt-1">{skill.desc}</div>
                        </button>
                    </Link>
                ))}
            </div>
        </section>
    );
}
