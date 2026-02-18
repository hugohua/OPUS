/**
 * Floating Toolbar - 划词/划句浮出菜单
 * 
 * 功能：
 *   在选中文本上方显示黑色胶囊工具栏
 *   支持两种模式：单词 (解析/播放/复制) 和句子 (句法/朗读/复制)
 *   使用 CVA 管理按钮 variants (Audit W-2 Fix)
 * 
 * 作者: Hugo
 * 日期: 2026-02-15
 */

"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { TextSelection } from "@/hooks/use-text-selection";

// ============================================
// CVA Variants (Audit W-2)
// ============================================

const toolbarButtonVariants = cva(
    // 基础样式
    "transition-colors rounded-full flex items-center justify-center",
    {
        variants: {
            variant: {
                /** 主操作按钮 (带文字标签) */
                primary: "px-3 py-2 hover:bg-zinc-700 group gap-2",
                /** 图标按钮 */
                icon: "p-2 hover:bg-zinc-700 text-zinc-300 hover:text-white",
            },
        },
        defaultVariants: {
            variant: "icon",
        },
    }
);

// ============================================
// Props
// ============================================

interface FloatingToolbarProps {
    /** 当前选择状态 */
    selection: TextSelection;
    /** 解析/句法分析回调 */
    onAnalyze: (text: string, type: "word" | "sentence") => void;
    /** 播放 TTS 回调 */
    onPlay: (text: string) => void;
    /** 复制回调 */
    onCopy: (text: string) => void;
    /** 扩展到句子回调 */
    onExpandToSentence?: (word: string) => void;
    /** 容器滚动 Ref (用于定位修正) */
    scrollContainerRef?: React.RefObject<HTMLElement | null>;
    /** 容器滚动偏移 (废弃，使用 scrollContainerRef) */
    scrollOffset?: number;
}

// ============================================
// 图标组件 (内联 SVG，避免额外依赖)
// ============================================

const AnalyzeIcon = () => (
    <svg className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);

const SyntaxIcon = () => (
    <svg className="w-4 h-4 text-amber-400 group-hover:text-amber-300" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
);

const SpeakerIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0-12L8 10H4v4h4l4 4V6z" />
    </svg>
);

const CopyIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

// ============================================
// Component
// ============================================

export function FloatingToolbar({
    selection,
    onAnalyze,
    onPlay,
    onCopy,
    onExpandToSentence,
    scrollContainerRef,
    scrollOffset = 0,
}: FloatingToolbarProps) {
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [copied, setCopied] = useState(false);



    // 计算工具栏位置 (支持滚动监听)
    useEffect(() => {
        const updatePosition = () => {
            let rect = selection.rect;

            // 如果有 domNode，实时获取最新 rect (解决 Canvas/Scroll 下的漂移)
            if (selection.domNode) {
                rect = selection.domNode.getBoundingClientRect();
            } else if (selection.range) {
                // Sentence 模式下支持
                rect = selection.range.getBoundingClientRect();
            }

            const toolbarWidth = 220; // 预估宽度 (增加一点余量)
            const toolbarHeight = 56;

            // 计算相对于 Viewport 的位置
            // 由于是 fixed 定位，直接使用 rect.top/left 即可
            let top = rect.top - toolbarHeight - 8;
            let left = rect.left + rect.width / 2 - toolbarWidth / 2;

            // 底部边界检测 (如果顶部放不下，这就放到下面)
            if (top < 10) {
                top = rect.bottom + 8;
            }

            // 左右边界修正
            left = Math.max(16, Math.min(left, window.innerWidth - toolbarWidth - 16));

            setPosition({ top, left });
        };

        // 初始计算
        updatePosition();

        // 滚动/Resize 监听
        const container = scrollContainerRef?.current || window;
        const handleUpdate = () => requestAnimationFrame(updatePosition);

        container.addEventListener("scroll", handleUpdate, { passive: true });
        window.addEventListener("resize", handleUpdate);

        // 同时也监听 window scroll (以防万一)
        if (container !== window) {
            window.addEventListener("scroll", handleUpdate, { passive: true });
        }

        return () => {
            container.removeEventListener("scroll", handleUpdate);
            window.removeEventListener("resize", handleUpdate);
            if (container !== window) {
                window.removeEventListener("scroll", handleUpdate);
            }
        };
    }, [selection, scrollContainerRef]);

    // 复制处理
    const handleCopy = async () => {
        await navigator.clipboard.writeText(selection.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        onCopy(selection.text);
    };

    const isWord = selection.type === "word";

    return (
        <motion.div
            data-floating-toolbar
            className="fixed z-50 flex flex-col items-center"
            style={{ top: position.top, left: position.left }}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
        >
            {/* 工具栏主体 */}
            <div className="flex items-center gap-1 p-1.5 rounded-full bg-zinc-900 text-white shadow-xl shadow-zinc-300/50 dark:shadow-zinc-900/50">

                {/* 主操作：解析 (单词) / 句法 (句子) */}
                <button
                    className={cn(toolbarButtonVariants({ variant: "primary" }))}
                    onClick={() => onAnalyze(selection.text, selection.type)}
                >
                    {isWord ? <AnalyzeIcon /> : <SyntaxIcon />}
                    <span className="text-xs font-bold tracking-wide">
                        {isWord ? "解析" : "句法"}
                    </span>
                </button>

                {/* 扩展：选择整句 (仅单词模式) */}
                {isWord && onExpandToSentence && (
                    <>
                        <div className="w-px h-4 bg-zinc-700" />
                        <button
                            className={cn(toolbarButtonVariants({ variant: "icon" }))}
                            onClick={() => onExpandToSentence(selection.text)}
                            title="选择整句"
                        >
                            <SyntaxIcon />
                        </button>
                    </>
                )}

                <div className="w-px h-4 bg-zinc-700" />

                {/* 播放 TTS */}
                <button
                    className={cn(toolbarButtonVariants({ variant: "icon" }))}
                    onClick={() => onPlay(selection.text)}
                    title={isWord ? "播放发音" : "朗读句子"}
                >
                    <SpeakerIcon />
                </button>

                <div className="w-px h-4 bg-zinc-700" />

                {/* 复制 */}
                <button
                    className={cn(toolbarButtonVariants({ variant: "icon" }))}
                    onClick={handleCopy}
                    title="复制文本"
                >
                    {copied ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <CopyIcon />
                    )}
                </button>
            </div>

            {/* 底部小三角箭头 */}
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-zinc-900 -mt-px" />
        </motion.div>
    );
}
