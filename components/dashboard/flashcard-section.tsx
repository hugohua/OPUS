"use client";

import { Layers, Car, BookOpenCheck } from "lucide-react";
import { DashboardItemCard } from "@/components/dashboard/dashboard-item-card";

const FLASHCARD_MODES = [
    {
        id: "phrase-deck",
        name: "短语卡组",
        desc: "商务搭配",
        sub: "L0 • 视觉",
        icon: Layers,
        color: "text-indigo-400",
        bg: "bg-indigo-500/10",
        href: "/dashboard/session/PHRASE"
    },
    {
        id: "drive-mode",
        name: "听力驾驶",
        desc: "被动听力",
        sub: "L0 • 听力",
        icon: Car,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        href: "/drive"
    },
    {
        id: "review-deck",
        name: "复习卡组",
        desc: "滑动复习",
        sub: "L0 • 记忆",
        icon: BookOpenCheck,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        href: "/dashboard/cards"
    }
];

export function FlashcardSection() {
    return (
        <section>
            <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-widest text-[10px]">
                卡片
            </h3>

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
        </section>
    );
}
