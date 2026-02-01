'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDrive } from './DriveLayout';

export function DriveHeader() {
    const { theme, setTheme } = useTheme();
    const { playlist, currentIndex } = useDrive();
    const [currentTime, setCurrentTime] = useState('');
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch for time and theme
    useEffect(() => {
        setMounted(true);
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    if (!mounted) return (
        <header className="shrink-0 p-6 flex flex-col gap-4 opacity-80 h-[88px]">
            {/* Skeleton placeholder to prevent layout shift */}
        </header>
    );

    const totalWords = playlist.length;
    const currentWordNum = currentIndex + 1;
    const progress = totalWords > 0 ? (currentWordNum / totalWords) * 100 : 0;

    return (
        <header className="shrink-0 pt-6 px-6 pb-2 flex flex-col gap-4 opacity-80 min-h-[88px]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]"></span>
                    <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Auto-Cycle</span>
                </div>

                <div className="flex items-center gap-4">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        aria-label="Toggle Theme"
                    >
                        {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>

                    <span className="text-xl font-bold font-mono text-muted-foreground/80">
                        {currentTime}
                    </span>
                </div>
            </div>

            {/* Word Progress Counter */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-xs font-mono text-muted-foreground tabular-nums min-w-[3rem] text-right">
                    {currentWordNum}/{totalWords}
                </span>
            </div>
        </header>
    );
}
