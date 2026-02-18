import React from "react";
import { Building2, Code, FileText, Mail, MessageSquare, Briefcase, Terminal, PenTool, GraduationCap, Coffee, Scale, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenarios";

interface ContextSelectorProps {
    selectedScenario: string;
    onSelect: (scenarioId: string) => void;
    disabled?: boolean;
}

const SCENARIO_ICONS: Record<string, any> = {
    "finance": Briefcase,
    "tech": Terminal,
    "product": PenTool,
    "academic": GraduationCap,
    "daily": Coffee,
    "legal": Scale,
};

// Fallback icon
const DefaultIcon = MessageSquare;

// Helper to get icon
function getIcon(id: string) {
    const Icon = SCENARIO_ICONS[id] || DefaultIcon;
    return <Icon className="w-5 h-5 flex-shrink-0" />;
}

export function ContextSelector({ selectedScenario, onSelect, disabled }: ContextSelectorProps) {
    return (
        <section className="px-6 py-6 border-t border-zinc-100 dark:border-zinc-800">
            <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-4">
                2. 情境选择 (Context)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WEAVER_SCENARIOS.map((scenario) => (
                    <button
                        key={scenario.id}
                        onClick={() => onSelect(scenario.id)}
                        disabled={disabled}
                        className={cn(
                            "group flex items-start text-left p-3 rounded-lg border transition-all duration-200 overflow-hidden relative",
                            selectedScenario === scenario.id
                                ? "bg-violet-50 dark:bg-violet-500/20 border-violet-200 dark:border-violet-500/50 shadow-sm ring-1 ring-violet-200 dark:ring-violet-500/30"
                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <div className={cn(
                            "mr-3 mt-0.5 p-1.5 rounded-md transition-colors",
                            selectedScenario === scenario.id
                                ? "bg-violet-100 dark:bg-violet-500/40 text-violet-600 dark:text-violet-200"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                        )}>
                            {getIcon(scenario.id)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-sm font-bold font-mono tracking-tight",
                                    selectedScenario === scenario.id
                                        ? "text-violet-900 dark:text-violet-100"
                                        : "text-zinc-700 dark:text-zinc-300"
                                )}>
                                    {scenario.label}
                                </span>
                                {selectedScenario === scenario.id && (
                                    <span className="inline-flex w-1.5 h-1.5 rounded-full bg-violet-500 animate-[pulse_3s_infinite]"></span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                                {scenario.description}
                            </p>
                        </div>

                        {/* Selection Indicator (Checkmark) */}
                        {selectedScenario === scenario.id && (
                            <div className="absolute top-2 right-2 text-violet-500 dark:text-violet-400">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </section>
    );
}
