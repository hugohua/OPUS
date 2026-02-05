"use client";

import React, { useState, useEffect } from "react";
import { useSSEStream } from "@/hooks/use-sse-stream";
import { cn } from "@/lib/utils";
import { MagicWandSheet } from "@/components/wand/MagicWandSheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Share2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ArticleReaderProps {
    scenario: string;
    targetWordIds: number[];
    targetWords: Array<{ id: number; word: string; meaning: string }>;
    onBack: () => void;
}

/**
 * Weaver Article Reader
 * 功能：
 * 1. 触发 SSE 生成文章
 * 2. 实时渲染 + 打字机效果
 * 3. 目标词高亮 (Rose Underline)
 * 4. 单词交互 -> 打开 Magic Wand
 */
export function ArticleReader({ scenario, targetWordIds, targetWords, onBack }: ArticleReaderProps) {
    const [wandWord, setWandWord] = useState<string | null>(null);
    const [isWandOpen, setIsWandOpen] = useState(false);

    // ✅ Use custom SSE Hook
    const { text: completion, isLoading, error, startStream } = useSSEStream({
        onComplete: (text) => {
            console.log(`[ArticleReader] Generation completed: ${text.length} chars`);
        },
        onError: (err) => {
            console.error(`[ArticleReader] Stream error:`, err);
        }
    });

    // Auto-start generation on mount
    useEffect(() => {
        startStream("/api/weaver/v2/generate", {
            scenario,
            target_word_ids: targetWordIds
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ✅ 错误状态 UI
    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md">
                    <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
                        ⚠️ 生成失败
                    </h3>
                    <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => startStream("/api/weaver/v2/generate", {
                                scenario,
                                target_word_ids: targetWordIds
                            })}
                            variant="destructive"
                        >
                            重试
                        </Button>
                        <Button onClick={onBack} variant="outline">
                            返回
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Word Interaction Handler
    const handleWordClick = (word: string) => {
        // Clean word (remove punctuation)
        const cleanWord = word.replace(/[^a-zA-Z]/g, "");
        setWandWord(cleanWord);
        setIsWandOpen(true);
    };

    // ✅ 优化: 添加 Loading 和 Empty States
    const renderContent = () => {
        if (isLoading && !completion) {
            return (
                <div className="text-center py-12">
                    <Progress value={33} className="w-64 mx-auto mb-4" />
                    <p className="text-muted-foreground">正在生成文章...</p>
                </div>
            );
        }
        if (!completion) {
            return (
                <div className="text-center py-12 text-muted-foreground">
                    暂无内容
                </div>
            );
        }

        const paragraphs = completion.split("\n\n");

        return paragraphs.map((para, pIdx) => (
            <p key={pIdx} className="mb-6 leading-relaxed text-lg md:text-xl text-primary font-serif">
                {renderParagraph(para)}
            </p>
        ));
    };

    const renderParagraph = (text: string) => {
        const words = text.split(" ");
        return words.map((word, wIdx) => {
            const isBold = word.startsWith("**") && word.endsWith("**");
            const cleanText = word.replace(/\*\*/g, "");
            const cleanWord = cleanText.replace(/[^a-zA-Z]/g, "").toLowerCase();

            const isTarget = targetWords.some(t => t.word.toLowerCase() === cleanWord);

            if (isBold || isTarget) {
                return (
                    <span
                        key={wIdx}
                        onClick={() => handleWordClick(cleanText)}
                        className={cn(
                            "cursor-pointer font-semibold text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-200 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors mx-1 px-0.5 rounded-sm select-none",
                            isBold && "animate-in fade-in duration-700"
                        )}
                    >
                        {cleanText}
                    </span>
                );
            }

            return (
                <span
                    key={wIdx}
                    onClick={() => handleWordClick(cleanText)}
                    className="cursor-pointer hover:bg-muted rounded px-0.5 transition-colors mx-0.5 select-none"
                >
                    {word}{" "}
                </span>
            );
        });
    };

    return (
        <div className="w-full max-w-3xl mx-auto min-h-screen flex flex-col bg-background">

            {/* Top Bar */}
            <nav className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4 flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-primary">
                    <ArrowLeft className="w-5 h-5" />
                </Button>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                        {scenario.toUpperCase()} BRIEF
                    </span>
                    {isLoading && (
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                    )}
                </div>

                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                    <BookOpen className="w-5 h-5" />
                </Button>
            </nav>

            {/* Reading Progress */}
            {isLoading && (
                <Progress value={30} className="h-0.5 w-full bg-transparent rounded-none" indicatorClassName="bg-brand-core animate-pulse" />
            )}

            {/* Main Content */}
            <main className="flex-1 px-6 py-10 md:px-12 md:py-16">

                {/* Generated Article */}
                <article className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    {completion ? renderContent() : (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground gap-4">
                            <Share2 className="w-8 h-8 animate-pulse text-border" />
                            <span className="text-sm font-mono tracking-widest uppercase">Weaving context...</span>
                        </div>
                    )}
                </article>

                {/* Footer */}
                {!isLoading && completion && (
                    <div className="mt-16 pt-8 border-t border-border text-center animate-in fade-in slide-in-from-bottom-8 delay-500">
                        <p className="text-secondary text-sm font-serif italic mb-6">
                            "Language is the dress of thought."
                        </p>
                        <Button onClick={onBack} variant="outline" className="rounded-full px-8 border-border">
                            Finish Session
                        </Button>
                    </div>
                )}
            </main>

            {/* Magic Wand Sheet */}
            <MagicWandSheet
                isOpen={isWandOpen}
                onOpenChange={setIsWandOpen}
                word={wandWord}
            />

        </div>
    );
}
