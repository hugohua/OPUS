"use client";

import { Zap, BookOpen } from "lucide-react";
import { DashboardItemCard } from "@/components/dashboard/dashboard-item-card";

export function ArenaSection() {
    return (
        <section className="mt-8">
            <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-widest text-[10px]">
                实战演练舱
            </h3>

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
        </section>
    );
}
