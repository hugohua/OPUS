import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils"; // Assuming utils exists, or I will use a local helper

// --- Types ---

interface ParsedHeader {
    title: string;
    phonetic: string;
    pos: string;
}

interface ParsedSection {
    rawTitle: string; // Full title line: "### 🎯 语境义 (Meaning)"
    type: SectionType;
    icon: string;     // Emoji: 🎯
    label: string;    // Text: Context / Meaning
    content: string;
}

type SectionType =
    | "definition"
    | "etymology"
    | "meaning"
    | "nuance"
    | "collocation"
    | "skeleton"
    | "chunking"
    | "insight"
    | "default";

interface MagicWandContentProps {
    completion: string;
    isLoading: boolean;
    type: "word" | "sentence";
    target: string;
}

// --- Helpers ---

function identifySectionType(titleLine: string): { type: SectionType, icon: string, label: string } {
    // Default fallback
    let type: SectionType = "default";
    let icon = "📝";
    let label = titleLine.replace(/^###\s*/, "").trim();

    const lower = titleLine.toLowerCase();

    if (lower.includes("释义")) {
        type = "definition";
        icon = "📖";
        label = "释义";
    } else if (lower.includes("词源") || lower.includes("etymology")) {
        type = "etymology";
        icon = "🧬";
        label = "词源记忆";
    } else if (lower.includes("meaning") || lower.includes("语境义")) {
        type = "meaning";
        icon = "🎯";
        label = "Meaning in Context";
    } else if (lower.includes("nuance") || lower.includes("辨析")) {
        type = "nuance";
        icon = "💡";
        label = "Nuance";
    } else if (lower.includes("collocation") || lower.includes("搭配")) {
        type = "collocation";
        icon = "🔗";
        label = "Collocation";
    } else if (lower.includes("skeleton") || lower.includes("骨架")) {
        type = "skeleton";
        icon = "🦴";
        label = "The Skeleton";
    } else if (lower.includes("chunking") || lower.includes("拆解")) {
        type = "chunking";
        icon = "✂️";
        label = "Chunking";
    } else if (lower.includes("insight") || lower.includes("点拨")) {
        type = "insight";
        icon = "🚀";
        label = "Takeaway";
    }

    return { type, icon, label };
}

// --- Renderers ---

const SectionHeader = ({ icon, label, colorClass }: { icon: string, label: string, colorClass: string }) => (
    <div className="flex items-center gap-2 mb-3">
        <span className={cn("flex items-center justify-center w-5 h-5 rounded text-xs", colorClass)}>
            {icon}
        </span>
        <span className="text-xs font-mono font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
            {label}
        </span>
    </div>
);

// 0. Definition (释义：中文含义 + 语境义)
const DefinitionRenderer = ({ content }: { content: string }) => {
    // Split into lines for structured display
    const lines = content.split('\n').filter(l => l.trim());

    return (
        <div>
            <SectionHeader icon="📖" label="释义" colorClass="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" />
            <div className="space-y-2">
                {lines.map((line, idx) => {
                    const clean = line.replace(/^-\s*/, '').trim();
                    const htmlLine = clean.replace(/\*\*(.*?)\*\*/g, '<span class="font-bold text-slate-900 dark:text-zinc-100">$1</span>');
                    return (
                        <p
                            key={idx}
                            className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed pl-3 border-l-2 border-blue-200 dark:border-blue-500/30"
                            dangerouslySetInnerHTML={{ __html: htmlLine }}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// 0b. Etymology (词源记忆：词根拆解 / 记忆线索)
const EtymologyRenderer = ({ content }: { content: string }) => {
    return (
        <div>
            <SectionHeader icon="🧬" label="词源记忆" colorClass="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400" />
            <div className="bg-violet-50/50 dark:bg-violet-500/10 rounded-lg p-4 border border-violet-100/50 dark:border-violet-500/20">
                <p className="font-mono text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {content}
                </p>
            </div>
        </div>
    );
};

// 1. Meaning (Standard Text with Highlight)
const MeaningRenderer = ({ content }: { content: string }) => {
    // Clean markdown bold to styled span
    const __html = content
        .replace(/\*\*(.*?)\*\*/g, '<span class="bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-1 rounded font-bold border-b border-indigo-100 dark:border-indigo-500/30">$1</span>');

    return (
        <div>
            <SectionHeader icon="🎯" label="语境释义" colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" />
            <p
                className="text-base text-slate-700 dark:text-zinc-300 leading-relaxed font-serif"
                dangerouslySetInnerHTML={{ __html }}
            />
        </div>
    );
};

// 2. Nuance (Amber Card)
const NuanceRenderer = ({ content }: { content: string }) => {
    // Clean markdown bold
    const __html = content.replace(/\*\*(.*?)\*\*/g, '<span class="font-bold text-amber-700 dark:text-amber-400">$1</span>');

    return (
        <div>
            <SectionHeader icon="💡" label="深度辨析" colorClass="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" />
            <div className="bg-amber-50/50 dark:bg-amber-500/10 rounded-lg p-3 border border-amber-100/50 dark:border-amber-500/20">
                <p
                    className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html }}
                />
            </div>
        </div>
    );
};

// 3. Collocation (List)
const CollocationRenderer = ({ content }: { content: string }) => {
    // Split lines starting with - 
    const lines = content.split('\n').filter(l => l.trim().startsWith('-'));

    return (
        <div>
            <SectionHeader icon="🔗" label="黄金搭配" colorClass="bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400" />
            <ul className="space-y-2">
                {lines.map((line, idx) => {
                    const cleanLine = line.replace(/^-\s*/, '');
                    // Format: "address the issue (解决问题)" -> bold the English part
                    const parts = cleanLine.split('(');
                    const english = parts[0];
                    const chinese = parts.length > 1 ? '(' + parts.slice(1).join('(') : '';

                    return (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-zinc-300 group cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 p-1 rounded transition-colors">
                            <div className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 group-hover:bg-indigo-500 transition-colors" />
                            <span>
                                <strong className="text-slate-900 dark:text-zinc-100">{english}</strong>
                                <span className="text-slate-400 text-xs ml-1">{chinese}</span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

// 4. Skeleton (Tags)
const SkeletonRenderer = ({ content }: { content: string }) => {
    // Extract Subject/Verb/Object tags: **[Subject]** word
    // This is tricky as LLM output varies. 
    // Fallback: render formatted markdown roughly.
    // Enhanced: Try to parse `**[Tag]** Word` pattern

    // Simple render for now: Bold the tags with colors
    const __html = content
        .replace(/\*\*\[Subject\]\*\*/gi, '<span class="text-[10px] bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-1 py-0.5 rounded uppercase font-bold tracking-wider border border-indigo-100 dark:border-indigo-500/30 mr-1">主语</span>')
        .replace(/\*\*\[Verb\]\*\*/gi, '<span class="text-[10px] bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 px-1 py-0.5 rounded uppercase font-bold tracking-wider border border-emerald-100 dark:border-emerald-500/30 mr-1">谓语</span>')
        .replace(/\*\*\[Object\]\*\*/gi, '<span class="text-[10px] bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 px-1 py-0.5 rounded uppercase font-bold tracking-wider border border-rose-100 dark:border-rose-500/30 mr-1">宾语</span>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Support standard bold
        .replace(/\(([^)]+)\)/g, '<br/><span class="text-xs text-slate-400 dark:text-zinc-500 font-mono mt-2 block pl-2 border-l-2 border-slate-200 dark:border-zinc-700">$1</span>'); // Translation in brackets to new line

    return (
        <div className="bg-slate-50 dark:bg-zinc-900 rounded-xl p-4 border border-slate-100 dark:border-zinc-800">
            <SectionHeader icon="🦴" label="句子骨架" colorClass="text-slate-600 dark:text-zinc-400" />
            <div
                className="font-serif text-lg leading-relaxed text-slate-800 dark:text-zinc-200"
                dangerouslySetInnerHTML={{ __html }}
            />
        </div>
    );
};

// 5. Chunking (Timeline)
const ChunkingRenderer = ({ content }: { content: string }) => {
    // Expecting: - **[Segment]**: Explanation
    const lines = content.split('\n').filter(l => l.trim().startsWith('-'));
    const colors = ["bg-slate-200", "bg-indigo-200", "bg-emerald-200", "bg-amber-200"];
    const textColors = ["text-slate-500", "text-indigo-600", "text-emerald-600", "text-amber-600"];
    const bgColors = ["bg-slate-100", "bg-indigo-50", "bg-emerald-50", "bg-amber-50"];

    return (
        <div>
            <SectionHeader icon="✂️" label="结构拆解" colorClass="text-slate-400" />
            <div className="space-y-6 relative pl-4 border-l-2 border-slate-100 dark:border-zinc-800 ml-2">
                {lines.map((line, idx) => {
                    const cleanLine = line.replace(/^-\s*/, '');
                    const parts = cleanLine.split(':');
                    // Parse: **[Label]**: Content
                    // remove **, [], and quotes
                    const segment = parts[0]
                        .replace(/\*\*/g, '')
                        .replace(/[\[\]]/g, '')
                        .replace(/['"]/g, '');

                    const explanation = parts.slice(1).join(':').trim().replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes from content


                    const colorIdx = idx % colors.length;

                    return (
                        <div key={idx} className="relative">
                            <div className={cn("absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-900", colors[colorIdx])} />
                            <p className="text-sm text-slate-700 dark:text-zinc-300">
                                <strong className={cn("font-mono text-xs px-1 py-0.5 rounded mr-2 border border-transparent", textColors[colorIdx], bgColors[colorIdx], "dark:bg-opacity-10 dark:border-opacity-10")}>
                                    {segment}
                                </strong>
                                {explanation}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// 6. Insight (Indigo Card)
const InsightRenderer = ({ content }: { content: string }) => {
    return (
        <div className="bg-indigo-50/50 dark:bg-indigo-500/10 rounded-lg p-4 border border-indigo-100/50 dark:border-indigo-500/20">
            <div className="flex gap-3">
                <div className="shrink-0 mt-0.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold">🚀</span>
                </div>
                <div>
                    <h4 className="text-xs font-mono font-bold text-indigo-400 dark:text-indigo-300 uppercase mb-1">点拨</h4>
                    <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed font-serif">
                        {content}
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

export function MagicWandContent({ completion, isLoading, type, target }: MagicWandContentProps) {

    // 📝 Parser
    const parsed = useMemo(() => {
        const result = {
            header: { title: target, phonetic: "", pos: "" },
            sections: [] as ParsedSection[]
        };

        if (!completion) return result;

        const text = completion.replace(/\r\n/g, "\n");

        // 1. Header
        const headerMatch = text.match(/^#\s+(.+)/m);
        if (headerMatch) result.header.title = headerMatch[1].trim();

        const phoneMatch = text.match(/\*\*\[Phonetic\]\*\*\s*([^\n]+)/i);
        const posMatch = text.match(/\*\*\[POS\]\*\*\s*([^\n]+)/i);
        if (phoneMatch) result.header.phonetic = phoneMatch[1].trim();
        if (posMatch) result.header.pos = posMatch[1].trim();

        // 2. Sections
        const sectionBlocks = text.split(/^###\s+/m).slice(1);
        for (const block of sectionBlocks) {
            const newlineIdx = block.indexOf("\n");
            const titleLine = (newlineIdx >= 0 ? block.substring(0, newlineIdx) : block).trim();
            const content = newlineIdx >= 0 ? block.substring(newlineIdx + 1).trim() : "";

            const { type, icon, label } = identifySectionType(titleLine);
            result.sections.push({ rawTitle: titleLine, type, icon, label, content });
        }

        return result;
    }, [completion, target]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* 1. Header Section */}
            <div className="space-y-3">
                {type === "word" ? (
                    <div className="flex items-baseline gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
                        <h1 className="font-serif text-4xl font-bold text-slate-900 dark:text-zinc-50 break-words leading-tight">
                            {parsed.header.title || target}
                        </h1>
                        {parsed.header.phonetic && (
                            <span className="font-mono text-slate-400 text-sm shrink-0">
                                {parsed.header.phonetic}
                            </span>
                        )}
                        {parsed.header.pos && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] font-mono font-bold text-slate-500 uppercase shrink-0 align-middle">
                                {parsed.header.pos}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="pb-4 border-b border-slate-100 dark:border-zinc-800">
                        <p className="text-base leading-relaxed text-slate-600 dark:text-zinc-400 italic border-l-2 border-indigo-300 dark:border-indigo-600 pl-3">
                            &ldquo;{parsed.header.title || target}&rdquo;
                        </p>
                    </div>
                )}
            </div>

            {/* 2. Dynamic Sections */}
            <div className="space-y-8">
                {parsed.sections.map((section, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1, duration: 0.4 }}
                    >
                        {section.type === "definition" && <DefinitionRenderer content={section.content} />}
                        {section.type === "etymology" && <EtymologyRenderer content={section.content} />}
                        {section.type === "meaning" && <MeaningRenderer content={section.content} />}
                        {section.type === "nuance" && <NuanceRenderer content={section.content} />}
                        {section.type === "collocation" && <CollocationRenderer content={section.content} />}
                        {section.type === "skeleton" && <SkeletonRenderer content={section.content} />}
                        {section.type === "chunking" && <ChunkingRenderer content={section.content} />}
                        {section.type === "insight" && <InsightRenderer content={section.content} />}

                        {/* Fallback for unknown sections */}
                        {section.type === "default" && (
                            <div>
                                <SectionHeader icon={section.icon} label={section.label} colorClass="bg-slate-100 text-slate-500" />
                                <div className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                                    {section.content}
                                </div>
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Loading Indicator for streaming */}
            {isLoading && (
                <div className="flex items-center gap-1 opacity-50 pl-1">
                    <div className="w-1.5 h-4 bg-indigo-500 animate-pulse delay-0" />
                    <div className="w-1.5 h-4 bg-indigo-500 animate-pulse delay-75" />
                    <div className="w-1.5 h-4 bg-indigo-500 animate-pulse delay-150" />
                </div>
            )}
        </div>
    );
}
