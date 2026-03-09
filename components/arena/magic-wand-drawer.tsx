"use client";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Sparkles, X, BookOpen, AlertCircle, Lightbulb, Loader2, Target, Bone, Wand2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { fetchMiniLesson, type MiniLessonData } from "@/actions/mini-lesson";

export interface MagicWandDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rationale?: string;
    sentence?: string;
    targetWord?: string;
    sentenceTranslation?: string;
    // Mini-Lesson 触发所需
    questionSeedId?: string;
    selectedOption?: string;
}

export function MagicWandDrawer({
    open, onOpenChange,
    rationale, sentence, targetWord, sentenceTranslation,
    questionSeedId, selectedOption,
}: MagicWandDrawerProps) {
    const [miniLesson, setMiniLesson] = useState<MiniLessonData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const isMounted = useRef(true);
    const cache = useRef<Map<string, MiniLessonData>>(new Map());

    // 两阶段渲染：Drawer 打开时异步拉取 Mini-Lesson
    useEffect(() => {
        isMounted.current = true;

        if (!open || !questionSeedId || !selectedOption) {
            // Drawer 关闭时重置
            if (!open) setMiniLesson(null);
            return;
        }

        // 检查缓存（🔴 Key = questionSeedId，非 grammarNodeId）
        const cached = cache.current.get(questionSeedId);
        if (cached) {
            setMiniLesson(cached);
            return;
        }

        setIsLoading(true);
        fetchMiniLesson({ questionSeedId, selectedOption })
            .then(res => {
                if (!isMounted.current) return; // 🟡 防止已卸载时写状态
                if (res.mode === 'mini-lesson') {
                    cache.current.set(questionSeedId, res.miniLesson);
                    setMiniLesson(res.miniLesson);
                }
            })
            .catch(() => { }) // Fail-Safe: 保持 rationale
            .finally(() => {
                if (isMounted.current) setIsLoading(false);
            });

        return () => { isMounted.current = false; };
    }, [open, questionSeedId, selectedOption]);

    const showMiniLesson = miniLesson !== null;

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-background rounded-t-[20px] outline-none h-[96vh] border-border pb-safe">
                <VisuallyHidden.Root>
                    <DrawerTitle>{showMiniLesson ? 'Mini-Lesson' : 'AI 深度解析'}</DrawerTitle>
                </VisuallyHidden.Root>

                {/* Header */}
                <div className="flex-none pt-2 pb-4 border-b border-border flex flex-col items-center sticky top-0 bg-background rounded-t-[20px] z-20">
                    <div className="w-full px-6 flex justify-between items-center mt-2">
                        <h3 className="text-base font-bold text-primary flex items-center gap-2">
                            {showMiniLesson ? (
                                <>
                                    <Wand2 className="w-5 h-5 text-amber-500" />
                                    <span>Mini-Lesson: {miniLesson.grammarNodeName}</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5 text-violet-500" />
                                    AI 深度解析
                                    {isLoading && <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />}
                                </>
                            )}
                        </h3>
                        <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)} className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6">
                    {isLoading && !showMiniLesson ? (
                        /* ===== Loading Skeleton ===== */
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* §1 skeleton */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <Skeleton className="h-4 w-4 rounded" />
                                    <Skeleton className="h-4 w-28" />
                                </div>
                                <Skeleton className="h-24 w-full rounded-xl" />
                            </section>
                            {/* §2 skeleton */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <Skeleton className="h-4 w-4 rounded" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <Skeleton className="h-20 w-full rounded-xl" />
                            </section>
                            {/* §3 skeleton */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <Skeleton className="h-4 w-4 rounded" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-12 w-full rounded-xl" />
                                    <Skeleton className="h-12 w-full rounded-xl" />
                                </div>
                            </section>
                        </div>
                    ) : showMiniLesson ? (
                        /* ===== Mini-Lesson 三段式 ===== */
                        <>
                            {/* §1 错因剖析 */}
                            <section>
                                <h4 className="flex items-center gap-2 text-sm font-bold text-primary mb-3">
                                    <AlertCircle className="w-4 h-4 text-rose-500" />
                                    为什么选错了
                                </h4>
                                <p className="text-sm text-primary leading-relaxed bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 rounded-xl p-4">
                                    {miniLesson.errorAnalysis}
                                </p>
                            </section>

                            {/* §2 语法梳理 */}
                            <section>
                                <h4 className="flex items-center gap-2 text-sm font-bold text-primary mb-3">
                                    <BookOpen className="w-4 h-4 text-amber-500" />
                                    语法点梳理
                                </h4>
                                <p className="text-sm text-primary leading-relaxed bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
                                    {miniLesson.grammarOverview}
                                </p>
                            </section>

                            {/* §3 极简例句 */}
                            <section>
                                <h4 className="flex items-center gap-2 text-sm font-bold text-primary mb-3">
                                    <Lightbulb className="w-4 h-4 text-emerald-500" />
                                    极简例句
                                </h4>
                                <div className="space-y-2">
                                    {miniLesson.exampleSentences.map((s, i) => (
                                        <div key={i} className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-3">
                                            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{i + 1}.</span>
                                            <p className="text-sm font-medium text-primary">{s}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    ) : (
                        /* ===== 默认 Rationale 模式 ===== */
                        <>
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-bold text-primary mb-3">
                                    <Target className="w-4 h-4 text-indigo-500" /> 语境义与解析
                                </h4>
                                <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
                                    {rationale || "暂无解析。"}
                                </p>
                            </div>

                            {sentence && (
                                <div>
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-primary mb-4">
                                        <Bone className="w-4 h-4 text-slate-500" /> 句子原句
                                    </h4>
                                    <div className="bg-white dark:bg-zinc-900 border border-border rounded-xl p-4 text-sm shadow-sm flex flex-col gap-2">
                                        <div className="text-primary font-medium">{sentence}</div>
                                        {sentenceTranslation && (
                                            <div className="text-muted-foreground pt-2 border-t border-border/50 text-xs">
                                                {sentenceTranslation}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-none p-6 pt-2 bg-background border-t border-border">
                    <Button onClick={() => onOpenChange(false)} className="w-full">
                        继续刷题
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    );
}

