"use client";

import { useTTS } from "@/hooks/use-tts";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { formatDuration } from "date-fns"; // Or manual formatter

interface TTSPlayerProps {
    text: string;
    voice?: string;
    className?: string;
    autoPlay?: boolean;
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TTSPlayer({
    text,
    voice = "Cherry",
    className,
    autoPlay = false,
}: TTSPlayerProps) {
    const { play, stop, isPlaying, isLoading, status, duration, currentTime, error } = useTTS();
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (autoPlay && !initialized && text) {
            play({ text, voice });
            setInitialized(true);
        }
    }, [autoPlay, initialized, text, voice, play]);

    const togglePlay = () => {
        if (isPlaying) {
            stop(); // Note: useTTS currently only supports stop, not pause/resume efficiently without keeping audio instance
            // For V1, stop is fine. V2 can handle pause.
        } else {
            play({ text, voice });
        }
    };

    return (
        <div className={cn("flex flex-col gap-2 p-4 rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
            <div className="flex items-center gap-4">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={togglePlay}
                    disabled={!text}
                >
                    {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
                    ) : isPlaying ? (
                        <Pause className="h-5 w-5" strokeWidth={1.5} />
                    ) : (
                        <Play className="h-5 w-5 ml-0.5" strokeWidth={1.5} /> // Optical adjustment
                    )}
                </Button>

                <div className="flex-1 flex flex-col gap-1">
                    <Slider
                        value={[currentTime]}
                        max={duration || 100}
                        step={0.1}
                        className="cursor-pointer"
                        onValueChange={(vals) => {
                            // Seek logic would go here, requires exposing audioRef from hook or add seek method
                        }}
                        disabled={!isPlaying && status !== 'playing'} // Disable if not ready
                    />
                    <div className="flex justify-between text-xs text-muted-foreground w-full">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="text-xs text-destructive px-1">
                    Error: {error}
                </div>
            )}
        </div>
    );
}
