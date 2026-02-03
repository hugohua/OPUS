"use client";

import { UniversalCard } from "@/components/drill/universal-card";
import { Skeleton } from "@/components/ui/skeleton";

export function AudioDrillCardSkeleton() {
    const ZoneA = (
        <div className="flex flex-col items-center justify-center gap-8 w-full">
            {/* Waveform Placeholder */}
            <div className="relative w-32 h-32 flex items-center justify-center">
                <Skeleton className="w-20 h-20 rounded-full" />
            </div>

            {/* Hidden Content Placeholder */}
            <div className="h-24 flex items-center justify-center w-full">
                <Skeleton className="h-4 w-32" />
            </div>
        </div>
    );

    const ZoneB = (
        <div className="w-full grid gap-4">
            <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
    );

    return (
        <UniversalCard
            variant="violet"
            category="AUDIO GYM"
            progress={0}
            onExit={() => { }}
            footer={ZoneB}
            clean
        >
            {ZoneA}
        </UniversalCard>
    );
}
