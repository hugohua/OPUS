"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

import { TTSButton } from "@/components/tts/tts-button";

interface EditorialDrillProps {
    content: string; // "<s>Subject</s> <v>Verb</v> <o>Object</o>"
    questionMarkdown?: string; // "The manager _______ the plan." - 用于确定挖空位置
    answer: string;
    // Managed by parent for layout separation
    status: "idle" | "correct" | "wrong";
    selected: string | null;
    translation?: string;
    explanation?: string;
}

export function EditorialDrill({ content, questionMarkdown, answer, status, selected, translation, explanation }: EditorialDrillProps) {

    // --- Advanced Parser Engine ---
    // 1. Calculate Gap Range in Plain Text
    // 2. Map Segments to Plain Text Ranges
    // 3. Split Segments if they overlap with Gap Range

    const processedSegments = useMemo(() => {
        // Step 1: Extract Plain Text & Basic Segments
        const regex = /(<(?:s|v|o|chunk)>.*?<\/(?:s|v|o|chunk)>)/g;
        const rawParts = content.split(regex);

        let plainText = "";
        const basicSegments = rawParts.map(part => {
            let type = "text";
            let rawContent = part;

            if (part.startsWith("<s>")) {
                type = "s";
                rawContent = part.replace(/<\/?s>/g, "");
            } else if (part.startsWith("<v>")) {
                type = "v";
                rawContent = part.replace(/<\/?v>/g, "");
            } else if (part.startsWith("<o>")) {
                type = "o";
                rawContent = part.replace(/<\/?o>/g, "");
            } else if (part.startsWith("<chunk>")) {
                type = "chunk";
                rawContent = part.replace(/<\/?chunk>/g, "");
            }

            // Record range in plainText
            const start = plainText.length;
            plainText += rawContent;
            const end = plainText.length;

            return { type, text: rawContent, start, end };
        }).filter(p => p.text !== "");

        // Step 2: Find Gap Range (Start/End indices in plainText)
        let gapStart = -1;
        let gapEnd = -1;

        if (questionMarkdown) {
            // Normalize for comparison (optional, but keep simple for now)
            const p = plainText;
            const q = questionMarkdown;

            // Find Common Prefix Length
            let i = 0;
            while (i < p.length && i < q.length && p[i] === q[i]) i++;
            const prefixLen = i;

            // Find Common Suffix Length
            // Only search backwards up to the prefix
            let j = 0;
            while (j < (p.length - prefixLen) && j < (q.length - prefixLen) &&
                p[p.length - 1 - j] === q[q.length - 1 - j]) {
                j++;
            }
            const suffixLen = j;

            // Gap Range in PlainText
            gapStart = prefixLen;
            gapEnd = p.length - suffixLen;

            // Sanity Check: If gap is invalid or empty
            if (gapStart >= gapEnd) {
                // Fallback: If no gap detected via diff (e.g. slight mismatch), try regex fallback?
                // Or try finding "_______" in Q and mapping back?
                // Use fallback to <v> tag if gap detection fails completely
                gapStart = -1;
            }
        }

        // Step 3: Split Segments
        const finalSegments: { type: string, text: string, isGap: boolean }[] = [];

        basicSegments.forEach(seg => {
            if (gapStart === -1) {
                // No gap detected, fallback to old logic: <v> is gap
                finalSegments.push({
                    type: seg.type,
                    text: seg.text,
                    isGap: seg.type === "v"
                });
                return;
            }

            // Check overlap
            // Intersection of [seg.start, seg.end] and [gapStart, gapEnd]
            const overlapStart = Math.max(seg.start, gapStart);
            const overlapEnd = Math.min(seg.end, gapEnd);

            if (overlapStart < overlapEnd) {
                // Overlap exists! perform split

                // 1. Text before gap (inside this segment)
                if (overlapStart > seg.start) {
                    finalSegments.push({
                        type: seg.type,
                        text: plainText.slice(seg.start, overlapStart),
                        isGap: false
                    });
                }

                // 2. The Gap itself
                finalSegments.push({
                    type: seg.type,
                    text: plainText.slice(overlapStart, overlapEnd),
                    isGap: true
                });

                // 3. Text after gap
                if (overlapEnd < seg.end) {
                    finalSegments.push({
                        type: seg.type,
                        text: plainText.slice(overlapEnd, seg.end),
                        isGap: false
                    });
                }
            } else {
                // No overlap, keep as is
                finalSegments.push({
                    type: seg.type,
                    text: seg.text,
                    isGap: false
                });
            }
        });

        return finalSegments;

    }, [content, questionMarkdown]);

    // TTS Text: Strip tags and replace Gap with Answer (if revealed) or "blank"
    // Actually, asking TTS to read "blank" might be weird. 
    // Let's read the full sentence with the CORRECT answer for learning reinforcement, 
    // or just the raw sentence structure.
    // For learning, hearing the correct sentence is best.
    const cleanText = useMemo(() => {
        // Simple strip tags first
        let text = content.replace(/<\/?(?:s|v|o|chunk)>/g, "");
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
                    {processedSegments.map((seg, i) => {
                        // 挖空位置渲染 - 根据 isGap 动态判断，而不是固定 <v>
                        if (seg.isGap) {
                            // 根据原始 type 决定答案揭示时的高亮颜色
                            const colorClass = seg.type === "s"
                                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50"
                                : seg.type === "v"
                                    ? "text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/50"
                                    : seg.type === "o"
                                        ? "text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/50"
                                        : "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/50";

                            return (
                                <span key={i} className="inline-grid grid-cols-1 grid-rows-1 relative mx-2 align-baseline min-w-[80px]">
                                    {/* Layer 1: Gap Line & Question Mark */}
                                    <span
                                        className={cn(
                                            "col-start-1 row-start-1 w-full flex flex-col items-center pointer-events-none transition-opacity duration-500",
                                            status === "idle" ? "opacity-100" : "opacity-0"
                                        )}
                                        aria-hidden="true"
                                    >
                                        <span className="block w-full h-[2px] bg-zinc-400 dark:bg-zinc-600 mt-[1.2rem]" />
                                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-zinc-400 dark:text-zinc-500 font-mono text-xs">?</span>
                                    </span>

                                    {/* Layer 2: Answer Content */}
                                    <span
                                        className={cn(
                                            "col-start-1 row-start-1 flex items-center justify-center font-bold px-2 py-0.5 rounded text-[0.9em] transition-all duration-500 ease-in-out whitespace-nowrap z-10",
                                            status === "idle"
                                                ? "absolute inset-0 opacity-0 scale-90 pointer-events-none"
                                                : "relative opacity-100 scale-100",
                                            status === "correct" ? colorClass : status === "wrong" ? "text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-950/50 line-through" : ""
                                        )}
                                    >
                                        {status !== "idle" && (status === "correct" ? answer : selected)}
                                    </span>
                                </span>
                            );
                        }

                        // 非挖空的 S/V/O 标签 - 显示语法高亮
                        if (seg.type === "s") {
                            return (
                                <span key={i} className="relative inline box-decoration-clone bg-emerald-500/10 px-1 py-0.5 rounded border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-100 font-medium mx-1">
                                    {seg.text}
                                    <span className="align-super text-[9px] font-mono text-emerald-600 dark:text-emerald-500 font-bold ml-1 opacity-80">S</span>
                                </span>
                            );
                        }
                        if (seg.type === "v") {
                            return (
                                <span key={i} className="relative inline box-decoration-clone bg-rose-500/10 px-1 py-0.5 rounded border-b-2 border-rose-500 text-rose-700 dark:text-rose-100 font-medium mx-1">
                                    {seg.text}
                                    <span className="align-super text-[9px] font-mono text-rose-600 dark:text-rose-500 font-bold ml-1 opacity-80">V</span>
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
                        // Chunk 类型渲染 (L1 意群断句)
                        if (seg.type === "chunk") {
                            return (
                                <span key={i} className="inline box-decoration-clone bg-cyan-500/10 px-1.5 py-0.5 rounded border-b-2 border-cyan-500/50 text-cyan-700 dark:text-cyan-100 mx-0.5">
                                    {seg.text}
                                </span>
                            );
                        }

                        // 普通文本
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
