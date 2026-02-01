'use client';

import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useDrive } from './DriveLayout';
import { cn } from '@/lib/utils';

export function DriveControls() {
    const { isPlaying, play, pause, next, prev } = useDrive();

    const handlePlayPause = () => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    };

    return (
        <footer className="absolute bottom-0 left-0 w-full h-28 border-t border-border bg-background flex z-50">
            {/* PREV */}
            <button
                onClick={prev}
                className="flex-1 flex items-center justify-center text-muted-foreground hover:text-foreground border-r border-border active:bg-muted/20 transition-colors"
                aria-label="Previous"
            >
                <SkipBack className="w-10 h-10" />
            </button>

            {/* PLAY / PAUSE */}
            <button
                onClick={handlePlayPause}
                className="w-[35%] flex items-center justify-center relative group"
                aria-label={isPlaying ? "Pause" : "Play"}
            >
                <div className="absolute inset-0 bg-brand-core/5 group-active:bg-brand-core/10 transition-colors"></div>
                {isPlaying ? (
                    <Pause className="w-14 h-14 text-brand-core fill-current" />
                ) : (
                    <Play className="w-14 h-14 text-foreground fill-current ml-2" />
                )}
            </button>

            {/* NEXT */}
            <button
                onClick={next}
                className="flex-1 flex items-center justify-center text-muted-foreground hover:text-foreground border-l border-border active:bg-muted/20 transition-colors"
                aria-label="Next"
            >
                <SkipForward className="w-10 h-10" />
            </button>
        </footer>
    );
}
