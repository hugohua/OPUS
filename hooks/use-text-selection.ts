/**
 * 文本选择 Hook
 * 
 * 功能：
 *   封装浏览器 Selection API，检测单词点击和句子划选
 *   计算选中文本的位置信息用于浮出工具栏定位
 * 
 * 作者: Hugo
 * 日期: 2026-02-15
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface TextSelection {
    /** 选中的文本 */
    text: string;
    /** 选择类型 */
    type: "word" | "sentence";
    /** 选中区域的 Bounding Rect (用于定位工具栏) */
    rect: DOMRect;
    /** 选中的 DOM 元素 (Word 模式) */
    domNode?: HTMLElement;
    /** 选中的 Range (Sentence 模式) */
    range?: Range;
}

/**
 * 文本选择 Hook
 * 
 * 监听 selectionchange 事件，检测用户划选文本
 * 单词点击通过外部 onWordClick 触发
 * 
 * @param containerRef 文章容器 ref，限制监听范围
 */
export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>, scrollContainerRef?: React.RefObject<HTMLElement | null>) {
    const [selection, setSelection] = useState<TextSelection | null>(null);
    const isInternalClick = useRef(false);

    /** 外部调用：处理单词点击 */
    const selectWord = useCallback((word: string, element: HTMLElement) => {
        isInternalClick.current = true;
        const rect = element.getBoundingClientRect();
        setSelection({ text: word, type: "word", rect, domNode: element });

        // 清除浏览器原生选择
        window.getSelection()?.removeAllRanges();

        // 延迟重置标记
        requestAnimationFrame(() => {
            isInternalClick.current = false;
        });
    }, []);

    /** 清除选择 */
    const clearSelection = useCallback(() => {
        setSelection(null);
    }, []);

    // 监听句子划选 (selectionchange)
    useEffect(() => {
        const handleSelectionChange = () => {
            // 跳过单词点击触发的 selection 变化
            if (isInternalClick.current) return;

            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.toString().trim()) {
                return; // 不清除 —— 让 click outside 处理
            }

            // 检查选择是否在容器内
            const container = containerRef.current;
            if (!container) return;

            const anchorNode = sel.anchorNode;
            if (!anchorNode || !container.contains(anchorNode)) return;

            const text = sel.toString().trim();
            // 多词 = 句子模式
            if (text.split(/\s+/).length > 1) {
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setSelection({ text, type: "sentence", rect, range });
            }
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [containerRef]);

    // 点击空白处清除选择
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isInternalClick.current) return;

            const container = containerRef.current;
            if (!container) return;

            // 检查点击是否在工具栏或文章内
            const target = e.target as HTMLElement;
            if (target.closest('[data-floating-toolbar]')) return; // 不清除工具栏上的点击

            // 清除选择
            if (selection) {
                setSelection(null);
                window.getSelection()?.removeAllRanges();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [containerRef, selection]);

    return { selection, selectWord, clearSelection, setSelection };
}
