'use client';

import { ChevronLeft } from "lucide-react";

export function GestureHint() {
    return (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-20 flex items-center justify-end pr-1 opacity-20 pointer-events-none animate-pulse">
            <ChevronLeft className="w-6 h-6 text-white" />
        </div>
    );
}
