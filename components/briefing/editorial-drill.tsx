"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

import { TTSButton } from "@/components/tts/tts-button";

interface EditorialDrillProps {
    content: string; // "<s>Subject</s> <v>Gap</v> <o>Object</o>"
    answer: string;
    // Managed by parent for layout separation
    status: "idle" | "correct" | "wrong";
    selected: string | null;
    translation?: string;
    explanation?: string;
}

export function EditorialDrill({ content, answer, status, selected, translation, explanation }: EditorialDrillProps) {
    // --- Parser Engine ---
    // Transforms "<s>The manager</s>" -> { type: 's', text: 'The manager' }
    const segments = useMemo(() => {
        // Regex to match tags: <s>...</s>, <v>...</v>, <o>...</o>
        // We split by tags and keep delimiters to identify them
        const regex = /(<[svo]>.*?<\/[svo]>)/g;
        const parts = content.split(regex);

        return parts.map((part) => {
            if (part.startsWith("<s>")) return { type: "s", text: part.replace(/<\/?s>/g, "") };
            if (part.startsWith("<v>")) return { type: "v", text: part.replace(/<\/?v>/g, "") }; // The Gap/Verb
            if (part.startsWith("<o>")) return { type: "o", text: part.replace(/<\/?o>/g, "") };
            return { type: "text", text: part }; // Plain text (connectors, punctuation)
        }).filter(p => p.text.trim() !== ""); // Filter empty splits
    }, [content]);

    // TTS Text: Strip tags and replace Gap with Answer (if revealed) or "blank"
    // Actually, asking TTS to read "blank" might be weird. 
    // Let's read the full sentence with the CORRECT answer for learning reinforcement, 
    // or just the raw sentence structure.
    // For learning, hearing the correct sentence is best.
    const cleanText = useMemo(() => {
        // Simple strip tags first
        let text = content.replace(/<\/?([svo])>/g, "");
        // If there is a "gap" logic (handled by parent logic usually), we assume content has the structure.
        // Wait, content usually has the *Question*. But for TTS we want the full sentence.
        // If content has "___", we should replace it with answer if revealed.
        // But EditorialDrill content usually has the full text wrapped in tags, e.g. "<s>I</s> <v>am</v> <o>here</o>".
        // The <v> part IS the answer/gap content usually?
        // Let's check PRD or logic.
        // <v>Gap</v> -> In the UI logic below (line 61), it renders a Gap line.
        // So `seg.text` inside <v> IS the answer text?
        // Line 82: `status === "correct" ? answer : selected`
        // Wait, if content passes the text to be hidden in <v>...</v>, then seg.text IS the hidden text.
        // So `content.replace(...)` gives the full correct sentence.
        return text;
    }, [content]);

    // Render only the card content
    return (
        <div className="w-full max-w-md flex flex-col min-h-[200px]">

            {/* RICH TEXT FLOW AREA */}
            <div className="flex flex-col items-start justify-center text-left flex-1">

                {/* TTS Control - Top Right */}
                <div className="w-full flex justify-end mb-2">
                    <TTSButton text={cleanText} />
                </div>

                <div className="font-serif text-xl md:text-2xl leading-[2.5rem] text-zinc-800 dark:text-zinc-300 w-full break-words">
                    {segments.map((seg, i) => {
                        if (seg.type === "s") {
                            return (
                                <span key={i} className="relative inline box-decoration-clone bg-emerald-500/10 px-1 py-0.5 rounded border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-100 font-medium mx-1">
                                    {seg.text}
                                    <span className="align-super text-[9px] font-mono text-emerald-600 dark:text-emerald-500 font-bold ml-1 opacity-80">S</span>
                                </span>
                            );
                        }
                        if (seg.type === "o") {
                            return (
                                <span key={i} className="relative inline box-decoration-clone bg-sky-500/10 px-1 py-0.5 rounded border-b-2 border-sky-500 text-sky-700 dark:text-sky-100 font-medium mx-1">
                                    {seg.text}
                                    <span className="align-super text-[9px] font-mono text-sky-600 dark:text-sky-500 font-bold ml-1 opacity-80">O</span>
                                </span>
                            );
                        }
                        if (seg.type === "v") {
                            // Verb Gap -> Answer 使用纯 CSS transition，与其他区域同步 500ms
                            return (
                                <span key={i} className="inline-block relative mx-2 align-baseline min-w-[80px]">
                                    {/* Gap Line - 回答后淡出 */}
                                    <span
                                        className={cn(
                                            "block w-full h-[2px] bg-zinc-400 dark:bg-zinc-600 mt-[1.2rem] transition-opacity duration-500 ease-in-out",
                                            status === "idle" ? "opacity-100 animate-pulse" : "opacity-0"
                                        )}
                                    />
                                    {/* Question Mark - 回答后淡出 */}
                                    <span className={cn(
                                        "absolute -top-6 left-1/2 -translate-x-1/2 text-zinc-400 dark:text-zinc-500 font-mono text-xs transition-opacity duration-500 ease-in-out",
                                        status === "idle" ? "opacity-100" : "opacity-0"
                                    )}>?</span>
                                    {/* Answer - 回答后淡入 */}
                                    <span
                                        className={cn(
                                            "absolute inset-0 flex items-center justify-center font-bold px-2 py-0.5 rounded text-[0.9em] transition-all duration-500 ease-in-out",
                                            status === "idle" ? "opacity-0 scale-90" : "opacity-100 scale-100",
                                            status === "correct" ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50" : status === "wrong" ? "text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-950/50 line-through" : ""
                                        )}
                                    >
                                        {status !== "idle" && (status === "correct" ? answer : selected)}
                                    </span>
                                </span>
                            );
                        }
                        return <span key={i} className="opacity-90">{seg.text}</span>;
                    })}
                </div>

                {/* Translation & Explanation Reveal - CSS Grid Height Animation */}
                <div
                    className={cn(
                        "grid transition-[grid-template-rows,margin,opacity] duration-500 ease-in-out",
                        status !== "idle" ? "grid-rows-[1fr] mt-8 opacity-100" : "grid-rows-[0fr] mt-0 opacity-0"
                    )}
                >
                    <div className="overflow-hidden">
                        <div className="pt-6 border-t border-zinc-200 dark:border-white/5 space-y-4">
                            {translation && (
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-sans text-center leading-relaxed italic">
                                    "{translation}"
                                </p>
                            )}
                            {explanation && (
                                <div className="bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                    <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
                                        <span className="font-bold text-blue-600 dark:text-blue-400 mr-2 uppercase text-xs tracking-wider">Analysis</span>
                                        {explanation}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Context Footer - Fades out instead of unmounting */}
                <div className={cn(
                    "mt-12 w-full border-t border-zinc-200 dark:border-white/5 pt-4 transition-all duration-500 ease-in-out",
                    status === "idle" ? "opacity-100 h-auto" : "opacity-0 h-0 mt-0 pt-0 overflow-hidden"
                )}>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wide">
                        <span className="text-violet-500 dark:text-violet-400 mr-2">///</span> Context: Business Scenario
                    </p>
                </div>
            </div>
        </div>
    );
}
