'use client';

import { useState, useEffect } from "react";
import {
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerClose,
    DrawerTitle,
} from "@/components/ui/drawer";
import { VocabListItem } from "@/actions/get-vocab-list";
import { getVocabDetail } from "@/actions/get-vocab-detail";
import { X, Loader2, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// 复用详情页组件
import { VocabHero } from "@/components/vocabulary/detail/VocabHero";
import { CommonChunks } from "@/components/vocabulary/detail/CommonChunks";

interface VocabSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: VocabListItem | null;
}

// 详情数据类型
interface VocabDetailData {
    vocab: {
        id: number;
        word: string;
        phoneticUs?: string | null;
        phoneticUk?: string | null;
        definition_cn: string | null;
        definitions?: any;
        abceed_rank?: number | null;
        word_family?: any;
        synonyms?: string[];
        collocations?: any;
    };
    progress: any | null;
}

export function VocabSheet({ open, onOpenChange, item }: VocabSheetProps) {
    const [detailData, setDetailData] = useState<VocabDetailData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // 当抽屉打开时获取完整数据
    useEffect(() => {
        if (open && item) {
            setIsLoading(true);
            setDetailData(null);

            getVocabDetail(item.word)
                .then((data) => {
                    if (data) {
                        setDetailData(data as VocabDetailData);
                    }
                })
                .catch((err) => {
                    console.error("Failed to fetch vocab detail:", err);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [open, item]);

    if (!item) return null;

    const vocab = detailData?.vocab;

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-900 border-t max-h-[90vh] focus:outline-none">
                {/* 
                   Fix: DialogContent requires a DialogTitle for accessibility. 
                   We hide it visually but keep it for screen readers.
                */}
                <DrawerTitle className="sr-only">
                    {item.word} Details
                </DrawerTitle>

                <div className="mx-auto w-full max-w-md relative">
                    {/* 关闭按钮 */}
                    <DrawerClose asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 z-20 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </DrawerClose>

                    {/* 主内容区域 */}
                    <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
                        {isLoading ? (
                            // Loading 骨架屏
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-violet-500 mb-4" />
                                <p className="text-sm text-zinc-500">加载中...</p>
                            </div>
                        ) : vocab ? (
                            // 详情内容
                            <>
                                {/* Hero */}
                                <VocabHero
                                    word={vocab.word}
                                    phonetic={vocab.phoneticUs || vocab.phoneticUk}
                                    definition={vocab.definition_cn}
                                    definitions={vocab.definitions}
                                    rank={vocab.abceed_rank}
                                    derivatives={vocab.word_family}
                                    synonyms={vocab.synonyms}
                                />

                                {/* L0: Common Chunks */}
                                <CommonChunks
                                    collocations={(vocab.collocations as any) || []}
                                    mainWord={vocab.word}
                                />

                                <div className="mx-6 mb-8 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 text-center">
                                    <p className="text-sm text-indigo-900 dark:text-indigo-200 mb-2 font-medium">
                                        Want to disable deep memory?
                                    </p>
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400">
                                        Check full context and AI analysis in detail view.
                                    </p>
                                </div>
                            </>
                        ) : (
                            // 错误状态
                            <div className="flex flex-col items-center justify-center py-20">
                                <p className="text-sm text-zinc-500">无法加载单词详情</p>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <DrawerFooter className="border-t border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 pb-8 pt-4">

                        <div className="w-full mb-3">
                            <Link href={`/dashboard/vocab/${item.word}`} className="block w-full">
                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 group">
                                    Deep Dive Analysis
                                    <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </Button>
                            </Link>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            >
                                暂停复习
                            </Button>
                            <Button
                                variant="ghost"
                                className="flex-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white"
                            >
                                重置进度
                            </Button>
                        </div>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
