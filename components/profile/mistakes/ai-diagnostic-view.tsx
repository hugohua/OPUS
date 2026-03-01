/**
 * AI 诊断视图 — 流式 Markdown 渲染
 * [V3.1] Client Component + useSSEStream + react-markdown
 * 
 * 功能：
 *   1. 使用 SSE 流式接收 AI 诊断的 Markdown 文本
 *   2. 逐字涌出效果（RAF 缓冲批量渲染）
 *   3. react-markdown 实时渲染结构化 Markdown
 *   4. 内置 onError 降级 UI（Fail-Safe 合规）
 */

"use client";

import { useEffect, useRef } from "react";
import { useSSEStream } from "@/hooks/use-sse-stream";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Zap, AlertCircle, RotateCcw } from "lucide-react";

interface AiDiagnosticStreamProps {
    mistakeId: string;
}

export function AiDiagnosticStream({ mistakeId }: AiDiagnosticStreamProps) {
    const { text: markdown, isLoading, error, startStream } = useSSEStream();

    // 组件挂载时自动触发流式请求
    useEffect(() => {
        // 在严格模式下，此 effect 会由于 remount 触发两次。
        // startStream 内部具备丢弃前序请求的 AbortController 保护机制，
        // 故无需使用 hasStarted ref 来屏蔽二次渲染（否则会导致真正的第二次 mount 不发请求并卡死）
        startStream("/api/diagnostic", { mistakeId });
    }, [mistakeId, startStream]);

    // 错误降级 UI（审计 B2 修正：Fail-Safe 合规）
    if (error) {
        return (
            <section className="p-5">
                <div className="flex flex-col items-center gap-3 p-6 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <AlertCircle className="w-8 h-8 text-slate-400" />
                    <p className="text-sm text-slate-600">
                        诊断服务遇到网络波动，请稍后重试。
                    </p>
                    <p className="text-xs text-slate-400">
                        您可以根据上方的正确答案自行分析。
                    </p>
                    <button
                        onClick={() => {
                            startStream("/api/diagnostic", { mistakeId });
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        重试
                    </button>
                </div>
            </section>
        );
    }

    // 初始加载态（骨架屏）
    if (isLoading && !markdown) {
        return <AiDiagnosticSkeleton />;
    }

    // 流式渲染 Markdown
    return (
        <section className="p-5 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-indigo-500" strokeWidth={2.5} />
                <h2 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">
                    AI 诊断分析
                </h2>
                {isLoading && (
                    <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse rounded-sm ml-1" />
                )}
            </div>

            <article className="diagnostic-markdown prose prose-slate max-w-none
                prose-p:text-[15px] prose-p:leading-[1.65] prose-p:text-slate-800 prose-p:my-3
                prose-strong:text-slate-900 prose-strong:font-semibold
                prose-code:text-indigo-600 prose-code:bg-slate-100/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                prose-li:text-[15px] prose-li:text-slate-800 prose-li:my-1.5
                prose-ul:my-3 prose-ol:my-3
            ">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h2(props) {
                            const text = String(props.children);
                            let Icon = Zap;
                            // iOS 风格：大部分使用系统次要文本颜色 (slate-500) 或微量主题色，避免大红大紫
                            let colorClass = "text-slate-500";

                            if (text.includes("核心考点")) {
                                Icon = require("lucide-react").Target;
                                colorClass = "text-amber-600";
                            } else if (text.includes("错因分析")) {
                                Icon = require("lucide-react").AlertTriangle;
                                colorClass = "text-rose-500";
                            } else if (text.includes("语法规则")) {
                                Icon = require("lucide-react").BookOpen;
                                colorClass = "text-indigo-500";
                            } else if (text.includes("秒杀规则")) {
                                Icon = require("lucide-react").Bolt;
                                colorClass = "text-emerald-500";
                            } else if (text.includes("句子骨架")) {
                                Icon = require("lucide-react").Bone;
                            } else if (text.includes("商务对译")) {
                                Icon = require("lucide-react").Globe;
                            } else if (text.includes("实战例句")) {
                                Icon = require("lucide-react").Lightbulb;
                            }

                            return (
                                <h2 className="flex items-center gap-1.5 mt-8 mb-2.5">
                                    <Icon className={`w-4 h-4 ${colorClass}`} strokeWidth={2.5} />
                                    <span className="text-[13px] font-semibold tracking-wide text-slate-800 uppercase">
                                        {text}
                                    </span>
                                </h2>
                            );
                        }
                    }}
                >
                    {markdown || ""}
                </ReactMarkdown>
            </article>
        </section>
    );
}

export function AiDiagnosticSkeleton() {
    return (
        <section className="p-5 space-y-6">
            <div className="flex items-center gap-2 mb-6">
                <div className="w-4 h-4 rounded bg-slate-200 animate-pulse"></div>
                <div className="w-32 h-3 rounded bg-slate-200 animate-pulse"></div>
            </div>

            <div className="space-y-4">
                <div className="w-40 h-4 rounded bg-slate-200 animate-pulse"></div>
                <div className="w-full h-3 rounded bg-slate-100 animate-pulse"></div>
                <div className="w-5/6 h-3 rounded bg-slate-100 animate-pulse"></div>
            </div>

            <div className="space-y-4 mt-6">
                <div className="w-36 h-4 rounded bg-slate-200 animate-pulse"></div>
                <div className="w-full h-3 rounded bg-slate-100 animate-pulse"></div>
                <div className="w-4/6 h-3 rounded bg-slate-100 animate-pulse mb-3"></div>
            </div>

            <div className="space-y-4 mt-6">
                <div className="w-32 h-4 rounded bg-slate-200 animate-pulse"></div>
                <div className="w-full h-16 rounded-lg bg-slate-50 border border-slate-100 animate-pulse"></div>
            </div>

            <div className="text-center pt-2 pb-4">
                <span className="text-[10px] font-mono text-slate-400 animate-pulse">AI 正在分析你的错误模式...</span>
            </div>
        </section>
    );
}
