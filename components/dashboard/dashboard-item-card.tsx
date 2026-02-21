"use client";

import { createElement } from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardItemCardProps {
    href: string;
    icon: LucideIcon;
    name: string;
    desc: string;
    sub: string;
    color: string;
    bg: string;
}

export function DashboardItemCard({ href, icon, name, desc, sub, color, bg }: DashboardItemCardProps) {
    const borderColor = color.replace('text-', 'border-').replace('400', '500/20').replace('500', '500/20');

    return (
        <Link href={href} className="block w-full h-full">
            <button className="w-full h-full bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 p-4 rounded-xl text-left transition-all active:scale-95 group shadow-sm dark:shadow-none relative overflow-hidden flex flex-col justify-between">
                <div className="w-full">
                    <div className="flex items-start justify-between">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform",
                            bg,
                            color
                        )}>
                            {createElement(icon, { className: "w-5 h-5", strokeWidth: 1.5 })}
                        </div>

                        {/* Tag */}
                        <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-md border opacity-60 font-mono",
                            borderColor,
                            bg,
                            color
                        )}>
                            {sub}
                        </span>
                    </div>

                    <div className="font-medium text-base text-zinc-900 dark:text-zinc-100">
                        {name}
                    </div>
                </div>

                <div className="text-xs text-zinc-500 mt-1 font-medium w-full">
                    {desc}
                </div>
            </button>
        </Link>
    );
}
