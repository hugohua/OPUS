'use client';

import { useRouter } from 'next/navigation';
import {
    Activity,
    BookOpen,
    Brain,
    FileText,
    History,
    Layers,
    Play,
    Split,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { DiagnosticRadar } from "@/components/arena/diagnostic-radar";
import { SimulateScenarioCard, type ScenarioTheme } from "@/components/dashboard/simulate-scenario-card";
import { FloatingDockClient } from "@/components/dashboard/floating-dock-client";
import { HeaderActionDropdown } from "@/components/dashboard/header-action-dropdown";
import { GlobalHeader } from "@/components/ui/global-header";
import { cn } from "@/lib/utils";
import {
    buildTrainingMatrix,
    type TrainingMatrixDestination,
    type TrainingMatrixEntry,
    type TrainingMatrixSection,
} from "@/lib/backend-core/training/matrix";

const TRAINING_MATRIX = buildTrainingMatrix();

const ICONS: Record<string, LucideIcon> = {
    activity: Activity,
    bolt: Zap,
    zap: Zap,
    book: BookOpen,
    "book-open": BookOpen,
    brain: Brain,
    "file-text": FileText,
    history: History,
    layers: Layers,
    play: Play,
    split: Split,
};

const sectionThemeStyles: Record<ScenarioTheme, string> = {
    amber: "text-amber-600 dark:text-amber-500 bg-amber-100/50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-900/50",
    cyan: "text-cyan-600 dark:text-cyan-500 bg-cyan-100/50 dark:bg-cyan-950/30 border-cyan-200/50 dark:border-cyan-900/50",
    emerald: "text-emerald-600 dark:text-emerald-500 bg-emerald-100/50 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-900/50",
    indigo: "text-indigo-600 dark:text-indigo-500 bg-indigo-100/50 dark:bg-indigo-950/30 border-indigo-200/50 dark:border-indigo-900/50",
    rose: "text-rose-600 dark:text-rose-500 bg-rose-100/50 dark:bg-rose-950/30 border-rose-200/50 dark:border-rose-900/50",
    violet: "text-violet-600 dark:text-violet-500 bg-violet-100/50 dark:bg-violet-950/30 border-violet-200/50 dark:border-violet-900/50",
};

export default function SimulatePage() {
    const router = useRouter();

    const handleDestination = (destination: TrainingMatrixDestination) => {
        const href = hrefForDestination(destination);
        if (href) {
            router.push(href);
        }
    };

    return (
        <div className="relative min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 font-sans antialiased selection:bg-indigo-500/30 pb-20">
            <GlobalHeader
                title="训练矩阵"
                showStatusLight={true}
                rightSlot={<HeaderActionDropdown variant="simulate" />}
            />

            <main className="max-w-4xl mx-auto p-6 space-y-8 relative z-10">
                {TRAINING_MATRIX.sections.map((section) => (
                    <MatrixSection
                        key={section.id}
                        section={section}
                        onNavigate={handleDestination}
                    />
                ))}
            </main>

            <FloatingDockClient />
        </div>
    );
}

function MatrixSection({
    section,
    onNavigate,
}: {
    section: TrainingMatrixSection;
    onNavigate: (destination: TrainingMatrixDestination) => void;
}) {
    if (section.id === "diagnostics") {
        return (
            <section className="mb-8">
                <DiagnosticRadar />
            </section>
        );
    }

    return (
        <section>
            <div className="flex items-center gap-2 mb-4">
                <span className={cn(
                    "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border",
                    sectionThemeStyles[section.theme]
                )}>
                    {section.label}
                </span>
                <h2 className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-widest">
                    {section.title}
                </h2>
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1 ml-2" />
            </div>

            <div className={cn(
                "grid grid-cols-1 gap-3",
                section.id === "l0" ? "md:grid-cols-3" : "md:grid-cols-2",
                section.id === "arena" && "mb-8"
            )}>
                {section.entries.map((entry) => section.id === "l0" ? (
                    <QueueScenarioButton
                        key={entry.id}
                        entry={entry}
                        onClick={() => onNavigate(entry.destination)}
                    />
                ) : (
                    <MatrixScenarioCard
                        key={entry.id}
                        entry={entry}
                        onClick={() => onNavigate(entry.destination)}
                    />
                ))}
            </div>
        </section>
    );
}

function MatrixScenarioCard({
    entry,
    onClick,
}: {
    entry: TrainingMatrixEntry;
    onClick: () => void;
}) {
    const Icon = iconForEntry(entry);
    const href = hrefForDestination(entry.destination);

    return (
        <SimulateScenarioCard
            title={entry.title}
            desc={entry.subtitle}
            tag={entry.tag}
            icon={Icon}
            href={href}
            onClick={href ? undefined : onClick}
            theme={entry.accent}
        />
    );
}

function QueueScenarioButton({
    entry,
    onClick,
}: {
    entry: TrainingMatrixEntry;
    onClick: () => void;
}) {
    const Icon = iconForEntry(entry);

    return (
        <button
            onClick={onClick}
            className="group relative flex flex-col p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/15 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:backdrop-blur-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-amber-500/40 dark:hover:border-amber-500/40 transition-all text-left overflow-hidden"
        >
            <div className="flex justify-between items-start w-full mb-3">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-zinc-400 group-hover:text-amber-500 transition-colors" />
                    <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
                        {entry.tag}
                    </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 transition-colors group-hover:bg-amber-500" />
            </div>

            <h3 className="text-zinc-900 dark:text-zinc-100 font-bold mb-1">{entry.title}</h3>

            <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-col items-start w-full gap-1">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-600">{entry.subtitle}</span>
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-500">{entry.detail}</span>
            </div>
        </button>
    );
}

function iconForEntry(entry: TrainingMatrixEntry): LucideIcon {
    return ICONS[entry.systemImage] ?? Activity;
}

function hrefForDestination(destination: TrainingMatrixDestination): string | undefined {
    switch (destination.kind) {
        case "arena":
            return destination.value === "mission"
                ? "/dashboard/arena/mission"
                : "/dashboard/arena/blitz";
        case "briefing":
            return destination.value === "history" ? "/weaver/history" : "/weaver";
        case "training":
            return `/dashboard/session/${destination.value}`;
        case "diagnostics":
            return undefined;
    }
}
