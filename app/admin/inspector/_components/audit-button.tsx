'use client';

import { useState } from 'react';
import { auditDrillQuality, AuditResult } from '@/actions/inspector';
import { Loader2, Gavel, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AuditButtonProps {
    target: string;
    context: string;
    payload: any;
}

export function AuditButton({ target, context, payload }: AuditButtonProps) {
    const [result, setResult] = useState<AuditResult | null>(null);
    const [loading, setLoading] = useState(false);

    const [streamingText, setStreamingText] = useState("");

    const handleAudit = async () => {
        console.log('[AuditPanel] Starting audit stream...');
        setLoading(true);
        setResult(null);
        setStreamingText("");

        try {
            const response = await fetch('/api/admin/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetWord: target,
                    contextMode: context,
                    payload
                })
            });

            if (!response.ok) throw new Error(response.statusText);
            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let isStreamDone = false;

            while (!isStreamDone) {
                const { done, value } = await reader.read();
                if (done) {
                    isStreamDone = true;
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'content') {
                                fullText += data.data;
                                setStreamingText(prev => prev + data.data);
                            } else if (data.type === 'error') {
                                toast.error("Stream Error: " + data.error);
                            } else if (data.type === 'done') {
                                isStreamDone = true;
                            }
                        } catch (e) {
                            // ignore parse error for partial lines
                        }
                    }
                }
            }

            // Stream finished, try to parse JSON
            console.log('[AuditPanel] Stream finished. Raw text:', fullText);
            const jsonMatch = fullText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[0]) as AuditResult;
                    setResult(parsed);
                } catch (e) {
                    console.error("JSON Parse Error on match:", e);
                    toast.error("解析审计结果失败");
                }
                setStreamingText(""); // Clear raw text
            } else {
                toast.error("无法解析审计结果 (Format Error)");
                console.error("JSON Match Error. Full Text:", fullText);
            }

        } catch (e) {
            console.error('[AuditPanel] Exception caught:', e);
            toast.error("审计请求失败");
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 border rounded-xl p-4 bg-background/50">
                {/* Header with Re-audit */}
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                        <Gavel className="w-4 h-4" />
                        AI 审计报告
                    </h4>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleAudit}
                        disabled={loading}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCcw className="w-3 h-3 mr-1" />}
                        重新审计
                    </Button>
                </div>

                {/* Score Card */}
                <div className={cn(
                    "flex items-center justify-between p-4 rounded-xl border",
                    result.score >= 4 ? "bg-emerald-500/10 border-emerald-500/30" :
                        result.score >= 3 ? "bg-amber-500/10 border-amber-500/30" : "bg-rose-500/10 border-rose-500/30"
                )}>
                    <div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">质量分数</span>
                        {result.error_type && result.error_type !== 'NONE' && (
                            <div className="text-[10px] font-mono text-rose-500 mt-1 px-1.5 py-0.5 bg-rose-500/10 rounded inline-block">
                                {result.error_type}
                            </div>
                        )}
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className={cn(
                            "text-3xl font-black font-mono",
                            result.score >= 4 ? "text-emerald-500 dark:text-emerald-400" :
                                result.score >= 3 ? "text-amber-500 dark:text-amber-400" : "text-rose-500 dark:text-rose-400"
                        )}>{result.score}</span>
                        <span className="text-sm text-muted-foreground font-mono">/ 5</span>
                    </div>
                </div>

                {/* Reason */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">审计意见</label>
                    <p className="text-sm text-foreground p-3 bg-muted/50 rounded-lg border border-border leading-relaxed">
                        {result.reason}
                    </p>
                </div>

                {/* Redundancy Warning */}
                {result.redundancy_detected && (
                    <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-300 text-xs font-bold">
                        ⚠️ 检测到冗余 (同义词滥用)
                    </div>
                )}

                {/* Prompt Optimization Suggestion (Meta Analysis) */}
                {result.prompt_optimization_suggestion && (
                    <div className="space-y-1 border-t pt-2 mt-2">
                        <label className="text-xs font-bold text-violet-500 uppercase flex items-center gap-1">
                            🤖 Prompt 优化建议 (Generator)
                        </label>
                        <div className="text-xs font-mono text-violet-600 dark:text-violet-300 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800 break-all">
                            {result.prompt_optimization_suggestion}
                        </div>
                    </div>
                )}

                {/* Suggested Content Revision */}
                {result.suggested_revision && (
                    <div className="space-y-2 border-t pt-2 mt-2">
                        <label className="text-xs font-bold text-emerald-600 uppercase">建议修改内容</label>

                        {result.suggested_revision.question && (
                            <div className="space-y-0.5">
                                <span className="text-[10px] text-muted-foreground">Question:</span>
                                <p className="text-sm text-emerald-600 dark:text-emerald-300 italic p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded border border-emerald-200 dark:border-emerald-900/50">
                                    "{result.suggested_revision.question}"
                                </p>
                            </div>
                        )}

                        {result.suggested_revision.options && result.suggested_revision.options.length > 0 && (
                            <div className="space-y-0.5">
                                <span className="text-[10px] text-muted-foreground">Options:</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {result.suggested_revision.options.map((opt, i) => (
                                        <div key={i} className="text-xs text-muted-foreground p-1 bg-muted/30 rounded border text-center">{opt}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full">
            {loading ? (
                <div className="w-full rounded-xl bg-violet-600/5 border border-violet-500/20 flex flex-col items-center justify-center gap-2 text-violet-500 p-4 transition-all">
                    {!streamingText && (
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-xs font-bold animate-pulse">正在智能审计...</span>
                        </div>
                    )}
                    {streamingText && (
                        <div className="w-full text-left">
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-violet-400">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                正在分析...
                            </div>
                            <pre className="text-[10px] font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed opacity-80 h-[100px] overflow-y-auto no-scrollbar">
                                {streamingText}
                            </pre>
                        </div>
                    )}
                </div>
            ) : (
                <button
                    onClick={handleAudit}
                    className="w-full h-12 rounded-xl bg-violet-600/10 border border-violet-500/50 hover:bg-violet-600 hover:text-white text-violet-400 flex items-center justify-center gap-2 transition-all group"
                >
                    <Gavel className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold">开始 AI 审计</span>
                </button>
            )}
        </div>
    );
}

