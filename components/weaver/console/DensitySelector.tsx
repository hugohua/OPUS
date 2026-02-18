import React from "react";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEAVER_DENSITY_CONFIGS, WeaverDensityType } from "@/lib/constants/weaver-density";

interface DensitySelectorProps {
    selectedDensity: WeaverDensityType;
    onSelect: (densityId: WeaverDensityType) => void;
    disabled?: boolean;
}

export function DensitySelector({ selectedDensity, onSelect, disabled }: DensitySelectorProps) {
    return (
        <section className="px-6 py-6 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">
                    3. 篇幅密度
                </h2>

            </div>
            <div className="grid grid-cols-3 gap-2">
                {WEAVER_DENSITY_CONFIGS.map((density) => {
                    const Icon = density.icon;
                    const isSelected = selectedDensity === density.id;
                    return (
                        <button
                            key={density.id}
                            onClick={() => onSelect(density.id)}
                            disabled={disabled}
                            className={cn(
                                "flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200",
                                isSelected
                                    ? "bg-violet-50 dark:bg-violet-500/20 border-violet-200 dark:border-violet-500/50 shadow-sm"
                                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                                disabled && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <Icon className={cn(
                                "w-5 h-5 mb-2 transition-colors",
                                isSelected ? "text-violet-600 dark:text-violet-300" : "text-zinc-400"
                            )} />
                            <span className={cn(
                                "text-xs font-bold mb-0.5",
                                isSelected ? "text-violet-900 dark:text-violet-100" : "text-zinc-700 dark:text-zinc-300"
                            )}>
                                {density.label}
                            </span>
                            <span className="text-[10px] text-zinc-400 text-center leading-tight">
                                {density.desc}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
