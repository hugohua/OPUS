'use client';

import { useDrive } from './DriveLayout';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

export function DriveMain() {
    const { playlist, currentIndex, playbackStage } = useDrive();
    const currentItem = playlist[currentIndex];

    if (!currentItem) return null;

    return (
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center relative z-10 pb-20 select-none">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentItem.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.05, y: -10 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center gap-8 w-full max-w-5xl"
                >
                    {/* ENGLISH TEXT */}
                    <h1 className="text-[5vh] md:text-[7vh] leading-[1.1] font-bold text-foreground mx-auto text-balance drop-shadow-md">
                        {/* 
                           TODO: Ideally parse the 'text' to bold specific keywords. 
                           For now, we just display the full text. 
                           We can highlight the last word as a heuristic or simply style the whole sentence.
                        */}
                        {currentItem.text.split(' ').map((word: string, idx: number, arr: string[]) => {
                            const isKey = idx === arr.length - 1; // Simple heuristic: last word is focus for now
                            return (
                                <span key={idx} className={cn("inline-block mr-[0.2em]",
                                    isKey && "text-brand-core relative"
                                )}>
                                    {word}
                                    {isKey && (
                                        <span className="absolute inset-0 bg-brand-core/10 blur-xl rounded-full -z-10"></span>
                                    )}
                                </span>
                            )
                        })}
                    </h1>

                    {/* TRANSLATION */}
                    {/* TRANSLATION */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{
                            opacity: (currentItem.mode === 'QUIZ' && playbackStage !== 'meaning') ? 0 : 1,
                            y: 0
                        }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="mt-4"
                    >
                        <p className="text-[3vh] md:text-[3.5vh] font-medium text-muted-foreground leading-relaxed">
                            {currentItem.trans}
                        </p>
                    </motion.div>

                    {/* DIVIDER */}
                    <div className="w-16 h-1 bg-border rounded-full my-6 opacity-50"></div>

                    {/* METADATA (Phonetic / Word Meaning) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                        className="flex items-center gap-6 mt-6"
                    >
                        {/* Word Info (Left) */}
                        <div className="flex flex-col items-end">
                            <span className="text-2xl font-mono font-bold text-muted-foreground">
                                {currentItem.word}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground/80 tracking-wide">
                                {currentItem.phonetic}
                            </span>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-10 bg-border/60"></div>

                        {/* Meaning Info (Right) - Hide in Gap/Word stage for QUIZ */}
                        <motion.div
                            animate={{
                                opacity: (currentItem.mode === 'QUIZ' && playbackStage !== 'meaning') ? 0.3 : 1,
                                filter: (currentItem.mode === 'QUIZ' && playbackStage !== 'meaning') ? 'blur(4px)' : 'none'
                            }}
                            className="flex flex-col items-start"
                        >
                            <span className="text-2xl font-bold text-amber-500 text-shadow-sm flex items-baseline gap-1">
                                <span className="text-base font-normal opacity-80">{currentItem.pos}</span>
                                {currentItem.meaning}
                            </span>
                            <span className="text-[10px] text-amber-500/50 uppercase tracking-[0.2em] font-medium">
                                Core Meaning
                            </span>
                        </motion.div>
                    </motion.div>

                </motion.div>
            </AnimatePresence>
        </main>
    );
}
