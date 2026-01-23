'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudioLines } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { WordAsset } from "@/types/word";
import { PhraseHighlighter } from "@/components/drill/phrase-highlighter";

const cardIntentVariants = cva(
    "relative overflow-hidden rounded-xl border transition-all duration-300 w-full h-full flex flex-col justify-between selection:bg-primary/20",
    {
        variants: {
            intent: {
                default: "bg-card text-card-foreground border-border shadow-sm dark:backdrop-blur-md dark:bg-white/5 dark:border-white/10",
                glow: "border-primary/50 bg-primary/5 dark:shadow-[0_0_20px_rgba(99,102,241,0.15)]"
            }
        },
        defaultVariants: {
            intent: "default"
        }
    }
)

interface WordCardProps {
    data: WordAsset;
    isActive?: boolean;
}

export function WordCard({ data, isActive }: WordCardProps) {
    const familyWords = data.word_family ? Object.values(data.word_family) : [data.word];
    const highlights = [...familyWords, data.word];

    return (
        <Card className={cn(cardIntentVariants({ intent: isActive ? "glow" : "default" }))}>
            <CardContent className="flex-1 p-8 flex flex-col items-center text-center space-y-6 overflow-y-auto">
                {/* Header */}
                <div className="space-y-4 w-full">
                    <div className="flex justify-between items-start w-full opacity-50">
                        <span className="text-xs uppercase tracking-widest">Business Core</span>
                        <AudioLines className="w-5 h-5 cursor-pointer hover:text-primary transition-colors" />
                    </div>

                    <div className="space-y-2 py-4">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{data.word}</h1>
                        {data.phonetic && <p className="text-muted-foreground font-serif italic text-lg">{data.phonetic}</p>}
                    </div>

                    <Badge variant="secondary" className="px-4 py-1 text-base font-normal">
                        {data.meaning}
                    </Badge>
                </div>

                {/* Collocations List */}
                <div className="w-full text-left space-y-3 mt-4 flex-1">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground/50 tracking-wider mb-2">
                        Context Matches
                    </h3>
                    {data.collocations.map((col, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50 dark:bg-white/5 border border-transparent hover:border-border transition-colors">
                            <PhraseHighlighter
                                text={col.text}
                                highlights={highlights}
                                className="text-sm font-medium leading-relaxed block"
                            />
                            {col.translation && (
                                <span className="text-xs text-muted-foreground mt-1 block">
                                    {col.translation}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>

            {/* Footer decoration */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </Card>
    )
}
