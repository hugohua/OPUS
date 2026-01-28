"use client";

import { useTTS } from "@/hooks/use-tts";
import { Button } from "@/components/ui/button";
import { Loader2, Volume2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface TTSButtonProps {
    text: string;
    voice?: string;
    language?: string;
    speed?: number;
    className?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    autoPlay?: boolean;
}

export function TTSButton({
    text,
    voice = "Cherry",
    language = "en-US",
    speed = 1.0,
    className,
    variant = "ghost",
    size = "icon",
    autoPlay = false,
}: TTSButtonProps) {
    const { play, stop, isPlaying, isLoading, status } = useTTS();
    const [hasAutoPlayed, setHasAutoPlayed] = useState(false);

    useEffect(() => {
        if (autoPlay && !hasAutoPlayed && text) {
            play({ text, voice, language, speed });
            setHasAutoPlayed(true);
        }
    }, [autoPlay, hasAutoPlayed, text, voice, language, speed, play]);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // 防止冒泡触发父级点击
        if (isPlaying || isLoading) {
            stop();
        } else {
            play({ text, voice, language, speed });
        }
    };

    return (
        <Button
            variant={variant}
            size={size}
            className={cn("transition-all duration-200", className)}
            onClick={handleClick}
            disabled={!text}
            title={isPlaying ? "Stop" : "Play TTS"}
        >
            {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : isPlaying ? (
                <Square className="h-4 w-4 fill-current" strokeWidth={1.5} />
            ) : (
                <Volume2 className="h-4 w-4" strokeWidth={1.5} />
            )}
        </Button>
    );
}
