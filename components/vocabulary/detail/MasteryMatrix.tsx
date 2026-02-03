"use client";

import { cn } from "@/lib/utils";
import { UserProgress } from "@prisma/client";

interface MasteryMatrixProps {
    tracks: {
        VISUAL: UserProgress | null;
        AUDIO: UserProgress | null;
        CONTEXT: UserProgress | null;
    };
}

export function MasteryMatrix({ tracks }: MasteryMatrixProps) {
    return (
        <section className="w-full px-4 mb-6">
            <div className={cn(
                "w-full grid grid-cols-3 gap-2 p-4",
                "bg-white/50 dark:bg-zinc-900/60",
                "backdrop-blur-xl",
                "border border-zinc-200 dark:border-white/15",
                "rounded-2xl shadow-sm"
            )}>
                <TrackRing
                    track="VISUAL"
                    label="视觉"
                    score={tracks.VISUAL?.stability || 0}
                    color="text-emerald-500"
                />
                <TrackRing
                    track="AUDIO"
                    label="听觉"
                    score={tracks.AUDIO?.stability || 0}
                    color="text-violet-500"
                />
                <TrackRing
                    track="CONTEXT"
                    label="语境"
                    score={tracks.CONTEXT?.stability || 0}
                    color="text-sky-500"
                />
            </div>
        </section>
    );
}

function TrackRing({
    track,
    label,
    score,
    color
}: {
    track: string,
    label: string,
    score: number,
    color: string
}) {
    // Score normalization: roughly 0-100 based on stability
    // Assuming stability ranges from 0 to 365 (days). 
    // Let's cap visual logic at 100 for stability > 30 days means "Solid"
    const percentage = Math.min(100, Math.max(0, (score / 30) * 100));

    const radius = 24;
    const stroke = 4;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative h-14 w-14 flex items-center justify-center">
                <svg
                    height={radius * 2}
                    width={radius * 2}
                    className="rotate-[-90deg]"
                >
                    {/* Background Ring */}
                    <circle
                        stroke="currentColor"
                        fill="transparent"
                        strokeWidth={stroke}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                        className="text-zinc-200 dark:text-zinc-800"
                    />
                    {/* Progress Ring */}
                    <circle
                        stroke="currentColor"
                        fill="transparent"
                        strokeWidth={stroke}
                        strokeDasharray={circumference + ' ' + circumference}
                        style={{ strokeDashoffset }}
                        strokeLinecap="round"
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                        className={cn("transition-all duration-1000 ease-out", color)}
                    />
                </svg>

                {/* Score Text */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn("text-xs font-bold", color)}>
                        {Math.round(score)}
                    </span>
                </div>
            </div>

            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                {label}
            </span>
        </div>
    );
}
