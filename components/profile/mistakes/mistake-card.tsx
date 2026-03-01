"use client";

import { useState } from "react";
import { MistakeLog } from "@/actions/get-error-logs";
import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface MistakeCardProps {
    log: MistakeLog;
    isRecent?: boolean; // 如果是近期错题（低频），降低不透明度等视觉权重
}

export function MistakeCard({ log, isRecent = false }: MistakeCardProps) {
    const { part, snapshot, userWrongAnswer, correctAnswer, failCount, lastSeenAt } = log;

    // 提取分类 Badge
    let categoryName = "Vocabulary (词汇)";
    let categoryColor = "bg-slate-100 border-slate-200 text-slate-500";

    if (log.questionType === 'GRAMMAR' || !!log.grammarNodeId) {
        categoryName = "Grammar (语法)";
        categoryColor = "bg-indigo-50 border-indigo-100 text-indigo-600";
    } else if (log.questionType === 'COLLOCATION') {
        categoryName = "Collocation (搭配)";
        categoryColor = "bg-amber-50 border-amber-100 text-amber-600";
    }

    // 处理题目文本，实现挖空线替换
    // BriefingPayload 可能会有 passage_markdown 或者在 task 里找 question_markdown
    let textContent = snapshot.passage_markdown || "";
    if (!textContent) {
        const interaction = snapshot.segments?.find((s) => s.type === 'interaction') as import("@/types/briefing").InteractionSegment | undefined;
        if (interaction && interaction.task && 'question_markdown' in interaction.task) {
            textContent = interaction.task.question_markdown || "";
        } else {
            // fallback to first text segment
            const txtSeg = snapshot.segments?.find((s) => s.type === 'text') as import("@/types/briefing").TextSegment | undefined;
            textContent = txtSeg?.content_markdown || "";
        }
    }

    // 替换 _______ 为横线 span（React 方式较为复杂，简单用正则替换为固定宽度下划线，如果是纯文本，这里需要 dangerouslySetInnerHTML 或处理 AST）
    // 为了简单且符合设计，我们先保留文本并尝试用替换
    const renderMarkdownText = () => {
        if (!textContent) return "题目文本丢失";

        const highlightedText = textContent.replace(
            /_{2,}/g,
            `<span class="inline-block w-8 border-b border-slate-400 mx-0.5"></span>`
        );

        return (
            <div
                className="text-[14px] text-slate-800 font-serif leading-relaxed line-clamp-3 mb-3 pl-1"
                dangerouslySetInnerHTML={{ __html: highlightedText }}
            />
        );
    };

    return (
        <Link href={`/dashboard/profile/mistakes/${log.id}?fails=${failCount}`} className={`block bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden group cursor-pointer hover:border-indigo-400 transition-colors ${isRecent ? 'opacity-80' : ''}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isRecent ? 'bg-slate-300' : 'bg-rose-500'}`}></div>

            <div className="flex justify-between items-start mb-2.5 pl-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-mono font-bold text-slate-500">
                        PART {part}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold ${categoryColor}`}>
                        {categoryName}
                    </span>
                </div>
                {failCount >= 3 ? (
                    <span className="text-[9px] font-mono font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 shrink-0">
                        失败 {failCount} 次
                    </span>
                ) : (
                    <span className="text-[9px] font-mono text-slate-400 shrink-0">
                        {formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true, locale: zhCN })}
                    </span>
                )}
            </div>

            {/* 题目内容 */}
            {renderMarkdownText()}

            {/* 选项比对 */}
            <div className={`pl-1 flex ${isRecent ? 'items-center gap-3' : 'flex-col gap-1.5'}`}>
                <div className="flex items-start gap-2 text-[12px] font-sans">
                    <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="text-rose-600 line-through decoration-rose-300">{userWrongAnswer}</span>
                    {!isRecent && (
                        <span className="text-[10px] text-slate-400 mt-0.5 ml-1">
                            你的选择 ({formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true, locale: zhCN })})
                        </span>
                    )}
                </div>

                {isRecent && <span className="text-slate-300">→</span>}

                <div className="flex items-start gap-2 text-[12px] font-sans">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">
                        {correctAnswer}
                    </span>
                    {!isRecent && <span className="text-[10px] text-slate-400 mt-0.5 ml-1">正确答案</span>}
                </div>
            </div>
        </Link>
    );
}
