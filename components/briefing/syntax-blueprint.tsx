import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

export interface SyntaxBlueprintProps {
    content: string; // The full markdown string e.g. "<s>Subject</s> <v>Verb</v> <o>Object</o>"
    tenseHint?: string;
    isRevealed: boolean;
    className?: string;
}

export function SyntaxBlueprint({ content, tenseHint, isRevealed, className }: SyntaxBlueprintProps) {

    // Parse the S-V-O structure from the content string
    const parts = useMemo(() => {
        const sMatch = content.match(/<s>(.*?)<\/s>/i);
        const vMatch = content.match(/<v>(.*?)<\/v>/i);
        const oMatch = content.match(/<o>(.*?)<\/o>/i);

        return {
            subject: sMatch ? sMatch[1] : '???',
            verb: vMatch ? vMatch[1] : '???',
            object: oMatch ? oMatch[1] : '???'
        };
    }, [content]);

    return (
        <div className={cn("bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 mb-6 shrink-0 w-full", className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center">
                    <span className="w-2 h-2 bg-violet-500 rounded-full mr-2 shadow-[0_0_8px_rgba(139,92,246,0.6)]"></span>
                    Syntax Blueprint
                </h2>
                <code className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">S → V → O</code>
            </div>

            {/* Flow Chart */}
            <div className="flex items-start justify-between font-mono text-xs">

                {/* SUBJECT NODE */}
                <div className="flex flex-col w-[30%] group">
                    <span className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 mb-1 font-semibold uppercase tracking-wider pl-1">Subject</span>
                    <div className="bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 p-2 rounded-md shadow-sm break-words opacity-90 group-hover:opacity-100 group-hover:border-emerald-300 transition-all">
                        {parts.subject}
                    </div>
                </div>

                {/* Connector */}
                <div className="text-slate-300 dark:text-slate-700 pt-6 flex justify-center w-[5%]">
                    <ArrowRight className="w-4 h-4" />
                </div>

                {/* VERB NODE (Dynamic) */}
                <div className="flex flex-col w-[30%] relative">
                    <span className="text-[9px] text-violet-600/70 dark:text-violet-400/70 mb-1 font-semibold uppercase tracking-wider pl-1">Verb</span>

                    {isRevealed ? (
                        // STATE: REVEALED (Show Answer)
                        <div className="bg-violet-600 border border-violet-700 text-white p-2 rounded-md shadow-md font-bold text-center animate-in fade-in zoom-in-95 duration-300 ring-2 ring-violet-500/20">
                            {parts.verb}
                        </div>
                    ) : (
                        // STATE: HINT (Type Inference)
                        <div className="bg-violet-50 dark:bg-violet-950/20 border-2 border-dashed border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-300 p-2 rounded-md font-bold text-center flex flex-col items-center justify-center min-h-[34px] animate-pulse">
                            <span className="text-[10px] uppercase tracking-tight">{tenseHint || "VERB"}</span>
                        </div>
                    )}
                </div>

                {/* Connector */}
                <div className="text-slate-300 dark:text-slate-700 pt-6 flex justify-center w-[5%]">
                    <ArrowRight className="w-4 h-4" />
                </div>

                {/* OBJECT NODE */}
                <div className="flex flex-col w-[30%] group">
                    <span className="text-[9px] text-slate-500/70 dark:text-slate-400/70 mb-1 font-semibold uppercase tracking-wider pl-1">Object</span>
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 p-2 rounded-md shadow-sm break-words opacity-90 group-hover:opacity-100 group-hover:border-slate-300 transition-all">
                        {parts.object}
                    </div>
                </div>

            </div>
        </div>
    );
}
