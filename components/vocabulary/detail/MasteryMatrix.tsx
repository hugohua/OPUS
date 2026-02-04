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
        <section className="w-full px-6 mb-6">
            <div className="grid grid-cols-3 gap-4 border-t border-zinc-100 pt-6 mt-6">
                <TrackBar
                    label="Visual"
                    track={tracks.VISUAL}
                    colorClass="bg-indigo-500"
                />
                <TrackBar
                    label="Audio"
                    track={tracks.AUDIO}
                    colorClass="bg-violet-500"
                />
                <TrackBar
                    label="Context"
                    track={tracks.CONTEXT}
                    colorClass="bg-sky-500"
                />
            </div>
        </section>
    );
}

function TrackBar({
    label,
    track,
    colorClass
}: {
    label: string,
    track: UserProgress | null,
    colorClass: string
}) {
    // Score normalization: roughly 0-100 based on stability
    const score = track?.stability || 0;
    const percentage = Math.min(100, Math.max(5, (score / 30) * 100)); // Min 5% for visibility
    const isActive = !!track;

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                {label}
            </span>
            <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div
                    className={cn("h-full transition-all duration-500", isActive ? colorClass : "bg-zinc-200 w-0")}
                    style={{ width: isActive ? `${percentage}%` : '0%' }}
                ></div>
            </div>
            <span className={cn("text-[10px] font-bold font-mono", isActive ? "text-zinc-700" : "text-zinc-300")}>
                {isActive ? `Lvl ${Math.floor(score)}` : "--"}
            </span>
        </div>
    );
}
