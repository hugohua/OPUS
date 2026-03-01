"use client";

/**
 * Weaver Article Reader (v2.1)
 * 
 * 功能：
 *   1. B2: 全屏深色加载态 + Step Loader (无百分比)
 *   2. B3: Serif 衬线阅读 + 毛玻璃 nav + 哑光下划线
 *   3. B5: 浮出工具栏 (划词/划句)
 *   4. C3: 审计埋点 (article_finish)
 * 
 * 作者: Hugo
 * 日期: 2026-02-15
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useSSEStream } from "@/hooks/use-sse-stream";
import { useTextSelection } from "@/hooks/use-text-selection";
import { useTTS } from "@/hooks/use-tts";
import { FloatingToolbar } from "@/components/weaver/FloatingToolbar";
import { MagicWandSheet } from "@/components/wand/MagicWandSheet";
import { useWeaverToolbar } from "@/hooks/use-weaver-toolbar";
import { Header } from "@/components/ui/header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createAuditRecord } from "@/actions/audit-actions";
import { toast } from "sonner";
import { Copy, Check, Share2 } from "lucide-react";

interface ArticleReaderProps {
    scenario: string;
    density?: string;
    targetWordIds: number[];
    targetWords: Array<{ id: number; word: string; meaning: string }>;
    onBack: () => void;
}

// 加载步骤
type LoadingStep = "selecting" | "injecting" | "weaving";

/**
 * Weaver Article Reader
 */
export function ArticleReader({
    scenario,
    density = "balanced",
    targetWordIds,
    targetWords,
    onBack
}: ArticleReaderProps) {
    const searchParams = useSearchParams();
    const initialArticleId = searchParams.get("id");


    const [loadingStep, setLoadingStep] = useState<LoadingStep>("selecting");
    const [sessionStartTime] = useState(Date.now());
    const [articleId, setArticleId] = useState<string | null>(initialArticleId);

    // Scroll container ref for FloatingToolbar positioning
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Local state to track if we are loading from ID (skip generation animation)
    const [isLoadingFromId, setIsLoadingFromId] = useState(!!initialArticleId);

    // ✅ Metadata State (Hydrated from props or API)
    const [currentScenario, setCurrentScenario] = useState(scenario);
    const [currentTargetWords, setCurrentTargetWords] = useState(targetWords);

    const articleRef = useRef<HTMLDivElement>(null);

    // Track which translation paragraphs have been revealed (by index)
    const [revealedTranslations, setRevealedTranslations] = useState<Set<number>>(new Set());

    // ✅ Memoize target word set for O(1) lookup (prevents flicker from slow comparison)
    const targetWordSet = useMemo(
        () => new Set(currentTargetWords.map(t => t.word.toLowerCase())),
        [currentTargetWords]
    );

    // ✅ B5: 文本选择 Hook
    const { selection, selectWord, clearSelection, setSelection } = useTextSelection(articleRef, scrollContainerRef);

    // ✅ TTS: 使用项目通用 TTS 服务
    const tts = useTTS();

    // ✅ SSE Hook
    const { text: completion, isLoading, error, startStream, setText } = useSSEStream({
        onComplete: () => {
            // C3: 审计 article_finish 事件 (Server Action)
            const duration = Date.now() - sessionStartTime;
            createAuditRecord({
                targetWord: currentScenario,
                contextMode: "WEAVER:FINISH",
                status: "GOOD",
                payload: {
                    context: { scenario: currentScenario, density, duration, wordCount: currentTargetWords.length, articleId },
                    event: "article_finish"
                }
            }).catch(console.error);
        },
        onError: () => { },
        onResponse: (res) => {
            const newId = res.headers.get("X-Weaver-Id");
            if (newId) {
                setArticleId(newId);
                // 无感更新 URL
                const url = new URL(window.location.href);
                url.searchParams.set("id", newId);
                window.history.replaceState(null, "", url.toString());
            }
        }
    });

    // 模拟加载步骤
    useEffect(() => {
        if (!isLoading) return;
        const t1 = setTimeout(() => setLoadingStep("injecting"), 800);
        const t2 = setTimeout(() => setLoadingStep("weaving"), 1600);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [isLoading]);

    // 启动生成 或 加载缓存
    useEffect(() => {
        if (initialArticleId) {
            // Load from Cache/DB
            setIsLoadingFromId(true);
            fetch(`/api/weaver/v2/article/${initialArticleId}`)
                .then(res => {
                    if (!res.ok) throw new Error("Article not found");
                    return res.json();
                })
                .then(data => {
                    setText(data.content);
                    // Hydrate Metadata
                    if (data.scenario) setCurrentScenario(data.scenario);
                    if (data.targetWords) setCurrentTargetWords(data.targetWords);
                })
                .catch(err => {
                    toast.error("Failed to load article", { description: err.message });
                })
                .finally(() => {
                    setIsLoadingFromId(false);
                });
        } else {
            // Start Generation
            startStream("/api/weaver/v2/generate", {
                scenario,
                density,
                target_word_ids: targetWordIds
            });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ✅ V2.0: 使用 ===TITLE=== / ===BODY=== (及 ===TRANSLATION===) 分隔符解析标题和正文
    // ❗ 必须在 early return 之前调用，确保 Hooks 调用顺序稳定
    const parsedContent = useMemo(() => {
        if (!completion) return null;
        const cleaned = completion.replace(/\*\*/g, "");

        const titleMatch = cleaned.match(/===TITLE===\s*([\s\S]*?)\s*===BODY===/);
        const titleText = titleMatch ? titleMatch[1].trim() : "";

        const bodyMatch = cleaned.match(/===BODY===\s*([\s\S]*?)(?:===TRANSLATION===|$)/);
        const bodyText = bodyMatch ? bodyMatch[1].trim() : "";
        const bodyParts = bodyText ? bodyText.split("\n\n").filter(Boolean) : [];

        const translationMatch = cleaned.match(/===TRANSLATION===\s*([\s\S]*?)$/);
        const translationText = translationMatch ? translationMatch[1].trim() : "";
        const translationParts = translationText ? translationText.split("\n\n").filter(Boolean) : [];

        // Fallback for streaming incomplete states or legacy format
        if (!titleMatch && !bodyText && cleaned.length > 0) {
            // Maybe it's just raw text?
            return { titleText: "", bodyParts: cleaned.split("\n\n").filter(Boolean), translationParts: [] };
        }

        if (!titleText && bodyParts.length === 0 && translationParts.length === 0) return null;

        return {
            titleText: titleText || "",
            bodyParts,
            translationParts
        };
    }, [completion]);

    // ✅ B5: 浮出工具栏逻辑 (Refactored to Hook)
    const {
        wandTarget,
        wandType,
        wandContext,
        setWandContext,
        isWandOpen,
        setIsWandOpen,
        handleAnalyze,
        handlePlay,
        handleCopy,
        handleExpandToSentence
    } = useWeaverToolbar({
        scenario: currentScenario,
        parsedContent, // Note: parsedContent might be null initially
        tts,
        selection,
        clearSelection,
        setSelection
    });

    // 单词点击处理
    const handleWordClick = (word: string, context: string, e: React.MouseEvent<HTMLSpanElement>) => {
        const cleanWord = word.replace(/[^a-zA-Z]/g, "");
        if (cleanWord) {
            setWandContext(context); // Capture context
            selectWord(cleanWord, e.currentTarget);
        }
    };

    // ✅ V2.0: 使用 ===TITLE=== / ===BODY=== 分隔符解析标题和正文
    // ❗ 必须在 early return 之前调用，确保 Hooks 调用顺序稳定


    const handleCopyLink = () => {
        if (typeof window !== "undefined") {
            navigator.clipboard.writeText(window.location.href);
            toast.success("链接已复制", { description: "已复制到剪贴板，有效期 1 小时（缓存）或永久（已保存）" });
        }
    };

    // ============================================
    // 错误状态
    // ============================================
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
                                scenario, density, target_word_ids: targetWordIds
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

    // ============================================
    // B2: 全屏加载态 (The Weaving) - Deep Space Mode
    // Only show if loading via stream (not ID fetch) OR if ID fetch is in progress
    // ============================================
    if (isLoadingFromId) {
        return (
            <div className="w-full max-w-3xl mx-auto min-h-screen flex flex-col bg-white dark:bg-zinc-950 overflow-y-scroll">
                <Header variant="reader" title="加载中..." onBack={onBack} />
                <main className="flex-1 px-8 py-12 md:px-12 md:py-16 relative animate-pulse">
                    <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-md w-3/4 mb-8" />
                    <div className="space-y-4">
                        <div className="h-4 bg-zinc-100 dark:bg-zinc-900 rounded w-full" />
                        <div className="h-4 bg-zinc-100 dark:bg-zinc-900 rounded w-full" />
                        <div className="h-4 bg-zinc-100 dark:bg-zinc-900 rounded w-5/6" />
                        <div className="h-4 bg-zinc-100 dark:bg-zinc-900 rounded w-full" />
                    </div>
                </main>
            </div>
        );
    }

    if (isLoading && !completion) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
                {/* 模糊光晕 (Ambient Glow) */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px] animate-pulse" />
                </div>

                {/* 旋转 Visualizer */}
                <div className="relative w-24 h-24 mb-12">
                    <div className="absolute inset-0 rounded-full border border-zinc-700 animate-spin" style={{ animationDuration: '8s' }} />
                    <div className="absolute inset-2 rounded-full border border-zinc-600 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} />
                    <div className="absolute inset-4 rounded-full border border-indigo-500/30 animate-spin" style={{ animationDuration: '4s' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    </div>
                </div>

                {/* Step Loader (Audit W-4: 无百分比) */}
                <div className="space-y-3 text-sm font-mono relative z-10">
                    <StepIndicator
                        done={loadingStep !== "selecting"}
                        active={loadingStep === "selecting"}
                        label={`正在选取 ${targetWords.length} 个词汇`}
                    />
                    <StepIndicator
                        done={loadingStep === "weaving"}
                        active={loadingStep === "injecting"}
                        label={`注入「${scenario}」情境`}
                    />
                    <StepIndicator
                        done={false}
                        active={loadingStep === "weaving"}
                        label="生成简报中..."
                    />
                </div>

                {/* 底部 Skeleton 文本预览 */}
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-80 space-y-2 opacity-20 z-0">
                    <div className="h-3 bg-zinc-700 rounded w-full" />
                    <div className="h-3 bg-zinc-700 rounded w-4/5" />
                    <div className="h-3 bg-zinc-700 rounded w-3/5" />
                </div>
            </div>
        );
    }

    // ============================================
    // B3: 沉浸阅读态 (The Reader)
    // ============================================


    // 段落渲染
    const renderContent = () => {
        if (!parsedContent) return null;
        const { titleText, bodyParts, translationParts } = parsedContent;

        return (
            <>
                {titleText && (
                    <h1 className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-8 leading-tight">
                        {titleText}
                    </h1>
                )}
                {bodyParts.map((para, pIdx) => {
                    const translation = translationParts?.[pIdx];
                    const isRevealed = revealedTranslations.has(pIdx);

                    return (
                        <div key={`p-${pIdx}`} className="mb-10 last:mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <p className="leading-loose text-lg text-zinc-700 dark:text-zinc-300 font-serif break-words">
                                {isLoading ? para : renderInteractiveParagraph(para, pIdx)}
                                {/* cursor when generating body */}
                                {isLoading && pIdx === bodyParts.length - 1 && (!translationParts || translationParts.length === 0) && (
                                    <span className="inline-block w-0.5 h-5 bg-indigo-500 dark:bg-indigo-400 animate-pulse ml-1 align-text-bottom" />
                                )}
                            </p>

                            {/* Interleaved Translation */}
                            {translation && (
                                <div
                                    className={cn(
                                        "relative mt-4 pl-4 border-l-2 animate-in fade-in duration-500 cursor-pointer transition-all group",
                                        isRevealed ? "border-indigo-300 dark:border-indigo-700/80" : "border-zinc-200 dark:border-zinc-800"
                                    )}
                                    onClick={() => {
                                        if (isRevealed) return;
                                        setRevealedTranslations(prev => {
                                            const next = new Set(prev);
                                            next.add(pIdx);
                                            return next;
                                        });
                                    }}
                                >
                                    <p className={cn(
                                        "leading-[1.6] text-base transition-all duration-300 selection:bg-transparent",
                                        isRevealed
                                            ? "text-zinc-600 dark:text-zinc-400 blur-none"
                                            : "text-zinc-400 dark:text-zinc-500 blur-sm hover:blur-[2px] opacity-70"
                                    )}>
                                        {translation}
                                        {/* cursor when generating translation */}
                                        {isLoading && pIdx === translationParts.length - 1 && (
                                            <span className="inline-block w-0.5 h-5 bg-indigo-500 dark:bg-indigo-400 animate-pulse ml-1 align-text-bottom blur-none opacity-100" />
                                        )}
                                    </p>
                                    {!isRevealed && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-950/80 px-3 py-1.5 rounded-full backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-sm transition-opacity group-hover:opacity-100 md:opacity-80">
                                                点击查看翻译
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        );
    };

    // ✅ 仅在生成完成后使用：逐词可交互渲染 (支持 Word + Sentence 高亮)
    const renderInteractiveParagraph = (text: string, pIdx: number) => {
        const words = text.split(" ");

        // 预计算句子高亮的词索引范围 (避免在 map 内重复计算)
        let sentenceRange: [number, number] | null = null;
        if (selection?.type === "sentence" && text.includes(selection.text)) {
            const sentenceWords = selection.text.split(" ");
            for (let i = 0; i <= words.length - sentenceWords.length; i++) {
                let match = true;
                for (let j = 0; j < sentenceWords.length; j++) {
                    if (words[i + j] !== sentenceWords[j]) { match = false; break; }
                }
                if (match) { sentenceRange = [i, i + sentenceWords.length - 1]; break; }
            }
        }

        return words.map((word, wIdx) => {
            const alphaOnly = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
            const isTarget = alphaOnly.length > 0 && targetWordSet.has(alphaOnly);
            const uniqueId = `${pIdx}-${wIdx}`;

            // 高亮判断
            let isFocused = false;

            if (selection?.type === "sentence") {
                // 句子模式：仅高亮落在句子词索引范围内的单词
                isFocused = sentenceRange !== null && wIdx >= sentenceRange[0] && wIdx <= sentenceRange[1];
            } else if (selection?.type === "word") {
                // 单词模式：通过 data-index 精确匹配被点击的 span
                isFocused = selection.domNode?.getAttribute("data-index") === uniqueId;
            }

            if (isTarget) {
                return (
                    <span
                        key={wIdx}
                        data-index={uniqueId}
                        onClick={(e) => handleWordClick(word, text, e)}
                        className={cn(
                            "cursor-pointer underline decoration-indigo-300 dark:decoration-indigo-500 decoration-2 underline-offset-4 transition-colors px-0.5 rounded-sm",
                            isFocused ? "bg-indigo-200 dark:bg-indigo-500/30" : "hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                        )}
                    >
                        {word}{" "}
                    </span>
                );
            }

            return (
                <span
                    key={wIdx}
                    data-index={uniqueId}
                    onClick={(e) => handleWordClick(word, text, e)}
                    className={cn(
                        "cursor-text rounded px-0.5 transition-colors",
                        isFocused ? "bg-amber-100 dark:bg-amber-900/30" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    )}
                >
                    {word}{" "}
                </span>
            );
        });
    };

    return (
        <div ref={scrollContainerRef} className="w-full max-w-3xl mx-auto min-h-screen flex flex-col bg-white dark:bg-zinc-950 overflow-y-scroll [scrollbar-gutter:stable] [overflow-anchor:auto] pb-24">

            {/* 统一 Header 组件 (reader variant) */}
            <Header
                variant="reader"
                title={`${scenario.toUpperCase()} 简报`}
                subtitle={isLoading ? "生成中..." : "阅读就绪"}
                onBack={onBack}
            />

            {/* 文章主体 */}
            <main ref={articleRef} className="flex-1 px-8 py-12 md:px-12 md:py-16 relative select-text">
                <article>
                    {renderContent()}
                </article>

                {/* Footer */}
                {(!isLoading && !isLoadingFromId) && completion && (
                    <div className="mt-16 pt-8 border-t border-zinc-100 dark:border-zinc-800 text-center animate-in fade-in slide-in-from-bottom-8 delay-500 flex flex-col items-center gap-4">
                        <p className="text-zinc-400 text-sm font-serif italic">
                            "语言是思想的衣裳。"
                        </p>

                        <div className="flex gap-3">
                            <Button onClick={onBack} variant="outline" className="rounded-full px-6 border-zinc-200 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                                完成阅读
                            </Button>

                            <Button onClick={handleCopyLink} variant="ghost" size="icon" className="rounded-full text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                                <Share2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </main>

            {/* B5: 浮出工具栏 */}
            <AnimatePresence>
                {selection && (
                    <FloatingToolbar
                        selection={selection}
                        onAnalyze={handleAnalyze}
                        onPlay={handlePlay}
                        onCopy={handleCopy}
                        onExpandToSentence={handleExpandToSentence}
                        scrollContainerRef={scrollContainerRef}
                    />
                )}
            </AnimatePresence>

            {/* Magic Wand Sheet */}
            <MagicWandSheet
                isOpen={isWandOpen}
                onOpenChange={setIsWandOpen}
                target={wandTarget}
                type={wandType}
                context={wandContext}
            />

            {/* 底部提示 */}
            <div className="fixed bottom-4 w-full text-center pointer-events-none">
                <p className="text-[10px] font-mono text-zinc-400 tracking-widest opacity-30">
                    选中文字触发操作
                </p>
            </div>
        </div>
    );
}

// ============================================
// Step 指示器子组件
// ============================================

function StepIndicator({ done, active, label }: { done: boolean; active: boolean; label: string }) {
    return (
        <div className={cn(
            "flex items-center gap-3 transition-colors",
            done ? "text-emerald-400" : active ? "text-zinc-200" : "text-zinc-600"
        )}>
            <span className="w-5 text-center">
                {done ? "✅" : active ? "⟳" : "○"}
            </span>
            <span>{label}</span>
        </div>
    );
}
