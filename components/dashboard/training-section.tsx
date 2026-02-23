"use client";

import { Zap, BookOpen, Layers, Car, BookOpenCheck } from "lucide-react";
import { DashboardItemCard } from "@/components/dashboard/dashboard-item-card";

const FLASHCARD_MODES = [
    {
        id: "phrase-deck",
        name: "短语卡组",
        desc: "商务搭配",
        sub: "视觉",
        icon: Layers,
        color: "text-indigo-400",
        bg: "bg-indigo-500/10",
        href: "/dashboard/session/PHRASE"
    },
    {
        id: "drive-mode",
        name: "听力驾驶",
        desc: "被动听力",
        sub: "听力",
        icon: Car,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        href: "/drive"
    },
    {
        id: "review-deck",
        name: "复习卡组",
        desc: "滑动复习",
        sub: "记忆",
        icon: BookOpenCheck,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        href: "/dashboard/cards"
    }
];

export function TrainingSection() {
    return (
        <section className="mt-8">
            <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-widest text-[10px]">
                核心训练舱
            </h3>

            <div className="flex flex-col gap-3">
                {/* 1. 高强度实战 (2列) */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-1">
                        <DashboardItemCard
                            href="/dashboard/arena/blitz"
                            icon={Zap}
                            name="单句闪电战"
                            desc="碎片极速快测"
                            sub="Part 5"
                            color="text-violet-500"
                            bg="bg-violet-500/10"
                        />
                    </div>

                    <div className="col-span-1">
                        <DashboardItemCard
                            href="/dashboard/arena/mission"
                            icon={BookOpen}
                            name="阅读狙击战"
                            desc="沉浸商务实战"
                            sub="Part 6/7"
                            color="text-indigo-400"
                            bg="bg-indigo-500/10"
                        />
                    </div>
                </div>

                {/* 2. 基础卡片训练 (3列) */}
                <div className="grid grid-cols-3 gap-3">
                    {FLASHCARD_MODES.map((mode) => (
                        <div key={mode.id} className="col-span-1">
                            <DashboardItemCard
                                href={mode.href}
                                icon={mode.icon}
                                name={mode.name}
                                desc={mode.desc}
                                sub={mode.sub}
                                color={mode.color}
                                bg={mode.bg}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
