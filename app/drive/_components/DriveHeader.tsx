'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDrive } from './DriveLayout';
import { ImmersiveHeader } from '@/components/ui/immersive-header';
import { useRouter } from 'next/navigation';

export function DriveHeader() {
    const { theme, setTheme } = useTheme();
    const { playlist, currentIndex } = useDrive();
    const [currentTime, setCurrentTime] = useState('');
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

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
        <ImmersiveHeader className="opacity-80 h-[88px] bg-transparent dark:bg-transparent" />
    );

    const totalWords = playlist.length;
    const currentWordNum = currentIndex + 1;
    const progress = totalWords > 0 ? (currentWordNum / totalWords) * 100 : 0;

    return (
        <ImmersiveHeader
            className="bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl shrink-0 border-b border-transparent dark:border-white/5"
            progress={progress}
            leftAction={
                <button
                    onClick={() => router.push('/dashboard')}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300/50 dark:hover:bg-zinc-700 transition-colors active:scale-95"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            }
            centerContent={
                <div className="flex bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-full items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]"></span>
                    <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest leading-none">
                        Auto-Cycle • {currentWordNum}/{totalWords}
                    </span>
                </div>
            }
            rightAction={
                <>
                    <button
                        onClick={toggleTheme}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
                        aria-label="Toggle Theme"
                    >
                        {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <div className="h-10 px-3 flex items-center justify-center">
                        <span className="text-sm font-bold font-mono text-zinc-500 dark:text-zinc-400">
                            {currentTime}
                        </span>
                    </div>
                </>
            }
        />
    );
}
